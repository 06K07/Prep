'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadCatalog } = require('../src/content/catalog');
const { SessionStore } = require('../src/services/sessions');
const { validateFiles, summarise } = require('../src/services/repoService');
const { AiService, buildPrompt } = require('../src/services/aiService');
const { normalise } = require('../src/services/dsaService');
const { loadConfig } = require('../src/config');
const path = require('node:path');

const CONTENT = path.join(__dirname, '..', 'content');
const ALL_TOOLS = { hasTool: () => true };
const silent = { warn() {}, info() {}, error() {}, debug() {} };

test('catalog loads and validates the bundled content', () => {
  const catalog = loadCatalog(CONTENT, ALL_TOOLS);
  const summary = catalog.summary();
  assert.ok(summary.problems.length >= 9);
  assert.ok(summary.repos.length >= 7);
  assert.equal(catalog.getProblem('does-not-exist'), null);
  assert.ok(catalog.getRepo('tickets').files['run.sh']);
  assert.ok(!('seed' in summary.problems[0]), 'internal meta must not leak');
});

test('repos whose toolchain is missing are hidden, not broken', () => {
  const withoutCmake = loadCatalog(CONTENT, { hasTool: (tool) => tool !== 'cmake' });
  assert.equal(withoutCmake.getRepo('url-shortener'), null);
  assert.ok(!withoutCmake.summary().repos.some((r) => r.id === 'url-shortener'));
  assert.deepEqual(withoutCmake.unavailable, [{ id: 'url-shortener', missing: ['cmake'] }]);

  const full = loadCatalog(CONTENT, ALL_TOOLS);
  assert.deepEqual(full.unavailable, []);
  assert.ok(full.getRepo('url-shortener').files['CMakeLists.txt']);
});

test('catalog picks distinct random problems', () => {
  const catalog = loadCatalog(CONTENT, ALL_TOOLS);
  const picked = catalog.pickProblems(3);
  assert.equal(new Set(picked.map((p) => p.id)).size, 3);
  assert.equal(catalog.pickProblems(1000).length, catalog.summary().problems.length);
});

test('catalog hidden test cases are deterministic', () => {
  const dir = path.join(__dirname, '..', 'content');
  const a = loadCatalog(dir, ALL_TOOLS)
    .getProblem('longest-subarray-k')
    .cases.map((c) => c.expected);
  const b = loadCatalog(dir, ALL_TOOLS)
    .getProblem('longest-subarray-k')
    .cases.map((c) => c.expected);
  assert.deepEqual(a, b);
});

test('sessions expire and are capped', () => {
  let now = 0;
  const store = new SessionStore({ ttlMs: 1000, maxSessions: 2, now: () => now });
  const first = store.create({});
  const second = store.create({});
  store.create({}); // evicts the oldest
  assert.equal(store.get(first.id), null);
  assert.ok(store.get(second.id));
  now = 5000;
  assert.equal(store.get(second.id), null);
  store.close();
});

test('validateFiles accepts a repo and rejects bad input', () => {
  assert.equal(validateFiles({ 'run.sh': 'echo hi', 'a.cpp': 'int x;' }).length, 2);
  assert.throws(() => validateFiles(null), { code: 'bad_request' });
  assert.throws(() => validateFiles({}), { code: 'bad_request' });
  assert.throws(() => validateFiles({ 'a.cpp': 'x' }), /run.sh is required/);
  assert.throws(() => validateFiles({ 'run.sh': 1 }), { code: 'bad_request' });
  assert.throws(() => validateFiles({ 'run.sh': 'x'.repeat(300 * 1024) }), /too large/);
});

test('summarise counts PASS/FAIL lines', () => {
  assert.deepEqual(summarise('PASS a\nFAIL b\nPASS c\n2 left'), { passed: 2, failed: 1, total: 3 });
});

test('normalise ignores whitespace differences', () => {
  assert.equal(normalise(' 4 \n'), '4');
  assert.equal(normalise('1\n2'), '1 2');
});

test('AiService: no provider -> 503; gemini response is parsed and code blocks removed', async () => {
  const none = new AiService({ config: loadConfig({}), logger: silent });
  assert.equal(none.provider, null);
  await assert.rejects(none.ask({ question: 'q', files: {}, testOutput: '' }), { status: 503 });

  let seenUrl;
  const fetchImpl = async (url) => {
    seenUrl = url;
    return {
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: 'Dekho yahan:\n```cpp\nfix();\n```\nbas.' }] } }],
      }),
    };
  };
  const ai = new AiService({
    config: loadConfig({ GEMINI_API_KEY: 'k' }),
    logger: silent,
    fetchImpl,
  });
  const answer = await ai.ask({ question: 'q', files: { 'a.cpp': 'x' }, testOutput: 'FAIL t' });
  assert.match(seenUrl, /gemini-3\.1-flash-lite:generateContent/);
  assert.ok(!answer.includes('fix();'));
  assert.match(answer, /hints only/);
});

test('AiService maps provider failures to a clean 502', async () => {
  const fetchImpl = async () => ({
    ok: false,
    status: 404,
    json: async () => ({ error: 'no model' }),
  });
  const ai = new AiService({
    config: loadConfig({ GEMINI_API_KEY: 'k' }),
    logger: silent,
    fetchImpl,
  });
  await assert.rejects(ai.ask({ question: 'q', files: {}, testOutput: '' }), { status: 502 });
});

test('buildPrompt caps oversized context', () => {
  const prompt = buildPrompt({ question: 'q', files: { big: 'x'.repeat(200000) }, testOutput: '' });
  assert.ok(prompt.length < 70000);
});
