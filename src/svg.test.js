import { Shapes, makePath, startPoint } from './svg';
import { getCoordinates, isSupported, addPiece } from './App';
import { textChangeRangeIsUnchanged } from 'typescript';

test('renders learn react link', () => {
  console.log(makePath(Shapes[2]));
});

test('converts shape to coordinates', () => {
  expect(getCoordinates([0, 0], ['** ', ' **'])).toEqual([[0, 0], [1, 0], [1, 1], [2, 1]]);

  expect(startPoint(['**'])).toEqual([0, 0]);
});

const game = {
  board: [
    [],
    [],
    [{ id: 0 }],
    []
  ],
  pieces: {
    0: {
      id: 0,
      type: 'tile',
      x: 0,
      y: 2,
    }
  }
};

it('should identify unsupported pieces', () => {
  expect(isSupported(game, 0)).toBeFalsy();

  addPiece(game, { id: 1, type: 'tetromino', x: 6, y: 6, shape: Shapes[0] }, [6, 6]);
  console.log(game);
});