'use strict';

// End-to-end tests that really compile C++ with g++. Skipped when g++ is unavailable.

const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { loadConfig } = require('../src/config');
const { loadCatalog } = require('../src/content/catalog');
const { CppRunner } = require('../src/runner/cppRunner');
const { DsaService } = require('../src/services/dsaService');
const { RepoService } = require('../src/services/repoService');
const { SOLUTIONS, SLOW, SLOW_VERDICT, BRUTE_FORCE, OPTIMAL } = require('../testdata/solutions');
const { buildApp } = require('../src/index');
const { applyFixes } = require('../testdata/repoFixes');

const hasGpp = spawnSync('g++', ['--version']).status === 0;
const opts = { skip: hasGpp ? false : 'g++ not installed' };

const silent = { warn() {}, info() {}, error() {}, debug() {} };
const config = loadConfig({ MAX_CONCURRENT_RUNS: '2' });
const runner = new CppRunner({ config, logger: silent });
const catalog = loadCatalog(path.join(__dirname, '..', 'content'));
const dsa = new DsaService({ runner });
const repo = new RepoService({ runner });
const summary = catalog.summary();
const verdicts = (result) => result.results.map((r) => r.verdict);

// ---------- DSA: every bundled problem must ship a verified reference solution ----------
for (const { id } of summary.problems) {
  test(`DSA ${id}: reference solution passes every hidden test`, opts, async () => {
    assert.ok(SOLUTIONS[id], `test/fixtures/solutions.js needs a reference solution for "${id}"`);
    const result = await dsa.runHidden(SOLUTIONS[id], catalog.getProblem(id));
    assert.equal(result.passed, result.total, `${id}: ${verdicts(result).join(',')}`);
  });
}

test(
  'DSA longest-subarray-k: brute force is TLE on large inputs, fine on small',
  opts,
  async () => {
    const result = await dsa.runHidden(BRUTE_FORCE, catalog.getProblem('longest-subarray-k'));
    const v = verdicts(result);
    assert.ok(v.slice(0, 10).every((x) => x === 'PASS'));
    assert.deepEqual(v.slice(10), ['TLE', 'TLE']);
  },
);

// ---------- DSA: plausible-but-wrong solutions must be rejected on the large tests ----------
for (const [id, expected] of Object.entries(SLOW_VERDICT)) {
  test(`DSA ${id}: the naive approach gets ${expected}`, opts, async () => {
    const v = verdicts(await dsa.runHidden(SLOW[id], catalog.getProblem(id)));
    assert.equal(v[0], 'PASS', 'the sample test should still pass');
    assert.ok(v.includes(expected), v.join(','));
  });
}

test('DSA: compile errors are reported, wrong answers are WA, crashes are RE', opts, async () => {
  const problem = catalog.getProblem('longest-subarray-k');
  assert.ok((await dsa.runHidden('int main( {', problem)).compileError);
  const wrong = await dsa.runHidden('#include <iostream>\nint main(){std::cout<<999;}', problem);
  assert.ok(wrong.results.every((r) => r.verdict === 'WA'));
  const crash = await dsa.runHidden('int main(){ return 3; }', problem);
  assert.ok(crash.results.every((r) => r.verdict === 'RE'));
});

test('DSA: custom input runs the program', opts, async () => {
  const sample = await dsa.runSample(OPTIMAL, '5 3\n1 -1 5 -2 3\n', 2000);
  assert.equal(sample.output.trim(), '4');
});

test('sandbox: user code cannot see API keys', opts, async () => {
  process.env.GEMINI_API_KEY = 'super-secret';
  try {
    const code =
      '#include <cstdlib>\n#include <iostream>\nint main(){const char*k=getenv("GEMINI_API_KEY");std::cout<<(k?k:"none");}';
    assert.equal((await dsa.runSample(code, '', 2000)).output.trim(), 'none');
  } finally {
    delete process.env.GEMINI_API_KEY;
  }
});

test(
  'sandbox: infinite loops are killed and sample output floods are truncated',
  opts,
  async () => {
    assert.match(
      (await dsa.runSample('int main(){ for(;;){} }', '', 500)).output,
      /Time limit exceeded/,
    );
    const flood = await dsa.runSample(
      '#include <cstdio>\nint main(){ for(;;) puts("xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"); }',
      '',
      5000,
    );
    assert.match(flood.output, /output truncated/);
  },
);

// ---------- Repos: metadata is honest and every repo is solvable ----------
for (const { id, totalTests, failingTests } of summary.repos) {
  test(
    `repo ${id}: starts with ${failingTests}/${totalTests} failing and is solvable`,
    opts,
    async () => {
      assert.ok(Number.isInteger(failingTests), `${id}: .meta.json needs failingTests/totalTests`);
      const files = { ...catalog.getRepo(id).files };

      const before = await repo.runTests(files);
      assert.equal(before.summary.total, totalTests, before.output);
      assert.equal(before.summary.failed, failingTests, before.output);

      const after = await repo.runTests(applyFixes(id, files));
      assert.equal(after.summary.failed, 0, after.output);
      assert.equal(after.summary.passed, totalTests);
    },
  );
}

test('repo: path traversal in file names is rejected', opts, async () => {
  await assert.rejects(repo.runTests({ 'run.sh': 'echo hi', '../evil.sh': 'x' }), {
    code: 'bad_request',
  });
});

// ---------- full flow over HTTP ----------
test('full flow: two questions, repo before/after fix, then the report', opts, async () => {
  const server = buildApp(loadConfig({ LOG_LEVEL: 'error' }), silent);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = async (url, body) => {
    const response = await fetch(base + url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    assert.equal(response.status, 200, `${url}: ${await response.clone().text()}`);
    return response.json();
  };
  try {
    const session = await post('/api/sessions', {
      problemIds: ['coin-change', 'merge-intervals'],
      repoId: 'order-service',
    });
    const id = session.sessionId;

    const solved = await post(`/api/sessions/${id}/dsa/run`, {
      problemId: 'coin-change',
      code: SOLUTIONS['coin-change'],
    });
    assert.equal(solved.passed, solved.total);
    const broken = await post(`/api/sessions/${id}/dsa/run`, {
      problemId: 'merge-intervals',
      code: 'int main( {',
    });
    assert.ok(broken.compileError);

    const before = await post(`/api/sessions/${id}/repo/run`, { files: session.repo.files });
    assert.equal(before.summary.failed, 6);
    const after = await post(`/api/sessions/${id}/repo/run`, {
      files: applyFixes('order-service', session.repo.files),
    });
    assert.equal(after.summary.failed, 0);

    const report = await post(`/api/sessions/${id}/report`, {
      secondsSpent: { dsa: 1500, repo: 900 },
    });
    const [coin, merge] = report.dsa.questions;
    assert.equal(coin.solved, true);
    assert.equal(merge.solved, false);
    assert.equal(merge.compileErrors, 1);
    assert.equal(report.dsa.score, 50);
    assert.equal(report.repo.fixed.length, 6);
    assert.deepEqual(report.repo.stillFailing, []);
    assert.equal(report.repo.allGreen, true);
    assert.equal(report.repo.score, 100);
    assert.equal(report.overall, 75);
    assert.equal(report.time.repoSeconds, 900);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
