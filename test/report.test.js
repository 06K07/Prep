'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createStats, recordDsaRun, recordRepoRun, buildReport } = require('../src/services/report');
const { parseTests } = require('../src/services/repoService');

const catalog = {
  getProblem: (id) => ({ meta: { title: `Problem ${id}`, topics: [`topic-${id}`] } }),
};
const deps = { catalog, aiLimit: 10 };
const tests = (...pairs) => pairs.map(([name, passed]) => ({ name, passed }));
const repoRun = (list) => ({
  summary: {
    passed: list.filter((t) => t.passed).length,
    failed: list.filter((t) => !t.passed).length,
    total: list.length,
  },
  tests: list,
});

function session(problemIds = ['a', 'b']) {
  return { problemIds, aiUsed: 0, stats: createStats(problemIds, 0) };
}

test('parseTests extracts names and verdicts', () => {
  assert.deepEqual(
    parseTests('PASS one\nnoise\nFAIL two\n\n1 failing'),
    tests(['one', true], ['two', false]),
  );
});

test('report tracks solved questions, attempts and time to solve', () => {
  const s = session();
  recordDsaRun(s.stats, 'a', { compileError: 'boom' }, 1000);
  recordDsaRun(s.stats, 'a', { passed: 5, total: 12 }, 2000);
  recordDsaRun(s.stats, 'a', { passed: 12, total: 12 }, 5 * 60000);
  recordDsaRun(s.stats, 'a', { passed: 3, total: 12 }, 6 * 60000); // best score never goes down
  const report = buildReport(s, deps, { dsa: 600, repo: 0 });

  const [qa, qb] = report.dsa.questions;
  assert.equal(qa.attempts, 4);
  assert.equal(qa.compileErrors, 1);
  assert.equal(qa.bestPassed, 12);
  assert.equal(qa.solved, true);
  assert.equal(qa.minutesToSolve, 5);
  assert.equal(qb.solved, false);
  assert.equal(report.dsa.score, 50);
  assert.ok(report.tips.some((tip) => tip.includes('topic-b')));
});

test('report lists fixed bugs, remaining failures and regressions', () => {
  const s = session();
  recordRepoRun(
    s.stats,
    repoRun(tests(['t1', false], ['t2', false], ['t3', true], ['t4', true])),
    60000,
  );
  recordRepoRun(
    s.stats,
    repoRun(tests(['t1', true], ['t2', false], ['t3', false], ['t4', true])),
    120000,
  );
  const { repo, tips } = buildReport(s, deps, { dsa: 0, repo: 0 });

  assert.deepEqual(repo.initiallyFailing, ['t1', 't2']);
  assert.deepEqual(repo.fixed, ['t1']);
  assert.deepEqual(repo.stillFailing, ['t2', 't3']);
  assert.deepEqual(repo.regressions, ['t3']);
  assert.equal(repo.allGreen, false);
  assert.equal(repo.score, 50);
  assert.ok(tips.some((tip) => tip.includes('broke tests')));
});

test('report records when the repo first turned all green', () => {
  const s = session(['a']);
  recordRepoRun(s.stats, repoRun(tests(['t1', false])), 60000);
  recordRepoRun(s.stats, repoRun(tests(['t1', true])), 4 * 60000);
  recordRepoRun(s.stats, repoRun(tests(['t1', true])), 9 * 60000);
  const { repo, overall } = buildReport(s, deps, { dsa: 0, repo: 0 });
  assert.equal(repo.allGreen, true);
  assert.equal(repo.minutesToAllGreen, 4);
  assert.equal(repo.score, 100);
  assert.equal(overall, 50, 'DSA unsolved counts as 0');
});

test('AI usage is reported and exhausting hints is called out', () => {
  const s = session(['a']);
  s.aiUsed = 10;
  const report = buildReport(s, deps, { dsa: 0, repo: 0 });
  assert.deepEqual(report.ai, { used: 10, limit: 10 });
  assert.ok(report.tips.some((tip) => tip.includes('every AI hint')));
});
