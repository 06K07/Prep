'use strict';

const path = require('node:path');
const { badRequest } = require('./errors');

const ALLOWED = /^[A-Za-z0-9._\-/]+$/;
const MAX_LENGTH = 200;

/**
 * Validates a client supplied relative file path and returns it normalised (posix style).
 * Rejects absolute paths, "..", and unexpected characters.
 * @param {string} rel
 * @returns {string}
 */
function sanitizeRelativePath(rel) {
  if (typeof rel !== 'string' || rel.length === 0 || rel.length > MAX_LENGTH) {
    throw badRequest('Invalid file path');
  }
  if (!ALLOWED.test(rel) || rel.startsWith('/') || rel.includes('//')) {
    throw badRequest(`Invalid file path: ${rel}`);
  }
  const normalised = path.posix.normalize(rel);
  if (normalised === '.' || normalised.split('/').includes('..')) {
    throw badRequest(`Invalid file path: ${rel}`);
  }
  return normalised;
}

/**
 * Resolves a validated relative path inside `root`, guaranteeing it cannot escape.
 * @param {string} root absolute directory
 * @param {string} rel client supplied relative path
 */
function resolveInside(root, rel) {
  const safe = sanitizeRelativePath(rel);
  const absolute = path.resolve(root, safe);
  if (!absolute.startsWith(root + path.sep)) throw badRequest(`Invalid file path: ${rel}`);
  return absolute;
}

module.exports = { sanitizeRelativePath, resolveInside };
