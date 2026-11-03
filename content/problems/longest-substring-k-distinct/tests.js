'use strict';

function reference(s, k) {
  const counts = new Map();
  let left = 0;
  let best = 0;
  for (let right = 0; right < s.length; right++) {
    counts.set(s[right], (counts.get(s[right]) || 0) + 1);
    while (counts.size > k) {
      const c = s[left++];
      counts.set(c, counts.get(c) - 1);
      if (counts.get(c) === 0) counts.delete(c);
    }
    best = Math.max(best, right - left + 1);
  }
  return best;
}

/** @param {{int: (lo: number, hi: number) => number}} rng */
function cases(rng) {
  const randomString = (n, alphabet) =>
    Array.from({ length: n }, () => String.fromCharCode(97 + rng.int(0, alphabet - 1))).join('');
  const raw = [
    ['eceba', 2],
    ['aa', 1],
    ['a', 1],
    ['abcabcabc', 3],
    ['abaccc', 2],
    ['abc', 26],
  ];
  for (let i = 0; i < 5; i++) raw.push([randomString(20, 5), rng.int(1, 4)]);
  raw.push([randomString(200000, 26), 5]);
  raw.push(['ab'.repeat(100000), 1]);
  raw.push(['a'.repeat(200000), 1]);
  raw.push([randomString(200000, 3), 2]);
  return raw.map(([s, k]) => ({
    input: `${s.length} ${k}\n${s}\n`,
    expected: String(reference(s, k)),
    large: s.length > 1000,
  }));
}

module.exports = { cases, reference };
