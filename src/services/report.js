'use strict';

const MAX_REPO_RUNS = 200;
const percent = (part, total) => (total > 0 ? Math.round((part / total) * 100) : 0);

/** Fresh per-session statistics, filled in as the candidate runs code. */
function createStats(problemIds, now = Date.now()) {
  return {
    startedAt: now,
    dsa: Object.fromEntries(
      problemIds.map((id) => [
        id,
        { attempts: 0, compileErrors: 0, bestPassed: 0, total: 0, solvedAt: null },
      ]),
    ),
    repoRuns: [],
  };
}

/** @param result output of DsaService.runHidden */
function recordDsaRun(stats, problemId, result, now = Date.now()) {
  const entry = stats.dsa[problemId];
  entry.attempts += 1;
  if (result.compileError) {
    entry.compileErrors += 1;
    return;
  }
  entry.total = result.total;
  entry.bestPassed = Math.max(entry.bestPassed, result.passed);
  if (result.passed === result.total && entry.solvedAt === null) entry.solvedAt = now;
}

/** @param result output of RepoService.runTests */
function recordRepoRun(stats, result, now = Date.now()) {
  if (stats.repoRuns.length >= MAX_REPO_RUNS) stats.repoRuns.shift();
  stats.repoRuns.push({ at: now, summary: result.summary, tests: result.tests });
}

function dsaSection(session, catalog) {
  const questions = session.problemIds.map((id) => {
    const entry = session.stats.dsa[id];
    const problem = catalog.getProblem(id);
    return {
      id,
      title: problem.meta.title,
      topics: problem.meta.topics || [],
      attempts: entry.attempts,
      compileErrors: entry.compileErrors,
      bestPassed: entry.bestPassed,
      total: entry.total,
      solved: entry.solvedAt !== null,
      minutesToSolve:
        entry.solvedAt === null
          ? null
          : Math.round((entry.solvedAt - session.stats.startedAt) / 60000),
    };
  });
  const score = questions.length
    ? Math.round(
        questions.reduce((sum, q) => sum + percent(q.bestPassed, q.total), 0) / questions.length,
      )
    : 0;
  return { questions, score };
}

function repoSection(session) {
  const runs = session.stats.repoRuns;
  if (runs.length === 0) {
    return { runs: 0, score: 0, fixed: [], stillFailing: [], regressions: [], allGreen: false };
  }
  const first = runs[0];
  const last = runs[runs.length - 1];
  const failing = (run) => run.tests.filter((t) => !t.passed).map((t) => t.name);
  const initiallyFailing = failing(first);
  const stillFailing = failing(last);
  const initiallyPassing = new Set(first.tests.filter((t) => t.passed).map((t) => t.name));
  const allGreen = last.summary.total > 0 && last.summary.failed === 0;
  const allGreenRun = runs.find((r) => r.summary.total > 0 && r.summary.failed === 0);
  return {
    runs: runs.length,
    total: last.summary.total,
    passed: last.summary.passed,
    initiallyFailing,
    fixed: initiallyFailing.filter((name) => !stillFailing.includes(name)),
    stillFailing,
    regressions: stillFailing.filter((name) => initiallyPassing.has(name)),
    allGreen,
    minutesToAllGreen: allGreenRun
      ? Math.round((allGreenRun.at - session.stats.startedAt) / 60000)
      : null,
    score: percent(last.summary.passed, last.summary.total),
  };
}

function tips(dsa, repo, ai) {
  const out = [];
  const unsolved = dsa.questions.filter((q) => !q.solved);
  if (unsolved.length) {
    const topics = [...new Set(unsolved.flatMap((q) => q.topics))];
    out.push(`Revise: ${topics.join(', ') || 'the unsolved problems'}.`);
  }
  if (dsa.questions.some((q) => q.compileErrors >= 3)) {
    out.push('Several compile errors: compile locally before submitting, they cost time.');
  }
  if (repo.runs === 0)
    out.push('You never ran the repo tests. Run them early, the failures are your map.');
  else if (repo.regressions.length) {
    out.push(`Your edits broke tests that passed before: ${repo.regressions.join(', ')}.`);
  }
  if (repo.stillFailing.length) out.push(`Still failing: ${repo.stillFailing.join(', ')}.`);
  if (ai.limit > 0 && ai.used >= ai.limit)
    out.push('You used every AI hint. Try reading the failing test first.');
  if (out.length === 0) out.push('Clean run. Try a harder repo or a tighter timer next.');
  return out;
}

/**
 * Builds the end-of-test report.
 * @param {object} session
 * @param {{catalog: any, aiLimit: number}} deps
 * @param {{dsa: number, repo: number}} secondsSpent
 */
function buildReport(session, { catalog, aiLimit }, secondsSpent) {
  const dsa = dsaSection(session, catalog);
  const repo = repoSection(session);
  const ai = { used: session.aiUsed, limit: aiLimit };
  return {
    overall: Math.round((dsa.score + repo.score) / 2),
    dsa,
    repo,
    ai,
    time: { dsaSeconds: secondsSpent.dsa, repoSeconds: secondsSpent.repo },
    tips: tips(dsa, repo, ai),
  };
}

module.exports = { createStats, recordDsaRun, recordRepoRun, buildReport };
