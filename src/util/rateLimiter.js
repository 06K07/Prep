'use strict';

/** Fixed-window in-memory rate limiter keyed by an arbitrary string (e.g. client IP). */
class RateLimiter {
  /**
   * @param {number} limit allowed hits per window
   * @param {number} windowMs window length
   * @param {() => number} now clock (injectable for tests)
   */
  constructor(limit, windowMs = 60000, now = Date.now) {
    this.limit = limit;
    this.windowMs = windowMs;
    this.now = now;
    this.hits = new Map();
  }

  /** @returns {boolean} true when the call is allowed */
  allow(key) {
    const t = this.now();
    if (this.hits.size > 5000) this.#prune(t);
    const entry = this.hits.get(key);
    if (!entry || entry.resetAt <= t) {
      this.hits.set(key, { count: 1, resetAt: t + this.windowMs });
      return true;
    }
    entry.count += 1;
    return entry.count <= this.limit;
  }

  #prune(t) {
    for (const [key, entry] of this.hits) if (entry.resetAt <= t) this.hits.delete(key);
  }
}

module.exports = { RateLimiter };
