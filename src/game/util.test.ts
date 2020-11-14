import { nextKey } from './util';

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
