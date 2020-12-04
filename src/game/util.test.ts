import { concat, nextKey, range, reduce } from './util';

test('nextKey()', () => {
  const m = new Map([[1, 2], [3, 4], [5, 6], [7, 8]]);

  const keys = Array.from(m.keys());

  for (const repeats of [1, 2]) {
    let k = null;
    const result = [];
    for (let i = 0, l = m.size*repeats; i < l; i++) {
      k = nextKey(m, k);
      result.push(k);
    }

    const check = Array.prototype.concat.call([], ...Array(repeats).fill(keys));
    expect(result).toStrictEqual(check);
  }

  {
    const emptyM = new Map();
    expect(nextKey(emptyM)).toBeUndefined();
  }

  expect(nextKey(m)).toStrictEqual(1);
});

test('reduce()', () => {
  expect(reduce(range(0, 10), (a, b) => (a+b))).toEqual(45);
  expect(reduce(range(5, 10), (m, n) => Object.assign(m, { [n]: 1 }), {}))
    .toStrictEqual({ 5: 1, 6: 1, 7: 1, 8:1, 9: 1 });
});

test('concat', () => {
  expect(Array.from(concat(range(0, 5), range(5, 10))))
    .toStrictEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
});
