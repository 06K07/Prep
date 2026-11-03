'use strict';

/** An error that is safe to show to the client. */
class HttpError extends Error {
  /**
   * @param {number} status HTTP status code
   * @param {string} code machine readable code, e.g. "bad_request"
   * @param {string} message human readable message
   */
  constructor(status, code, message) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
  }
}

const badRequest = (message) => new HttpError(400, 'bad_request', message);
const notFound = (message = 'Not found') => new HttpError(404, 'not_found', message);

module.exports = { HttpError, badRequest, notFound };
