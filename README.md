# C++ Assessment Prep

Practice tool for timed online assessments (Amazon / Google style), in C++:

1. **Part 1 - DSA:** solve 1-3 problems (default 2, like a real assessment) against hidden tests with time limits and large inputs.
2. **Part 2 - Backend repo:** a multi-file C++ project with failing tests, run through `run.sh`.
   A **read-only AI helper** (limited queries) tells you _why_ a test fails and _where_ to look, but never gives fixed code.

Each part has its own timer. Every user gets an isolated session, and at the end a **report** shows your score, which bugs you fixed, what is still failing, time per part and how many AI hints you used.

## Quick start

Requirements: Linux, macOS or WSL, Node.js >= 20, `g++`, `bash`, and `cmake` + `make` for the CMake repo
(`sudo apt install g++ cmake make`). If cmake is missing that one repo is hidden and a warning is logged.
(Native Windows is not supported: use WSL or Docker.)

```bash
npm install                      # only dev tooling (prettier); no runtime dependencies
export GEMINI_API_KEY=...        # optional, free: https://aistudio.google.com/apikey
npm start                        # http://127.0.0.1:3000
```

Without an AI key everything works except the helper panel.

### Docker

```bash
export GEMINI_API_KEY=...        # optional
docker compose up --build        # http://127.0.0.1:3000
```

The compose file runs as a non-root user with a read-only filesystem, dropped capabilities,
a PID limit and memory/CPU caps, because it executes user submitted C++.

## Configuration

All settings are environment variables (see `.env.example`). Invalid values stop startup with a clear error.

| Variable                                    | Default                     | Meaning                                                   |
| ------------------------------------------- | --------------------------- | --------------------------------------------------------- |
| `HOST` / `PORT`                             | `127.0.0.1` / `3000`        | Bind address. Docker image uses `0.0.0.0`.                |
| `CPP_STD`                                   | `c++17`                     | `-std=` passed to g++ (e.g. `c++20`).                     |
| `GEMINI_API_KEY` / `GEMINI_MODEL`           | - / `gemini-3.1-flash-lite` | Free AI helper. Change the model if Google renames it.    |
| `ANTHROPIC_API_KEY` / `ANTHROPIC_MODEL`     | - / `claude-sonnet-4-6`     | Alternative AI provider (used if no Gemini key).          |
| `AI_QUERY_LIMIT`                            | `10`                        | AI questions per test (enforced on the server).           |
| `DSA_QUESTIONS`                             | `2`                         | DSA questions per test (1-3).                             |
| `DSA_MINUTES_PER_QUESTION` / `REPO_MINUTES` | `35` / `45`                 | Timers: DSA part = per-question minutes x question count. |
| `MAX_CONCURRENT_RUNS` / `MAX_QUEUED_RUNS`   | `2` / `10`                  | Parallel compiles+runs, then `503 busy`.                  |
| `MEMORY_LIMIT_MB`                           | `512`                       | Memory limit for a running submission.                    |
| `COMPILE_TIMEOUT_MS` / `REPO_TIMEOUT_MS`    | `30000` / `60000`           | Wall-clock limits.                                        |
| `MAX_OUTPUT_BYTES`                          | `262144`                    | Process output cap (then killed and truncated).           |
| `MAX_BODY_BYTES` / `RATE_LIMIT_PER_MIN`     | `524288` / `60`             | Request size and per-IP POST rate limit.                  |
| `SESSION_TTL_MIN` / `MAX_SESSIONS`          | `240` / `500`               | In-memory session lifetime and cap.                       |
| `TRUST_PROXY`                               | `false`                     | Trust `X-Forwarded-For` (only behind your own proxy).     |
| `SANDBOX_LIMITS`                            | `true`                      | Apply `ulimit` file/memory limits to submissions.         |
| `LOG_LEVEL`                                 | `info`                      | `debug`, `info`, `warn`, `error` (JSON lines).            |

## Project layout

```
src/
  index.js            wiring + startup + graceful shutdown
  config.js           env parsing and validation
  logger.js           JSON line logger
  http/app.js         server, security headers, rate limit, static files, error mapping
  http/routes.js      API routes and input validation
  runner/sandbox.js   process execution: timeout, output cap, ulimit, scrubbed env
  runner/cppRunner.js temp dirs, g++ compile/run, concurrency limit
  services/           sessions, dsaService (judge), repoService, aiService, report
  content/catalog.js  loads and validates problems and repos at startup
  util/               safePath, semaphore, rateLimiter, rng, body
content/
  problems/<id>/      meta.json, statement.md, starter.cpp, tests.js
  repos/<id>/         run.sh, .meta.json, any source files
public/               UI (no inline scripts or styles; CSP compatible)
test/                 node:test suite (unit, HTTP integration, real g++ judging)
testdata/             reference solutions and known-good repo fixes used by the tests
```

## API

