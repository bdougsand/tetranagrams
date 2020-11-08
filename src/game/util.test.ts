import { nextKey } from './util';

test('nextKey()', async () => {
  const m = new Map([[1, 2], [3, 4], [5, 6], [7, 8]]);

  const keys = Array.from(m.keys());

  {
    let k = keys[0];
    const result = [k];
    for (let i = 0, l = m.size-1; i < l; i++) {
      k = nextKey(m, k);
      result.push(k);
    }

    expect(result).toStrictEqual(keys);
  }
});
