'use strict';

const crypto = require('node:crypto');

/** In-memory practice sessions with TTL and a size cap (oldest evicted first). */
class SessionStore {
  /**
   * @param {{ttlMs: number, maxSessions: number, now?: () => number}} opts
   */
  constructor({ ttlMs, maxSessions, now = Date.now }) {
    this.ttlMs = ttlMs;
    this.maxSessions = maxSessions;
    this.now = now;
    this.sessions = new Map();
    this.sweeper = setInterval(() => this.sweep(), 60000);
    this.sweeper.unref();
  }

  create(data) {
    if (this.sessions.size >= this.maxSessions) {
      this.sweep();
      if (this.sessions.size >= this.maxSessions) {
        this.sessions.delete(this.sessions.keys().next().value); // oldest (insertion order)
      }
    }
    const id = crypto.randomBytes(16).toString('hex');
    const session = { id, ...data, aiUsed: 0, touchedAt: this.now() };
    this.sessions.set(id, session);
    return session;
  }

  /** @returns {object | null} */
  get(id) {
    const session = this.sessions.get(id);
    if (!session) return null;
    if (this.now() - session.touchedAt > this.ttlMs) {
      this.sessions.delete(id);
      return null;
    }
    session.touchedAt = this.now();
    return session;
  }

  sweep() {
    const t = this.now();
    for (const [id, s] of this.sessions) if (t - s.touchedAt > this.ttlMs) this.sessions.delete(id);
  }

  close() {
    clearInterval(this.sweeper);
  }
}

module.exports = { SessionStore };