| Method | Path                           | Purpose                                                               |
| ------ | ------------------------------ | --------------------------------------------------------------------- |
| GET    | `/api/health`                  | Liveness and AI provider status                                       |
| GET    | `/api/catalog`                 | Problems, repos and timer settings                                    |
| POST   | `/api/sessions`                | Start a test `{repoId?, dsaCount?}` or `{repoId?, problemIds?: [..]}` |
| POST   | `/api/sessions/:id/dsa/sample` | Run code on custom input `{problemId, code, input}`                   |
| POST   | `/api/sessions/:id/dsa/run`    | Judge against hidden tests `{problemId, code}`                        |
| POST   | `/api/sessions/:id/repo/run`   | Run a repo's `run.sh` `{files}`                                       |
| POST   | `/api/sessions/:id/ai`         | Ask the helper `{question, files, testOutput}`                        |
| POST   | `/api/sessions/:id/report`     | Final report `{secondsSpent: {dsa, repo}}`                            |

Errors are always `{ "error": { "code", "message" } }`.

## Bundled content

| DSA problems           | Topics                      | Trap in the large tests                   |
| ---------------------- | --------------------------- | ----------------------------------------- |
| Longest Subarray Sum K | prefix sums, hashing        | O(n^2) brute force is TLE                 |
| Merge Intervals        | sorting, intervals          | big output, touching intervals            |
| Number of Islands      | BFS/DFS on a grid           | 1000x1000 single island crashes recursion |
| Minimum Eating Speed   | binary search on the answer | linear scan over speeds is TLE            |
| Coin Change            | dynamic programming         | naive recursion is TLE                    |
| Top K Frequent         | hashing, sorting            | tie-breaking, large n                     |
| Course Schedule        | graphs, topological sort    | 500k-node chain crashes recursive DFS     |
| Running Median         | two heaps, data stream      | sorted-insert is TLE                      |
| Longest Substring K    | sliding window              | O(n^2) scan is TLE                        |

| Backend repos    | Difficulty | Failing | Themes                                                        |
| ---------------- | ---------- | ------- | ------------------------------------------------------------- |
| Wallet (warm-up) | easy       | 5 / 6   | idempotency, validation                                       |
| Ticket system    | medium     | 8 / 14  | workflow, pagination, SLA across 4 layers                     |
| API rate limiter | medium     | 6 / 11  | token bucket, sliding window, floating point, eviction        |
| Order service    | hard       | 6 / 13  | all-or-nothing reservation, overflow, rollback, state machine |
| Job queue        | hard       | 6 / 12  | leases, retries, exponential backoff, dead jobs, boundaries   |
| LRU cache + TTL  | hard       | 7 / 12  | recency, expiry boundary, negative caching, templates         |

## Adding content

Every problem and repo must ship a **verified solution**; the test suite enforces it, so unsolvable or
mis-described content cannot be merged.

**New DSA problem:** create `content/problems/<id>/` with

- `meta.json`: `{ "title", "difficulty", "topics": [], "timeLimitMs", "seed" }`
- `statement.md`, `starter.cpp`
- `tests.js` exporting `cases(rng)` that returns `[{ input, expected, large? }]`. Use the seeded `rng` so tests are reproducible. Include at least one large case that defeats the naive approach.
- Add a correct C++ solution to `SOLUTIONS` in `testdata/solutions.js` (and a `SLOW` one if there is a trap).

**New backend repo:** create `content/repos/<id>/` with a `run.sh` (build + run, print `PASS name` / `FAIL name` lines, exit non-zero on failure), a `README.md` stating the rules, the sources, and `.meta.json` with `title`, `difficulty`, `tags`, `totalTests`, `failingTests` and optionally `requires` (tools such as `["cmake"]`; the repo is hidden when one is missing). A CMake repo works too: see `content/repos/url-shortener` (its `run.sh` configures, builds and runs the test binary, which prints `PASS`/`FAIL` lines; it also registers the tests with ctest). Put bugs in different layers, add at least one bug whose symptom shows up in a different layer, and add the fixes to `testdata/repoFixes.js`.

Content is validated at startup, so mistakes fail fast.

## Development

```bash
npm test              # full suite; g++ tests are skipped automatically if g++ is missing
npm run format        # prettier
npm run dev           # restart on changes
```

CI (`.github/workflows/ci.yml`) runs format check and tests on every push.

## Security model (read before hosting for others)

Implemented: session isolation, strict input validation and size limits, path traversal protection,
per-IP rate limiting, bounded concurrency with back-pressure, wall-clock timeouts that kill the whole
process group, output caps, `ulimit` file/memory limits, scrubbed environment (user code cannot read
your API keys), temp dir cleanup, CSP and other security headers, server-side AI quota,
no secrets in logs, and defaults that bind to localhost.

Known limits: this runs **untrusted native code**. `ulimit` is not a security boundary, and submissions
can still use the network and CPU of the host. For anything public, run it in Docker (provided) and
preferably add stronger isolation (gVisor, nsjail or a dedicated VM), block egress from the container
except what the AI helper needs, and put it behind a reverse proxy with TLS. Sessions and rate limits are
in memory, so run a single instance. Timers are client side: this is a practice tool, not a proctoring system.

## Troubleshooting

- `g++: not found`: install a C++ compiler (`sudo apt install g++`).
- Old compilers: set `CPP_STD=c++14` (g++ 6 does not know `c++17`).
- `g++: not found` / `cmake: not found` in a run: install the tool (see Requirements). Missing cmake only hides the CMake repo.
- `AI provider error (404)`: the model name changed, set `GEMINI_MODEL`.
- `503 busy`: raise `MAX_CONCURRENT_RUNS` or wait; compiles are CPU heavy.
