import * as React from 'react';


export const Shapes = [
  ['* ',
   '* ',
   '**'],
  ['**',
   '* ',
   '*'],
  ['* ',
   '**',
   '* '],
  ['* ',
   '**',
   ' *'],
  ['** ',
   ' **'],
  ['****'],
  ['**',
   '**'],
];

function hit(x, y, dx, dy, shape) {
  if (dx) {
    const col = Math.min(x, x+dx);
    const cellA = shape[y-1] && shape[y-1][col] || ' ';
    const cellB = shape[y] && shape[y][col] || ' ';
    return cellA === cellB;
  } else if (dy) {
    const row = Math.min(y, y + dy);
    const cellA = shape[row] && shape[row][x-1] || ' ';
    const cellB = shape[row] && shape[row][x] || ' ';
    return cellA === cellB;
  }

  return false;
}

export function startPoint(shape) {
  for (let r = 0, l = shape.length; r < l; ++r) {
    const row = shape[r];
    for (let c = 0, cs = row.length; c < cs; ++c) {
      if (row[c] !== ' ')
        return [c, r];
    }
  }
}

export function makePath(shape) {
    // Current positions
  let [x, y] = startPoint(shape);
  const end = [x, y];
  // The current x and y directions
  let dy = 0, dx = 1;

  const points = [[x, y]];

  const checkHit = () => hit(x, y, dx, dy, shape);

  while (1) {
    // Check if we can move in the current direction
    if (checkHit()) {
      points.push([x, y]);

      ([dx, dy] = [dy, dx]); // turn right

      if (checkHit())
        ([dx, dy] = [-dx, -dy]); // turn left

      if (checkHit())
        break; // can't go anywhere...
    }
    x += dx;
    y += dy;
    if (x === end[0] && y === end[1])
      break;
  }

  return points;
}

export const TetrominoShape = ({ shape, ...props }) => (
  <svg viewBox="0 0 3 3" {...props} >
    <path d={'M ' + makePath(shape).map(([x, y]) => `${x},${y}`).join(' ') + 'Z'} />
  </svg>
);
