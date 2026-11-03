'use strict';

const { HttpError, badRequest, notFound } = require('../util/errors');
const { createStats, recordDsaRun, recordRepoRun, buildReport } = require('../services/report');

const ID_PATTERN = /^[a-z0-9-]{1,64}$/;
const MAX_CODE_CHARS = 100000;
const MAX_INPUT_CHARS = 200000;
const MAX_QUESTION_CHARS = 1000;
const MAX_SECONDS = 24 * 3600;

function requireString(value, name, max) {
  if (typeof value !== 'string') throw badRequest(`"${name}" must be a string`);
  if (value.length > max) throw badRequest(`"${name}" is too long (max ${max} characters)`);
  return value;
}

function optionalId(value, name) {
  if (value === undefined || value === null || value === '') return 'random';
  if (typeof value !== 'string' || !(value === 'random' || ID_PATTERN.test(value))) {
    throw badRequest(`"${name}" is invalid`);
  }
  return value;
}

function requireSeconds(value, name) {
  if (!Number.isFinite(value) || value < 0 || value > MAX_SECONDS) {
    throw badRequest(`"${name}" must be a number of seconds`);
  }
  return Math.round(value);
}

/**
 * Declares every API route. Handlers receive ({ params, body }) and return a JSON-able value.
 * @param {object} deps {config, catalog, sessions, dsa, repo, ai}
 */
function createRoutes({ config, catalog, sessions, dsa, repo, ai }) {
  const withSession = (handler) => (ctx) => {
    const session = sessions.get(ctx.params.id);
    if (!session) throw notFound('Session not found or expired. Start a new test.');
    return handler({ ...ctx, session });
  };

  /** Resolves the problem a request refers to and checks it belongs to the session. */
  const sessionProblem = (session, problemId) => {
    const id = problemId ?? (session.problemIds.length === 1 ? session.problemIds[0] : undefined);
    if (typeof id !== 'string' || !session.problemIds.includes(id)) {
      throw badRequest('"problemId" must be one of the questions in this test');
    }
    return catalog.getProblem(id);
  };

  /** Chooses the DSA questions for a new session. */
  const chooseProblems = (body) => {
    if (Array.isArray(body.problemIds) || body.problemId) {
      const ids = Array.isArray(body.problemIds) ? body.problemIds : [body.problemId];
      if (ids.length < 1 || ids.length > 3 || new Set(ids).size !== ids.length) {
        throw badRequest('"problemIds" must contain 1-3 distinct ids');
      }
      return ids.map((id) => {
        if (typeof id !== 'string' || !ID_PATTERN.test(id))
          throw badRequest('"problemIds" is invalid');
        const problem = catalog.getProblem(id);
        if (!problem) throw notFound(`Unknown problem "${id}"`);
        return problem;
      });
    }
    const count = body.dsaCount ?? config.dsaQuestions;
    if (!Number.isInteger(count) || count < 1 || count > 3) {
      throw badRequest('"dsaCount" must be 1, 2 or 3');
    }
    return catalog.pickProblems(count);
  };

  return [
    {
      method: 'GET',
      path: '/api/health',
      handler: () => ({ status: 'ok', ai: ai.provider || 'disabled' }),
    },
    {
      method: 'GET',
      path: '/api/catalog',
      handler: () => ({
        ...catalog.summary(),
        ai: Boolean(ai.provider),
        limits: {
          dsaQuestions: config.dsaQuestions,
          dsaMinutesPerQuestion: config.dsaMinutesPerQuestion,
          repoMinutes: config.repoMinutes,
        },
      }),
    },
    {
      method: 'POST',
      path: '/api/sessions',
      handler: ({ body }) => {
        const problems = chooseProblems(body);
        const repository = catalog.getRepo(optionalId(body.repoId, 'repoId'));
        if (!repository) throw notFound('Unknown repo');

        const problemIds = problems.map((p) => p.id);
        const session = sessions.create({
          problemIds,
          repoId: repository.id,
          stats: createStats(problemIds),
        });
        return {
          sessionId: session.id,
          problems: problems.map((p) => ({
            id: p.id,
            title: p.meta.title,
            difficulty: p.meta.difficulty,
            statement: p.statement,
            starter: p.starter,
          })),
          repo: { id: repository.id, title: repository.meta.title, files: repository.files },
          limits: {
            dsaMinutes: config.dsaMinutesPerQuestion * problems.length,
            repoMinutes: config.repoMinutes,
            aiQueries: ai.provider ? config.aiQueryLimit : 0,
          },
        };
      },
    },
    {
      method: 'POST',
      path: '/api/sessions/:id/dsa/sample',
      handler: withSession(({ body, session }) => {
        const problem = sessionProblem(session, body.problemId);
        const code = requireString(body.code, 'code', MAX_CODE_CHARS);
        const input = requireString(body.input ?? '', 'input', MAX_INPUT_CHARS);
        return dsa.runSample(code, input, problem.meta.timeLimitMs);
      }),
    },
    {
      method: 'POST',
      path: '/api/sessions/:id/dsa/run',
      handler: withSession(async ({ body, session }) => {
        const problem = sessionProblem(session, body.problemId);
        const code = requireString(body.code, 'code', MAX_CODE_CHARS);
        const result = await dsa.runHidden(code, problem);
        recordDsaRun(session.stats, problem.id, result);
        return result;
      }),
    },
    {
      method: 'POST',
      path: '/api/sessions/:id/repo/run',
      handler: withSession(async ({ body, session }) => {
        const result = await repo.runTests(body.files);
        recordRepoRun(session.stats, result);
        return result;
      }),
    },
    {
      method: 'POST',
      path: '/api/sessions/:id/ai',
      handler: withSession(async ({ body, session }) => {
        if (!ai.provider) throw new HttpError(503, 'ai_unavailable', 'AI helper is not configured');
        const question = requireString(body.question, 'question', MAX_QUESTION_CHARS).trim();
        if (!question) throw badRequest('"question" is required');
        const testOutput = requireString(body.testOutput ?? '', 'testOutput', MAX_INPUT_CHARS);
        const files = body.files;
        if (!files || typeof files !== 'object' || Array.isArray(files)) {
          throw badRequest('"files" must be an object');
        }
        if (session.aiUsed >= config.aiQueryLimit) {
          throw new HttpError(429, 'ai_quota', 'AI query limit reached for this test');
        }
        session.aiUsed += 1; // reserve first so parallel requests cannot exceed the limit
        try {
          const answer = await ai.ask({ question, files, testOutput });
          return { answer, remaining: config.aiQueryLimit - session.aiUsed };
        } catch (err) {
          session.aiUsed -= 1; // do not charge for provider failures
          throw err;
        }
      }),
    },
    {
      method: 'POST',
      path: '/api/sessions/:id/report',
      handler: withSession(({ body, session }) => {
        const spent = body.secondsSpent || {};
        const secondsSpent = {
          dsa: requireSeconds(spent.dsa ?? 0, 'secondsSpent.dsa'),
          repo: requireSeconds(spent.repo ?? 0, 'secondsSpent.repo'),
        };
        return buildReport(
          session,
          { catalog, aiLimit: ai.provider ? config.aiQueryLimit : 0 },
          secondsSpent,
        );
      }),
    },
  ];
}

module.exports = { createRoutes };
