'use strict';

const path = require('node:path');
const { loadConfig } = require('./config');
const { createLogger } = require('./logger');
const { loadCatalog } = require('./content/catalog');
const { CppRunner } = require('./runner/cppRunner');
const { SessionStore } = require('./services/sessions');
const { DsaService } = require('./services/dsaService');
const { RepoService } = require('./services/repoService');
const { AiService } = require('./services/aiService');
const { createApp } = require('./http/app');

const ROOT = path.resolve(__dirname, '..');

/** Wires all dependencies together. Exported so tests can build an app with custom config. */
function buildApp(config, logger = createLogger(config.logLevel), { fetchImpl } = {}) {
  const catalog = loadCatalog(path.join(ROOT, 'content'));
  for (const { id, missing } of catalog.unavailable) {
    logger.warn('repo hidden: required tool is not installed', { repo: id, missing });
  }
  const runner = new CppRunner({ config, logger });
  const sessions = new SessionStore({
    ttlMs: config.sessionTtlMs,
    maxSessions: config.maxSessions,
  });
  const server = createApp({
    config,
    logger,
    catalog,
    sessions,
    dsa: new DsaService({ runner }),
    repo: new RepoService({ runner }),
    ai: new AiService({ config, logger, fetchImpl }),
    publicDir: path.join(ROOT, 'public'),
  });
  server.on('close', () => sessions.close());
  return server;
}

function main() {
  const config = loadConfig();
  const logger = createLogger(config.logLevel);
  const server = buildApp(config, logger);

  server.listen(config.port, config.host, () => {
    logger.info('listening', {
      url: `http://${config.host}:${config.port}`,
      ai: !!(config.geminiApiKey || config.anthropicApiKey),
    });
  });

  let shuttingDown = false;
  const shutdown = (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info('shutting down', { signal });
    server.close(() => process.exit(0));
    server.closeIdleConnections();
    setTimeout(() => process.exit(1), 10000).unref();
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('unhandledRejection', (reason) =>
    logger.error('unhandledRejection', { reason: String(reason) }),
  );
}

if (require.main === module) main();

module.exports = { buildApp };
