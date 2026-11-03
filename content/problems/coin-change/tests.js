'use strict';

function reference(coins, amount) {
  const INF = Number.MAX_SAFE_INTEGER;
  const dp = new Array(amount + 1).fill(INF);
  dp[0] = 0;
  for (let a = 1; a <= amount; a++) {
    for (const c of coins) if (c <= a && dp[a - c] + 1 < dp[a]) dp[a] = dp[a - c] + 1;
  }
  return dp[amount] === INF ? -1 : dp[amount];
}

/** @param {{int: (lo: number, hi: number) => number}} rng */
function cases(rng) {
  const distinct = (n, max) => {
    const set = new Set();
    while (set.size < n) set.add(rng.int(1, max));
    return [...set];
  };
  const raw = [
    [[1, 2, 5], 11],
    [[2], 3],
    [[1], 0],
    [[186, 419, 83, 408], 6249],
    [[2, 4], 7],
    [[5, 10], 25],
  ];
  for (let i = 0; i < 4; i++) raw.push([distinct(5, 30), rng.int(0, 200)]);
  raw.push([distinct(100, 1000), 100000]);
  raw.push([[99991, 99989, 7919], 100000]);
  raw.push([distinct(100, 100000), 99999]);
  return raw.map(([coins, amount]) => ({
    input: `${coins.length} ${amount}\n${coins.join(' ')}\n`,
    expected: String(reference(coins, amount)),
    large: amount > 10000,
  }));
}

module.exports = { cases, reference };
