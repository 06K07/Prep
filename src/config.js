'use strict';

const STD_PATTERN = /^(c|gnu)\+\+(11|14|17|20|23|1z|2a)$/;

function readInt(env, key, fallback, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  const raw = env[key];
  if (raw === undefined || raw === '') return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`Invalid ${key}="${raw}": expected an integer in [${min}, ${max}]`);
  }
  return value;
}

function readBool(env, key, fallback) {
  const raw = env[key];
  if (raw === undefined || raw === '') return fallback;
  if (['1', 'true', 'yes', 'on'].includes(raw.toLowerCase())) return true;
  if (['0', 'false', 'no', 'off'].includes(raw.toLowerCase())) return false;
  throw new Error(`Invalid ${key}="${raw}": expected true/false`);
}

/**
 * Parses and validates configuration from environment variables.
 * Fails fast with a clear message instead of misbehaving at runtime.
 * @param {NodeJS.ProcessEnv} env
 */
function loadConfig(env = process.env) {
  const cppStd = env.CPP_STD || 'c++17';
  if (!STD_PATTERN.test(cppStd)) throw new Error(`Invalid CPP_STD="${cppStd}"`);

  const logLevel = env.LOG_LEVEL || 'info';
  if (!['debug', 'info', 'warn', 'error'].includes(logLevel)) {
    throw new Error(`Invalid LOG_LEVEL="${logLevel}"`);
  }

  return Object.freeze({
    host: env.HOST || '127.0.0.1',
    port: readInt(env, 'PORT', 3000, { min: 0, max: 65535 }),
    logLevel,
    trustProxy: readBool(env, 'TRUST_PROXY', false),

    cppStd,
    sandboxLimits: readBool(env, 'SANDBOX_LIMITS', true),
    memoryLimitMb: readInt(env, 'MEMORY_LIMIT_MB', 512, { min: 16, max: 8192 }),
    maxConcurrentRuns: readInt(env, 'MAX_CONCURRENT_RUNS', 2, { min: 1, max: 64 }),
    maxQueuedRuns: readInt(env, 'MAX_QUEUED_RUNS', 10, { min: 0, max: 1000 }),
    compileTimeoutMs: readInt(env, 'COMPILE_TIMEOUT_MS', 30000, { min: 1000 }),
    repoTimeoutMs: readInt(env, 'REPO_TIMEOUT_MS', 60000, { min: 1000 }),
    maxOutputBytes: readInt(env, 'MAX_OUTPUT_BYTES', 256 * 1024, { min: 1024 }),

    maxBodyBytes: readInt(env, 'MAX_BODY_BYTES', 512 * 1024, { min: 1024 }),
    rateLimitPerMinute: readInt(env, 'RATE_LIMIT_PER_MIN', 60, { min: 1 }),
    sessionTtlMs: readInt(env, 'SESSION_TTL_MIN', 240, { min: 1 }) * 60 * 1000,
    maxSessions: readInt(env, 'MAX_SESSIONS', 500, { min: 1 }),

    dsaQuestions: readInt(env, 'DSA_QUESTIONS', 2, { min: 1, max: 3 }),
    dsaMinutesPerQuestion: readInt(env, 'DSA_MINUTES_PER_QUESTION', 35, { min: 1, max: 300 }),
    repoMinutes: readInt(env, 'REPO_MINUTES', 45, { min: 1, max: 600 }),

    aiQueryLimit: readInt(env, 'AI_QUERY_LIMIT', 10, { min: 0, max: 1000 }),
    aiTimeoutMs: readInt(env, 'AI_TIMEOUT_MS', 20000, { min: 1000 }),
    geminiApiKey: env.GEMINI_API_KEY || '',
    geminiModel: env.GEMINI_MODEL || 'gemini-3.1-flash-lite',
    anthropicApiKey: env.ANTHROPIC_API_KEY || '',
    anthropicModel: env.ANTHROPIC_MODEL || 'claude-sonnet-4-6',
  });
}

module.exports = { loadConfig };
