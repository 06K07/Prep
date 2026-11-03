'use strict';

/** Kahn's algorithm: true when the graph has no cycle. */
function reference(n, edges) {
  const indegree = new Array(n).fill(0);
  const adj = Array.from({ length: n }, () => []);
  for (const [a, b] of edges) {
    adj[a].push(b);
    indegree[b]++;
  }
  const queue = [];
  for (let i = 0; i < n; i++) if (indegree[i] === 0) queue.push(i);
  let seen = 0;
  for (let head = 0; head < queue.length; head++) {
    seen++;
    for (const next of adj[queue[head]]) if (--indegree[next] === 0) queue.push(next);
  }
  return seen === n;
}

/** @param {{int: (lo: number, hi: number) => number}} rng */
function cases(rng) {
  const raw = [
    [
      4,
      [
        [0, 1],
        [1, 2],
        [2, 3],
      ],
    ],
    [
      2,
      [
        [0, 1],
        [1, 0],
      ],
    ],
    [1, []],
    [1, [[0, 0]]],
    [
      3,
      [
        [0, 1],
        [1, 2],
        [0, 2],
      ],
    ],
    [
      4,
      [
        [0, 1],
        [1, 2],
        [2, 3],
        [3, 1],
      ],
    ],
  ];
  for (let i = 0; i < 6; i++) {
    const n = rng.int(2, 8);
    raw.push([
      n,
      Array.from({ length: rng.int(0, 10) }, () => [rng.int(0, n - 1), rng.int(0, n - 1)]),
    ]);
  }
  const N = 500000;
  raw.push([N, Array.from({ length: N - 1 }, (_, i) => [i, i + 1])]); // long chain: deep recursion crashes
  raw.push([N, [...Array.from({ length: N - 1 }, (_, i) => [i, i + 1]), [N - 1, 0]]]); // chain closed into a cycle
  raw.push([
    N,
    Array.from({ length: N }, () => {
      const a = rng.int(0, N - 2);
      return [a, rng.int(a + 1, N - 1)];
    }),
  ]); // random DAG
  return raw.map(([n, edges]) => ({
    input: `${n} ${edges.length}\n${edges.map(([a, b]) => `${a} ${b}`).join('\n')}\n`,
    expected: reference(n, edges) ? 'YES' : 'NO',
    large: n > 1000,
  }));
}

module.exports = { cases, reference };
