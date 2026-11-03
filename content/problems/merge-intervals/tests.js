'use strict';

function reference(intervals) {
  const sorted = [...intervals].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const merged = [];
  for (const [l, r] of sorted) {
    const last = merged[merged.length - 1];
    if (last && l <= last[1]) last[1] = Math.max(last[1], r);
    else merged.push([l, r]);
  }
  return merged;
}

/** @param {{int: (lo: number, hi: number) => number}} rng */
function cases(rng) {
  const raw = [
    [
      [1, 3],
      [2, 6],
      [8, 10],
      [15, 18],
    ],
    [
      [1, 4],
      [4, 5],
    ],
    [[5, 5]],
    [
      [1, 10],
      [2, 3],
      [4, 5],
    ],
    [
      [6, 7],
      [2, 4],
      [5, 5],
      [0, 1],
    ],
  ];
  for (let i = 0; i < 5; i++) {
    raw.push(
      Array.from({ length: 10 }, () => {
        const l = rng.int(0, 40);
        return [l, l + rng.int(0, 6)];
      }),
    );
  }
  raw.push(
    Array.from({ length: 100000 }, () => {
      const l = rng.int(0, 1e9 - 1000);
      return [l, l + rng.int(0, 1000)];
    }),
  );
  raw.push(Array.from({ length: 100000 }, (_, i) => [i * 3, i * 3 + 1])); // all disjoint
  return raw.map((intervals) => ({
    input: `${intervals.length}\n${intervals.map(([l, r]) => `${l} ${r}`).join('\n')}\n`,
    expected: reference(intervals)
      .map(([l, r]) => `${l} ${r}`)
      .join(' '),
    large: intervals.length > 1000,
  }));
}

module.exports = { cases, reference };
