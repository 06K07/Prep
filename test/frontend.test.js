'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (file) => fs.readFileSync(path.join(__dirname, '..', 'public', file), 'utf8');

test('every element id used by app.js exists in index.html', () => {
  const html = read('index.html');
  const js = read('app.js');
  const used = new Set([...js.matchAll(/\$\('([a-z0-9-]+)'\)/g)].map((m) => m[1]));
  const defined = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]));
  const missing = [...used].filter((id) => !defined.has(id));
  assert.deepEqual(missing, [], `ids referenced in app.js but missing in index.html: ${missing}`);
});

test('the page has no inline scripts or styles (CSP)', () => {
  const html = read('index.html');
  assert.ok(!/<script(?![^>]*\bsrc=)/.test(html), 'inline <script>');
  assert.ok(!/\sstyle=/.test(html), 'inline style attribute');
  assert.ok(!/\son(click|change|input|keydown)=/.test(html), 'inline event handler');
});
