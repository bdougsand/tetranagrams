import { zip } from './iter';

test('zip', () => {
  expect(Array.from(zip([1, 2, 3], "abcd")))
        .toStrictEqual([[1, 'a'], [2, 'b'], [3, 'c']]);
})
