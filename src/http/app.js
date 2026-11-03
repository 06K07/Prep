'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { RateLimiter } = require('../util/rateLimiter');
const { readJsonBody } = require('../util/body');
const { HttpError, badRequest, notFound } = require('../util/errors');
const { createRoutes } = require('./routes');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

const SECURITY_HEADERS = {
  'Content-Security-Policy':
    "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; " +
    "connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'Cross-Origin-Resource-Policy': 'same-origin',
};

/** Compiles "/api/sessions/:id/x" into { method, regex, keys, handler }. */
function compileRoutes(routes) {
  return routes.map((route) => {
    const keys = [];
    const pattern = route.path.replace(/:([a-zA-Z]+)/g, (_, key) => {
      keys.push(key);
      return '([^/]+)';
    });
    return { ...route, keys, regex: new RegExp(`^${pattern}$`) };
  });
}

function clientIp(req, trustProxy) {
  if (trustProxy) {
    const forwarded = String(req.headers['x-forwarded-for'] || '')
      .split(',')[0]
      .trim();
    if (forwarded) return forwarded;
  }
  return req.socket.remoteAddress || 'unknown';
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

/**
 * Creates the HTTP server. All collaborators are injected so tests can swap them.
 * @param {object} deps {config, logger, catalog, sessions, dsa, repo, ai, publicDir}
 */
function createApp(deps) {
  const { config, logger, publicDir } = deps;
  const routes = compileRoutes(createRoutes(deps));
  const limiter = new RateLimiter(config.rateLimitPerMinute);
  const publicRoot = path.resolve(publicDir);

  function serveStatic(req, res, pathname) {
    if (req.method !== 'GET' && req.method !== 'HEAD') throw notFound();
    let relative;
    try {
      relative = decodeURIComponent(pathname === '/' ? '/index.html' : pathname);
    } catch {
      throw badRequest('Malformed URL');
    }
    const file = path.resolve(publicRoot, `.${relative}`);
    if (
      !file.startsWith(publicRoot + path.sep) ||
      !fs.existsSync(file) ||
      !fs.statSync(file).isFile()
    ) {
      throw notFound();
    }
    const ext = path.extname(file);
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=3600',
    });
    if (req.method === 'HEAD') res.end();
    else fs.createReadStream(file).pipe(res);
  }

  async function handle(req, res, ctx) {
    const { pathname } = new URL(req.url, 'http://localhost');
    if (!pathname.startsWith('/api/')) return serveStatic(req, res, pathname);

    const route = routes.find((r) => r.method === req.method && r.regex.test(pathname));
    if (!route) throw notFound('Unknown API route');

    if (req.method === 'POST' && !limiter.allow(ctx.ip)) {
      res.setHeader('Retry-After', '60');
      throw new HttpError(429, 'rate_limited', 'Too many requests. Slow down.');
    }

    const match = route.regex.exec(pathname);
    const params = Object.fromEntries(
      route.keys.map((key, i) => [key, decodeURIComponent(match[i + 1])]),
    );
    const body = req.method === 'POST' ? await readJsonBody(req, config.maxBodyBytes) : {};
    const result = await route.handler({ params, body, ip: ctx.ip });
    sendJson(res, 200, result);
  }

  const server = http.createServer(async (req, res) => {
    const started = Date.now();
    const ctx = { id: crypto.randomUUID().slice(0, 8), ip: clientIp(req, config.trustProxy) };
    for (const [name, value] of Object.entries(SECURITY_HEADERS)) res.setHeader(name, value);
    res.setHeader('X-Request-Id', ctx.id);

    res.on('finish', () =>
      logger.info('request', {
        id: ctx.id,
        method: req.method,
        path: req.url.split('?')[0],
        status: res.statusCode,
        ms: Date.now() - started,
        ip: ctx.ip,
      }),
    );

    try {
      await handle(req, res, ctx);
    } catch (err) {
      if (res.headersSent) return res.destroy();
      if (err instanceof HttpError) {
        return sendJson(res, err.status, { error: { code: err.code, message: err.message } });
      }
      logger.error('unhandled error', { id: ctx.id, error: err.stack || String(err) });
      return sendJson(res, 500, {
        error: { code: 'internal', message: `Internal server error (ref ${ctx.id})` },
      });
    }
  });

  server.requestTimeout = 30000;
  server.keepAliveTimeout = 5000;
  return server;
}

module.exports = { createApp };
