'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { createRng } = require('../util/rng');

const toolCache = new Map();

/** True when `tool --version` runs (used to hide repos whose toolchain is not installed). */
function defaultHasTool(tool) {
  if (!toolCache.has(tool)) toolCache.set(tool, spawnSync(tool, ['--version']).status === 0);
  return toolCache.get(tool);
}

const SKIPPED_DIRS = new Set(['build', 'node_modules']);

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function validateCases(id, generated) {
  if (!Array.isArray(generated) || generated.length === 0) {
    throw new Error(`problem "${id}": cases() returned no test cases`);
  }
  for (const c of generated) {
    if (typeof c.input !== 'string' || typeof c.expected !== 'string') {
      throw new Error(`problem "${id}": every case needs string "input" and "expected"`);
    }
  }
  return Object.freeze(generated);
}

function loadProblem(dir, id) {
  const meta = readJson(path.join(dir, 'meta.json'));
  for (const key of ['title', 'difficulty', 'timeLimitMs']) {
    if (meta[key] === undefined) throw new Error(`problem "${id}": meta.json is missing "${key}"`);
  }
  const { cases } = require(path.join(dir, 'tests.js'));
  if (typeof cases !== 'function') throw new Error(`problem "${id}": tests.js must export cases()`);

  let generated; // hidden tests can be large, so they are generated on first use
  return {
    id,
    meta,
    statement: fs.readFileSync(path.join(dir, 'statement.md'), 'utf8'),
    starter: fs.readFileSync(path.join(dir, 'starter.cpp'), 'utf8'),
    get cases() {
      if (!generated) generated = validateCases(id, cases(createRng(meta.seed ?? 1)));
      return generated;
    },
  };
}

function loadRepoFiles(base) {
  const files = {};
  (function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith('.') || SKIPPED_DIRS.has(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else
        files[path.relative(base, full).split(path.sep).join('/')] = fs.readFileSync(full, 'utf8');
    }
  })(base);
  return files;
}

function loadRepo(dir, id) {
  const metaFile = path.join(dir, '.meta.json');
  const meta = fs.existsSync(metaFile) ? readJson(metaFile) : { title: id };
  const files = loadRepoFiles(dir);
  if (!files['run.sh']) throw new Error(`repo "${id}": run.sh is required`);
  return { id, meta, files: Object.freeze(files) };
}

function loadAll(root, loader) {
  if (!fs.existsSync(root)) return new Map();
  const items = new Map();
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (entry.isDirectory() && !entry.name.startsWith('.')) {
      items.set(entry.name, loader(path.join(root, entry.name), entry.name));
    }
  }
  return items;
}

/** Removes repos that need a tool (meta.requires, e.g. ["cmake"]) which is not installed. */
function dropUnavailable(repos, hasTool) {
  const unavailable = [];
  for (const [id, repo] of repos) {
    const missing = (repo.meta.requires || []).filter((tool) => !hasTool(tool));
    if (missing.length) {
      repos.delete(id);
      unavailable.push({ id, missing });
    }
  }
  return unavailable;
}

/**
 * Loads and validates all problems and repos at startup (fail fast on bad content).
 * @param {string} contentDir
 * @param {{hasTool?: (tool: string) => boolean}} [options]
 */
function loadCatalog(contentDir, { hasTool = defaultHasTool } = {}) {
  const root = path.resolve(contentDir);
  const problems = loadAll(path.join(root, 'problems'), loadProblem);
  const repos = loadAll(path.join(root, 'repos'), loadRepo);
  const unavailable = dropUnavailable(repos, hasTool);
  if (problems.size === 0) throw new Error('No problems found in content/problems');
  if (repos.size === 0) throw new Error('No repos found in content/repos');

  const pick = (map, id) => {
    const ids = [...map.keys()];
    const chosen = id && id !== 'random' ? id : ids[Math.floor(Math.random() * ids.length)];
    return map.get(chosen) || null;
  };

  return {
    /** Repos hidden because a required tool is missing: [{ id, missing: [tool] }] */
    unavailable,
    getProblem: (id) => pick(problems, id),
    /** @returns {object[]} up to `count` distinct random problems */
    pickProblems: (count) => {
      const all = [...problems.values()];
      for (let i = all.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [all[i], all[j]] = [all[j], all[i]];
      }
      return all.slice(0, count);
    },
    getRepo: (id) => pick(repos, id),
    summary: () => ({
      problems: [...problems.values()].map(({ id, meta }) => ({
        id,
        title: meta.title,
        difficulty: meta.difficulty,
        topics: meta.topics || [],
      })),
      repos: [...repos.values()].map((r) => ({ id: r.id, ...r.meta })),
    }),
  };
}

module.exports = { loadCatalog };
