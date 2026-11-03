'use strict';

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };

/**
 * Minimal structured (JSON lines) logger. Errors go to stderr, the rest to stdout.
 * @param {keyof typeof LEVELS} level
 */
function createLogger(level = 'info', sink = {}) {
  const threshold = LEVELS[level];
  const out = sink.out || process.stdout;
  const err = sink.err || process.stderr;

  const write = (lvl, msg, fields) => {
    if (LEVELS[lvl] < threshold) return;
    const line = JSON.stringify({ ts: new Date().toISOString(), level: lvl, msg, ...fields });
    (lvl === 'error' ? err : out).write(`${line}\n`);
  };

  return {
    debug: (msg, fields) => write('debug', msg, fields),
    info: (msg, fields) => write('info', msg, fields),
    warn: (msg, fields) => write('warn', msg, fields),
    error: (msg, fields) => write('error', msg, fields),
  };
}

module.exports = { createLogger };
