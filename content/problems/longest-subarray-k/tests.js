'use strict';

/**
 * Hidden tests for "Longest Subarray With Sum K".
 * Deterministic: the same seed always yields the same cases.
 */

function reference(values, k) {
  const firstSeen = new Map([[0, -1]]);
  let prefix = 0;
  let best = 0;
  values.forEach((value, index) => {
    prefix += value;
    if (firstSeen.has(prefix - k)) best = Math.max(best, index - firstSeen.get(prefix - k));
    if (!firstSeen.has(prefix)) firstSeen.set(prefix, index);
  });
  return best;
}

/** @param {{int: (lo: number, hi: number) => number}} rng */
function cases(rng) {
  const randomArray = (n, bound) => Array.from({ length: n }, () => rng.int(-bound, bound));
  const raw = [
    [[1, -1, 5, -2, 3], 3],
    [[-2, -1, 2, 1], 1],
    [[1, 2, 3], 10],
    [[5], 5],
    [[0, 0, 0], 0],
  ];
  for (let i = 0; i < 5; i++) raw.push([randomArray(12, 5), rng.int(-3, 3)]);
  raw.push([randomArray(200000, 1000), 0], [randomArray(200000, 1000), 17]);

  return raw.map(([values, k]) => ({
    input: `${values.length} ${k}\n${values.join(' ')}\n`,
    expected: String(reference(values, k)),
    large: values.length > 1000,
  }));
}

module.exports = { cases, reference };
