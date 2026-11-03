'use strict';

class Heap {
  constructor(before) {
    this.a = [];
    this.before = before;
  }
  get size() {
    return this.a.length;
  }
  peek() {
    return this.a[0];
  }
  push(x) {
    const a = this.a;
    a.push(x);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (!this.before(a[i], a[p])) break;
      [a[i], a[p]] = [a[p], a[i]];
      i = p;
    }
  }
  pop() {
    const a = this.a;
    const top = a[0];
    const last = a.pop();
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let best = i;
        if (l < a.length && this.before(a[l], a[best])) best = l;
        if (r < a.length && this.before(a[r], a[best])) best = r;
        if (best === i) break;
        [a[i], a[best]] = [a[best], a[i]];
        i = best;
      }
    }
    return top;
  }
}

/** Two heaps: lower half (max-heap) and upper half (min-heap). */
function reference(values) {
  const low = new Heap((x, y) => x > y);
  const high = new Heap((x, y) => x < y);
  const out = [];
  for (const v of values) {
    if (low.size === 0 || v <= low.peek()) low.push(v);
    else high.push(v);
    if (low.size > high.size + 1) high.push(low.pop());
    else if (high.size > low.size) low.push(high.pop());
    out.push(low.peek());
  }
  return out;
}

/** @param {{int: (lo: number, hi: number) => number}} rng */
function cases(rng) {
  const randomArray = (n, bound) => Array.from({ length: n }, () => rng.int(-bound, bound));
  const raw = [[5, 15, 1, 3, 2], [7], [1, 2], [2, 1], [-5, -5, -5, 0], [3, 1, 4, 1, 5, 9, 2, 6]];
  for (let i = 0; i < 4; i++) raw.push(randomArray(15, 20));
  raw.push(randomArray(200000, 1e9));
  raw.push(Array.from({ length: 200000 }, (_, i) => i)); // increasing
  raw.push(Array.from({ length: 200000 }, (_, i) => 200000 - i)); // decreasing: worst case for insertion
  return raw.map((values) => ({
    input: `${values.length}\n${values.join(' ')}\n`,
    expected: reference(values).join(' '),
    large: values.length > 1000,
  }));
}

module.exports = { cases, reference };
