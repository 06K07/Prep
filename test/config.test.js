'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadConfig } = require('../src/config');

test('defaults are safe for local use', () => {
  const config = loadConfig({});
  assert.equal(config.host, '127.0.0.1');
  assert.equal(config.port, 3000);
  assert.equal(config.cppStd, 'c++17');
  assert.equal(config.aiQueryLimit, 10);
  assert.equal(config.dsaQuestions, 2);
  assert.equal(config.dsaMinutesPerQuestion, 35);
  assert.equal(config.sandboxLimits, true);
});

test('reads overrides from the environment', () => {
  const config = loadConfig({
    PORT: '8080',
    CPP_STD: 'c++20',
    AI_QUERY_LIMIT: '3',
    TRUST_PROXY: 'true',
  });
  assert.equal(config.port, 8080);
  assert.equal(config.cppStd, 'c++20');
  assert.equal(config.aiQueryLimit, 3);
  assert.equal(config.trustProxy, true);
});

test('rejects invalid values with a clear message', () => {
  assert.throws(() => loadConfig({ PORT: 'abc' }), /Invalid PORT/);
  assert.throws(() => loadConfig({ PORT: '70000' }), /Invalid PORT/);
  assert.throws(() => loadConfig({ CPP_STD: 'rust' }), /Invalid CPP_STD/);
  assert.throws(() => loadConfig({ LOG_LEVEL: 'loud' }), /Invalid LOG_LEVEL/);
  assert.throws(() => loadConfig({ TRUST_PROXY: 'maybe' }), /Invalid TRUST_PROXY/);
  assert.throws(() => loadConfig({ DSA_QUESTIONS: '4' }), /Invalid DSA_QUESTIONS/);
});

test('config is immutable', () => {
  const config = loadConfig({});
  assert.throws(() => {
    config.port = 1;
  }, TypeError);
});
