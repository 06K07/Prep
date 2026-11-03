'use strict';

const { HttpError } = require('./errors');

/** Limits concurrent work and bounds the waiting queue (back-pressure). */
class Semaphore {
  /**
   * @param {number} limit max concurrent holders
   * @param {number} maxQueue max waiters before rejecting with 503
   */
  constructor(limit, maxQueue) {
    this.limit = limit;
    this.maxQueue = maxQueue;
    this.active = 0;
    this.queue = [];
  }

  /** @returns {Promise<() => void>} release function (idempotent) */
  acquire() {
    if (this.active < this.limit) {
      this.active += 1;
      return Promise.resolve(this.#makeRelease());
    }
    if (this.queue.length >= this.maxQueue) {
      return Promise.reject(
        new HttpError(503, 'busy', 'Server is busy running other submissions. Try again shortly.'),
      );
    }
    return new Promise((resolve) => this.queue.push(resolve));
  }

  #makeRelease() {
    let released = false;
    return () => {
      if (released) return;
      released = true;
      const next = this.queue.shift();
      if (next) next(this.#makeRelease());
      else this.active -= 1;
    };
  }
}

module.exports = { Semaphore };
