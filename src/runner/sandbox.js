'use strict';

const { spawn } = require('node:child_process');

const FILE_SIZE_LIMIT_KB = 20480;

// stderr is merged into stdout by the OS (one pipe), so output keeps its real order. With two
// pipes, chunks from stdout and stderr can interleave in the middle of a line.
const MERGE_STDERR = 'exec 2>&1; ';
// $1 = max file size (KB), $2 = virtual memory limit (KB, 0 = none), rest = command.
const LIMIT_WRAPPER =
  MERGE_STDERR +
  'ulimit -c 0; ulimit -f "$1"; if [ "$2" -gt 0 ]; then ulimit -v "$2"; fi; shift 2; exec "$@"';
const PLAIN_WRAPPER = `${MERGE_STDERR}exec "$@"`;

/**
 * Runs a process with a wall-clock timeout, output cap, optional ulimit limits and a
 * scrubbed environment (no API keys leak into user code). Never rejects.
 *
 * @param {object} opts
 * @param {string} opts.cmd
 * @param {string[]} [opts.args]
 * @param {string} opts.cwd
 * @param {string} [opts.input] data written to stdin
 * @param {number} opts.timeoutMs
 * @param {number} opts.maxOutputBytes
 * @param {number} [opts.memoryKb] 0 = unlimited
 * @param {boolean} [opts.limits] apply ulimit wrapper
 * @param {Record<string,string>} [opts.env] extra env vars
 * @returns {Promise<{code:number|null, signal:string|null, output:string, timedOut:boolean,
 *   truncated:boolean, durationMs:number, spawnFailed:boolean}>}
 */
function runProcess(opts) {
  const { cmd, args = [], cwd, input = '', timeoutMs, maxOutputBytes, memoryKb = 0 } = opts;
  const file = 'bash';
  const fileArgs = opts.limits
    ? ['-c', LIMIT_WRAPPER, '_', String(FILE_SIZE_LIMIT_KB), String(memoryKb), cmd, ...args]
    : ['-c', PLAIN_WRAPPER, '_', cmd, ...args];

  return new Promise((resolve) => {
    const started = Date.now();
    const chunks = [];
    let bytes = 0;
    let timedOut = false;
    let truncated = false;
    let settled = false;

    const env = { PATH: process.env.PATH, HOME: cwd, LANG: 'C.UTF-8', ...opts.env };
    const child = spawn(file, fileArgs, {
      cwd,
      env,
      detached: true,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    const kill = () => {
      try {
        process.kill(-child.pid, 'SIGKILL'); // whole process group
      } catch {
        try {
          child.kill('SIGKILL');
        } catch {
          /* already gone */
        }
      }
    };

    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({
        output: Buffer.concat(chunks).toString('utf8'),
        timedOut,
        truncated,
        durationMs: Date.now() - started,
        spawnFailed: false,
        ...result,
      });
    };

    const timer = setTimeout(() => {
      timedOut = true;
      kill();
    }, timeoutMs);

    const collect = (chunk) => {
      if (truncated) return;
      bytes += chunk.length;
      if (bytes > maxOutputBytes) {
        truncated = true;
        chunks.push(chunk.subarray(0, Math.max(0, chunk.length - (bytes - maxOutputBytes))));
        chunks.push(Buffer.from('\n[output truncated]\n'));
        kill();
        return;
      }
      chunks.push(chunk);
    };
    child.stdout.on('data', collect);
    child.stderr.on('data', collect);

    child.on('error', (err) => {
      chunks.push(Buffer.from(`Cannot start ${file}: ${err.message}`));
      finish({ code: -1, signal: null, spawnFailed: true });
    });
    child.on('close', (code, signal) => finish({ code, signal }));

    child.stdin.on('error', () => {}); // process may exit before reading stdin
    child.stdin.end(input);
  });
}

module.exports = { runProcess };
