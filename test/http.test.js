'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadConfig } = require('../src/config');
const { buildApp } = require('../src/index');

const silent = { warn() {}, info() {}, error() {}, debug() {} };

async function withServer(env, fn, fetchImpl) {
  const config = loadConfig({ PORT: '0', LOG_LEVEL: 'error', ...env });
  const server = buildApp(config, silent, { fetchImpl });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    await fn(base);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

const post = (url, body, headers = { 'Content-Type': 'application/json' }) =>
  fetch(url, {
    method: 'POST',
    headers,
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });

test('health, catalog and security headers', async () => {
  await withServer({}, async (base) => {
    const health = await fetch(`${base}/api/health`);
    assert.equal(health.status, 200);
    assert.equal((await health.json()).status, 'ok');
    assert.match(health.headers.get('content-security-policy'), /default-src 'self'/);
    assert.equal(health.headers.get('x-content-type-options'), 'nosniff');

    const catalog = await (await fetch(`${base}/api/catalog`)).json();
    assert.ok(catalog.problems.length >= 9 && catalog.repos.length >= 6);
    assert.equal(catalog.limits.dsaQuestions, 2);
    assert.equal(catalog.limits.dsaMinutesPerQuestion, 35);
    assert.equal(catalog.limits.repoMinutes, 45);
  });
});

test('serves the UI and blocks path traversal', async () => {
  await withServer({}, async (base) => {
    const index = await fetch(`${base}/`);
    assert.equal(index.status, 200);
    assert.match(await index.text(), /C\+\+ Assessment Prep/);
    assert.equal((await fetch(`${base}/app.js`)).status, 200);
    assert.equal((await fetch(`${base}/..%2Fpackage.json`)).status, 404);
    assert.equal((await fetch(`${base}/%2e%2e/package.json`)).status, 404);
    assert.equal((await fetch(`${base}/nope.txt`)).status, 404);
  });
});

test('a session has two distinct DSA questions by default and a repo', async () => {
  await withServer({}, async (base) => {
    const created = await (await post(`${base}/api/sessions`, { repoId: 'tickets' })).json();
    assert.match(created.sessionId, /^[a-f0-9]{32}$/);
    assert.equal(created.problems.length, 2);
    assert.notEqual(created.problems[0].id, created.problems[1].id);
    assert.ok(created.problems[0].starter && created.problems[0].statement);
    assert.equal(created.repo.id, 'tickets');
    assert.ok(created.repo.files['src/service.hpp']);
    assert.equal(created.limits.dsaMinutes, 70);
    assert.equal(created.limits.aiQueries, 0, 'AI disabled without a key');
  });
});

test('question count and explicit problems are validated', async () => {
  await withServer({ DSA_QUESTIONS: '1' }, async (base) => {
    const one = await (await post(`${base}/api/sessions`, {})).json();
    assert.equal(one.problems.length, 1);
    assert.equal(one.limits.dsaMinutes, 35);

    const three = await (await post(`${base}/api/sessions`, { dsaCount: 3 })).json();
    assert.equal(new Set(three.problems.map((p) => p.id)).size, 3);

    const picked = await (
      await post(`${base}/api/sessions`, { problemIds: ['coin-change', 'merge-intervals'] })
    ).json();
    assert.deepEqual(
      picked.problems.map((p) => p.id),
      ['coin-change', 'merge-intervals'],
    );

    assert.equal((await post(`${base}/api/sessions`, { dsaCount: 4 })).status, 400);
    assert.equal((await post(`${base}/api/sessions`, { dsaCount: 'two' })).status, 400);
    assert.equal(
      (await post(`${base}/api/sessions`, { problemIds: ['coin-change', 'coin-change'] })).status,
      400,
    );
    assert.equal((await post(`${base}/api/sessions`, { problemIds: [] })).status, 400);
    assert.equal((await post(`${base}/api/sessions`, { problemIds: ['nope'] })).status, 404);
    assert.equal((await post(`${base}/api/sessions`, { problemIds: ['../x'] })).status, 400);
  });
});

test('session lifecycle and input validation', async () => {
  await withServer({}, async (base) => {
    const created = await (await post(`${base}/api/sessions`, { repoId: 'tickets' })).json();
    const id = created.sessionId;

    assert.equal((await post(`${base}/api/sessions`, { repoId: 'nope' })).status, 404);
    assert.equal((await post(`${base}/api/sessions`, { repoId: '../etc' })).status, 400);
    assert.equal((await post(`${base}/api/sessions/${'0'.repeat(32)}/dsa/run`, {})).status, 404);

    // problemId is required with two questions and must belong to the session
    assert.equal((await post(`${base}/api/sessions/${id}/dsa/run`, { code: 'x' })).status, 400);
    const outsider = created.problems.some((p) => p.id === 'coin-change')
      ? 'top-k-frequent'
      : 'coin-change';
    const wrong = await post(`${base}/api/sessions/${id}/dsa/run`, {
      problemId: outsider,
      code: 'x',
    });
    assert.equal(wrong.status, 400);
    const noCode = await post(`${base}/api/sessions/${id}/dsa/run`, {
      problemId: created.problems[0].id,
    });
    assert.equal(noCode.status, 400);

    const ai = await post(`${base}/api/sessions/${id}/ai`, { question: 'hi', files: {} });
    assert.equal(ai.status, 503);
  });
});

test('report works before anything was run and validates time input', async () => {
  await withServer({}, async (base) => {
    const { sessionId } = await (await post(`${base}/api/sessions`, {})).json();
    const url = `${base}/api/sessions/${sessionId}/report`;
    const report = await (await post(url, { secondsSpent: { dsa: 120, repo: 60 } })).json();
    assert.equal(report.overall, 0);
    assert.equal(report.dsa.questions.length, 2);
    assert.equal(report.dsa.questions[0].attempts, 0);
    assert.equal(report.repo.runs, 0);
    assert.equal(report.time.dsaSeconds, 120);
    assert.ok(report.tips.some((tip) => /never ran the repo tests/.test(tip)));

    assert.equal((await post(url, { secondsSpent: { dsa: -1 } })).status, 400);
    assert.equal((await post(url, { secondsSpent: { repo: 'x' } })).status, 400);
  });
});

test('rejects bad bodies', async () => {
  await withServer({ MAX_BODY_BYTES: '2048' }, async (base) => {
    assert.equal((await post(`${base}/api/sessions`, '{not json')).status, 400);
    assert.equal((await post(`${base}/api/sessions`, '[]')).status, 400);
    assert.equal(
      (await post(`${base}/api/sessions`, '{}', { 'Content-Type': 'text/plain' })).status,
      415,
    );
    assert.equal((await post(`${base}/api/sessions`, { pad: 'x'.repeat(5000) })).status, 413);
  });
});

test('rate limits POST requests per client', async () => {
  await withServer({ RATE_LIMIT_PER_MIN: '3' }, async (base) => {
    const statuses = [];
    for (let i = 0; i < 5; i++) statuses.push((await post(`${base}/api/sessions`, {})).status);
    assert.deepEqual(statuses, [200, 200, 200, 429, 429]);
  });
});

test('AI quota is enforced per session', async () => {
  const fakeProvider = async () => ({
    ok: true,
    status: 200,
    json: async () => ({ candidates: [{ content: { parts: [{ text: 'hint' }] } }] }),
  });
  await withServer(
    { GEMINI_API_KEY: 'k', AI_QUERY_LIMIT: '2' },
    async (base) => {
      const session = await (await post(`${base}/api/sessions`, {})).json();
      assert.equal(session.limits.aiQueries, 2);
      const ask = () =>
        post(`${base}/api/sessions/${session.sessionId}/ai`, {
          question: 'why?',
          files: { a: 'b' },
          testOutput: '',
        });
      const first = await (await ask()).json();
      assert.equal(first.answer, 'hint');
      assert.equal(first.remaining, 1);
      assert.equal((await ask()).status, 200);
      assert.equal((await ask()).status, 429);
    },
    fakeProvider,
  );
});

test('failed AI calls do not consume quota', async () => {
  const failing = async () => ({ ok: false, status: 500, json: async () => ({}) });
  await withServer(
    { GEMINI_API_KEY: 'k', AI_QUERY_LIMIT: '1' },
    async (base) => {
      const session = await (await post(`${base}/api/sessions`, {})).json();
      const url = `${base}/api/sessions/${session.sessionId}/ai`;
      const body = { question: 'why?', files: { a: 'b' }, testOutput: '' };
      assert.equal((await post(url, body)).status, 502);
      assert.equal((await post(url, body)).status, 502, 'quota was refunded, so still 502 not 429');
    },
    failing,
  );
});
