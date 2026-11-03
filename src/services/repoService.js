'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const { badRequest } = require('../util/errors');
const { resolveInside } = require('../util/safePath');

const MAX_FILES = 60;
const MAX_FILE_BYTES = 200 * 1024;
const MAX_TOTAL_BYTES = 1024 * 1024;

/** Validates a client supplied { path: content } map. */
function validateFiles(files) {
  if (files === null || typeof files !== 'object' || Array.isArray(files)) {
    throw badRequest('"files" must be an object of path -> content');
  }
  const entries = Object.entries(files);
  if (entries.length === 0 || entries.length > MAX_FILES) {
    throw badRequest(`"files" must contain 1-${MAX_FILES} files`);
  }
  let total = 0;
  for (const [name, content] of entries) {
    if (typeof content !== 'string') throw badRequest(`File "${name}" must be a string`);
    const size = Buffer.byteLength(content);
    total += size;
    if (size > MAX_FILE_BYTES) throw badRequest(`File "${name}" is too large`);
  }
  if (total > MAX_TOTAL_BYTES) throw badRequest('Repository is too large');
  if (typeof files['run.sh'] !== 'string') throw badRequest('run.sh is required');
  return entries;
}

/** Extracts PASS/FAIL counts from the test output ("PASS name" / "FAIL name" lines). */
function summarise(output) {
  const passed = (output.match(/^PASS /gm) || []).length;
  const failed = (output.match(/^FAIL /gm) || []).length;
  return { passed, failed, total: passed + failed };
}

/** Parses "PASS name" / "FAIL name" lines into [{ name, passed }]. */
function parseTests(output) {
  const tests = [];
  for (const line of output.split('\n')) {
    const match = /^(PASS|FAIL) (\S+)/.exec(line);
    if (match) tests.push({ name: match[2], passed: match[1] === 'PASS' });
  }
  return tests;
}

/** Writes a candidate's repo into a temp dir and runs its run.sh. */
class RepoService {
  /** @param {{runner: import('../runner/cppRunner').CppRunner}} deps */
  constructor({ runner }) {
    this.runner = runner;
  }

  async runTests(files) {
    const entries = validateFiles(files);
    return this.runner.withWorkdir(async (dir) => {
      for (const [name, content] of entries) {
        const target = resolveInside(dir, name);
        await fs.mkdir(path.dirname(target), { recursive: true });
        await fs.writeFile(target, content);
      }
      const run = await this.runner.runScript(dir);
      const output = run.timedOut ? `${run.output}\n[timed out]` : run.output;
      return {
        output,
        exitCode: run.code,
        timedOut: run.timedOut,
        summary: summarise(output),
        tests: parseTests(output),
      };
    });
  }
}

module.exports = { RepoService, validateFiles, summarise, parseTests };
