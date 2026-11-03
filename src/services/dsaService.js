'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');

const normalise = (text) => text.trim().split(/\s+/).join(' ');

/** Compiles + judges C++ solutions against a problem's hidden tests. */
class DsaService {
  /** @param {{runner: import('../runner/cppRunner').CppRunner}} deps */
  constructor({ runner }) {
    this.runner = runner;
  }

  async #compile(dir, code) {
    await fs.writeFile(path.join(dir, 'main.cpp'), code);
    const result = await this.runner.compile(dir, ['main.cpp'], 'main');
    return result.code === 0 ? null : result.output;
  }

  /** Runs the code once on custom stdin (no judging). */
  runSample(code, input, timeLimitMs) {
    return this.runner.withWorkdir(async (dir) => {
      const compileError = await this.#compile(dir, code);
      if (compileError) return { compileError };
      const run = await this.runner.execute(dir, 'main', { input, timeoutMs: timeLimitMs });
      return {
        output: run.timedOut ? 'Time limit exceeded' : run.output,
        exitCode: run.code,
        durationMs: run.durationMs,
      };
    });
  }

  /** Judges the code against every hidden test case. */
  runHidden(code, problem) {
    return this.runner.withWorkdir(async (dir) => {
      const compileError = await this.#compile(dir, code);
      if (compileError) return { compileError };

      const results = [];
      for (const testCase of problem.cases) {
        // Allow output proportional to the correct answer, so large legitimate outputs are not cut.
        const outputCap = Math.max(
          this.runner.config.maxOutputBytes,
          testCase.expected.length * 4 + 4096,
        );
        const run = await this.runner.execute(dir, 'main', {
          input: testCase.input,
          timeoutMs: problem.meta.timeLimitMs,
          maxOutputBytes: outputCap,
        });
        let verdict = 'PASS';
        if (run.timedOut) verdict = 'TLE';
        else if (run.code !== 0) verdict = 'RE';
        else if (normalise(run.output) !== testCase.expected) verdict = 'WA';
        results.push({ verdict, durationMs: run.durationMs, large: Boolean(testCase.large) });
      }
      const passed = results.filter((r) => r.verdict === 'PASS').length;
      return { results, passed, total: results.length };
    });
  }
}

module.exports = { DsaService, normalise };
