'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { sanitizeRelativePath, resolveInside } = require('../src/util/safePath');
const { Semaphore } = require('../src/util/semaphore');
const { RateLimiter } = require('../src/util/rateLimiter');
const { createRng } = require('../src/util/rng');

test('sanitizeRelativePath accepts normal repo paths', () => {
  assert.equal(sanitizeRelativePath('src/service.hpp'), 'src/service.hpp');
  assert.equal(sanitizeRelativePath('run.sh'), 'run.sh');
  assert.equal(sanitizeRelativePath('./a/b.cpp'), 'a/b.cpp');
});

test('sanitizeRelativePath rejects traversal and odd input', () => {
  for (const bad of [
    '../etc/passwd',
    'a/../../b',
    '/etc/passwd',
    'a//b',
    '',
    'a b',
    'a\0b',
    '..',
    '.',
  ]) {
    assert.throws(() => sanitizeRelativePath(bad), { code: 'bad_request' }, JSON.stringify(bad));
  }
  assert.throws(() => sanitizeRelativePath(42), { code: 'bad_request' });
  assert.throws(() => sanitizeRelativePath('a'.repeat(500)), { code: 'bad_request' });
});

test('resolveInside never escapes the root', () => {
  const root = path.resolve('/tmp/work');
  assert.equal(resolveInside(root, 'src/a.cpp'), path.join(root, 'src', 'a.cpp'));
  assert.throws(() => resolveInside(root, '../x'), { code: 'bad_request' });
});

test('Semaphore limits concurrency and rejects when the queue is full', async () => {
  const sem = new Semaphore(1, 1);
  const releaseFirst = await sem.acquire();
  let secondRan = false;
  const second = sem.acquire().then((release) => {
    secondRan = true;
    return release;
  });
  await assert.rejects(sem.acquire(), { status: 503, code: 'busy' });
  assert.equal(secondRan, false);
  releaseFirst();
  (await second)();
  assert.equal(sem.active, 0);
});

test('Semaphore release is idempotent', async () => {
  const sem = new Semaphore(1, 0);
  const release = await sem.acquire();
  release();
  release();
  assert.equal(sem.active, 0);
});

test('RateLimiter enforces the window and resets', () => {
  let now = 0;
  const limiter = new RateLimiter(2, 1000, () => now);
  assert.equal(limiter.allow('ip'), true);
  assert.equal(limiter.allow('ip'), true);
  assert.equal(limiter.allow('ip'), false);
  assert.equal(limiter.allow('other'), true);
  now = 1001;
  assert.equal(limiter.allow('ip'), true);
});

test('rng is deterministic and respects bounds', () => {
  const a = createRng(7);
  const b = createRng(7);
  for (let i = 0; i < 100; i++) {
    const value = a.int(-3, 3);
    assert.equal(value, b.int(-3, 3));
    assert.ok(value >= -3 && value <= 3);
  }
});
