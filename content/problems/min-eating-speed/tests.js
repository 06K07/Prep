'use strict';

function hoursNeeded(piles, k) {
  let hours = 0;
  for (const p of piles) hours += Math.ceil(p / k);
  return hours;
}

function reference(piles, h) {
  let lo = 1;
  let hi = Math.max(...piles);
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (hoursNeeded(piles, mid) <= h) hi = mid;
    else lo = mid + 1;
  }
  return lo;
}

/** @param {{int: (lo: number, hi: number) => number}} rng */
function cases(rng) {
  const randomPiles = (n, max) => Array.from({ length: n }, () => rng.int(1, max));
  const raw = [
    [[3, 6, 7, 11], 8],
    [[30, 11, 23, 4, 20], 5],
    [[30, 11, 23, 4, 20], 6],
    [[1], 1],
    [[1000000000], 1],
    [[1000000000], 1000000000],
  ];
  for (let i = 0; i < 4; i++) {
    const piles = randomPiles(8, 50);
    raw.push([piles, rng.int(piles.length, piles.length * 6)]);
  }
  for (let i = 0; i < 2; i++) {
    const piles = randomPiles(100000, 1e9);
    raw.push([piles, rng.int(100000, 400000)]);
  }
  return raw.map(([piles, h]) => ({
    input: `${piles.length} ${h}\n${piles.join(' ')}\n`,
    expected: String(reference(piles, h)),
    large: piles.length > 1000,
  }));
}

module.exports = { cases, reference };
