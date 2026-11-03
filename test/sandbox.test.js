'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const { runProcess } = require('../src/runner/sandbox');

const base = { cwd: os.tmpdir(), timeoutMs: 10000, maxOutputBytes: 1024 * 1024 };

test('stdout and stderr keep their real order (no mid-line interleaving)', async () => {
  // A test harness writes a failure message to stderr in several writes, then a PASS/FAIL line to
  // stdout. With two separate pipes a stdout chunk can land between the pieces of an stderr line and
  // glue the "PASS" onto it, so the line parser misses it.
  const script =
    'for i in $(seq 1 300); do printf "  err-start " >&2; printf "err-end\\n" >&2; printf "PASS test$i\\n"; done';
  for (const limits of [true, false]) {
    const result = await runProcess({ ...base, cmd: 'bash', args: ['-c', script], limits });
    const passLines = result.output.split('\n').filter((line) => /^PASS test\d+$/.test(line));
    assert.equal(passLines.length, 300, `limits=${limits}`);
  }
});

test('reports missing programs without crashing', async () => {
  const result = await runProcess({ ...base, cmd: 'definitely-not-installed', limits: true });
  assert.notEqual(result.code, 0);
  assert.match(result.output, /not found/);
});

test('timeouts kill the process and are reported', async () => {
  const result = await runProcess({
    ...base,
    cmd: 'sleep',
    args: ['5'],
    timeoutMs: 200,
    limits: true,
  });
  assert.equal(result.timedOut, true);
  assert.ok(result.durationMs < 3000);
});

test('the environment is scrubbed', async () => {
  process.env.SECRET_FOR_TEST = 'leak';
  try {
    const result = await runProcess({
      ...base,
      cmd: 'bash',
      args: ['-c', 'echo "[$SECRET_FOR_TEST]"'],
      limits: true,
    });
    assert.equal(result.output.trim(), '[]');
  } finally {
    delete process.env.SECRET_FOR_TEST;
  }
});
