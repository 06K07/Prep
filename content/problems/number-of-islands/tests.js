'use strict';

/** Iterative flood fill so the reference never overflows the stack. */
function reference(grid) {
  const R = grid.length;
  const C = grid[0].length;
  const seen = grid.map((row) => Array.from(row, () => false));
  let islands = 0;
  for (let i = 0; i < R; i++) {
    for (let j = 0; j < C; j++) {
      if (grid[i][j] !== '1' || seen[i][j]) continue;
      islands++;
      const stack = [[i, j]];
      seen[i][j] = true;
      while (stack.length) {
        const [x, y] = stack.pop();
        for (const [dx, dy] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ]) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx >= 0 && ny >= 0 && nx < R && ny < C && grid[nx][ny] === '1' && !seen[nx][ny]) {
            seen[nx][ny] = true;
            stack.push([nx, ny]);
          }
        }
      }
    }
  }
  return islands;
}

/** @param {{next: () => number, int: (lo: number, hi: number) => number}} rng */
function cases(rng) {
  const random = (R, C, density) =>
    Array.from({ length: R }, () =>
      Array.from({ length: C }, () => (rng.next() < density ? '1' : '0')).join(''),
    );
  const raw = [
    ['1100', '1001', '0011'],
    ['1'],
    ['0'],
    ['111', '010', '111'],
    ['101', '010', '101'],
    random(6, 8, 0.5),
    random(10, 10, 0.4),
    random(15, 12, 0.6),
    random(1, 30, 0.5),
    random(30, 1, 0.5),
    random(1000, 1000, 0.55),
    Array.from({ length: 1000 }, () => '1'.repeat(1000)), // one huge island: deep recursion crashes
    Array.from({ length: 1000 }, (_, i) =>
      i % 2 === 0 ? '1'.repeat(1000) : '0'.repeat(999) + '1',
    ), // snake
  ];
  return raw.map((grid) => ({
    input: `${grid.length} ${grid[0].length}\n${grid.join('\n')}\n`,
    expected: String(reference(grid)),
    large: grid.length * grid[0].length > 10000,
  }));
}

module.exports = { cases, reference };
