'use strict';

const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { runProcess } = require('./sandbox');
const { Semaphore } = require('../util/semaphore');

/**
 * Compiles and runs untrusted C++ inside throw-away temp directories, with a bounded
 * number of concurrent jobs.
 */
class CppRunner {
  /** @param {{config: ReturnType<import('../config').loadConfig>, logger: any}} deps */
  constructor({ config, logger }) {
    this.config = config;
    this.logger = logger;
    this.semaphore = new Semaphore(config.maxConcurrentRuns, config.maxQueuedRuns);
  }

  /**
   * Runs `task(dir)` inside a fresh temp dir while holding a concurrency slot.
   * The dir is always removed afterwards.
   */
  async withWorkdir(task) {
    const release = await this.semaphore.acquire();
    let dir;
    try {
      dir = await fs.mkdtemp(path.join(os.tmpdir(), 'cpp-prep-'));
      return await task(dir);
    } finally {
      if (dir) {
        await fs
          .rm(dir, { recursive: true, force: true })
          .catch((err) => this.logger.warn('workdir cleanup failed', { dir, error: err.message }));
      }
      release();
    }
  }

  #options(extra) {
    return {
      limits: this.config.sandboxLimits,
      maxOutputBytes: this.config.maxOutputBytes,
      ...extra,
    };
  }

  /** Compiles C++ sources inside `dir` into `outName`. */
  compile(dir, sources, outName) {
    return runProcess(
      this.#options({
        cmd: 'g++',
        args: ['-O2', `-std=${this.config.cppStd}`, ...sources, '-o', outName],
        cwd: dir,
        timeoutMs: this.config.compileTimeoutMs,
      }),
    );
  }

  /**
   * Runs a compiled binary with stdin input under time and memory limits.
   * `maxOutputBytes` overrides the default cap (the judge raises it for tests with big answers).
   */
  execute(dir, binary, { input, timeoutMs, maxOutputBytes }) {
    return runProcess(
      this.#options({
        cmd: path.join(dir, binary),
        cwd: dir,
        input,
        timeoutMs,
        memoryKb: this.config.memoryLimitMb * 1024,
        ...(maxOutputBytes ? { maxOutputBytes } : {}),
      }),
    );
  }

  /** Runs a repo's run.sh (builds + runs its test-suite). */
  runScript(dir) {
    return runProcess(
      this.#options({
        cmd: 'bash',
        args: ['run.sh'],
        cwd: dir,
        timeoutMs: this.config.repoTimeoutMs,
        env: { STD: this.config.cppStd },
      }),
    );
  }
}

module.exports = { CppRunner };
