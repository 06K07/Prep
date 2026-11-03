'use strict';

const { HttpError, badRequest } = require('./errors');

/**
 * Reads and parses a JSON request body with a hard size limit.
 * @param {import('node:http').IncomingMessage} req
 * @param {number} maxBytes
 */
function readJsonBody(req, maxBytes) {
  return new Promise((resolve, reject) => {
    const type = String(req.headers['content-type'] || '');
    if (!type.toLowerCase().startsWith('application/json')) {
      reject(new HttpError(415, 'unsupported_media_type', 'Content-Type must be application/json'));
      return;
    }
    const chunks = [];
    let size = 0;
    let failed = false;
    req.on('data', (chunk) => {
      if (failed) return;
      size += chunk.length;
      if (size > maxBytes) {
        failed = true;
        reject(new HttpError(413, 'payload_too_large', 'Request body too large'));
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (failed) return;
      try {
        const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
        if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
          reject(badRequest('JSON body must be an object'));
        } else {
          resolve(parsed);
        }
      } catch {
        reject(badRequest('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

module.exports = { readJsonBody };
