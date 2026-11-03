'use strict';

function reference(values, k) {
  const counts = new Map();
  for (const v of values) counts.set(v, (counts.get(v) || 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0] - b[0])
    .slice(0, k)
    .map(([value]) => value);
}

/** @param {{int: (lo: number, hi: number) => number}} rng */
function cases(rng) {
  const randomArray = (n, bound) => Array.from({ length: n }, () => rng.int(-bound, bound));
  const raw = [
    [[1, 1, 1, 2, 2, 3], 2],
    [[1], 1],
    [[4, 4, 5, 5, 6, 6], 3],
    [[-1, -1, -2, -2, 0], 2],
    [[7, 7, 7, 7], 1],
  ];
  for (let i = 0; i < 5; i++) {
    const values = randomArray(20, 4);
    raw.push([values, rng.int(1, new Set(values).size)]);
  }
  const bigSmallRange = randomArray(200000, 1000);
  raw.push([bigSmallRange, 10]);
  const bigWide = randomArray(200000, 1e9);
  raw.push([bigWide, 1000]);
  const bigAllSame = Array.from({ length: 200000 }, () => 5);
  raw.push([bigAllSame, 1]);
  return raw.map(([values, k]) => ({
    input: `${values.length} ${k}\n${values.join(' ')}\n`,
    expected: reference(values, k).join(' '),
    large: values.length > 1000,
  }));
}

module.exports = { cases, reference };
