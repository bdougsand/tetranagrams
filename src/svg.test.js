import { Shapes, makePath, startPoint } from './svg';
import { getCoordinates } from './App';

test('renders learn react link', () => {
  console.log(makePath(Shapes[2]));
});

test('converts shape to coordinates', () => {
  expect(getCoordinates([0, 0], ['** ', ' **'])).toEqual([[0, 0], [1, 0], [1, 1], [2, 1]]);

  expect(startPoint(['**'])).toEqual([0, 0]);
});
