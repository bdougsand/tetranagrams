import type {
  BoardState,
  PieceData,
  PlacedPiece,
  PlacedPieceData,
  Coord,
  Shape,
  CellData
} from './eventReducer';
import type { GameState } from './state';


type HasBoard = Pick<GameState, 'board' | 'pieces'>;

const isBlank = (board: BoardState, row: number, column: number): boolean =>
  !(row in board) || !(column in board[row]) || !board[row][column];

export const isValidCoord = ({rows, columns}: Pick<GameState, 'rows' | 'columns'>, [y, x]: Coord) =>
  x >= 0 && x < columns && y >= 0 && y < rows;

export const getLetter = (game: HasBoard, row: number, column: number): string => {
  const piece = game.pieces[game.board[column]?.[row]?.id];

  return piece && piece.type === 'tile' ? piece.letter : null;
}

const pi_2 = Math.PI / 2;
const rotate = (x: number, y: number, steps: number = 1) =>
  ([x * Math.cos(pi_2 * steps) - y * Math.sin(pi_2 * steps),
    x * Math.sin(pi_2 * steps) + y * Math.cos(pi_2 * steps)]);

/**
 * convert array of strings into an array of relative coordinates, relative to the top left [0,0] of shape, unrotated
 */
export const getCoordinates = (anchor: Coord, shape: Shape, rotation: number = 0): number[][] => {
  const boardCoordinates = [];
  const yMax = shape.length - 1;
  shape.forEach((str, yIdx) => {
    Array.from(str).forEach((cel, xIdx) => {
      if (cel !== ' ') {
        const [x, y] = rotation ? rotate(xIdx, yIdx, rotation) : [xIdx, yIdx];
        boardCoordinates.push([anchor[0] + x, yMax - (anchor[1] + y)]);
      }
    })
  })
  return boardCoordinates;
}

const getPieceCoordinates = (piece: PlacedPiece) => {
  if (piece.type === 'tile')
    return [[piece.x, piece.y]];
  else if (piece.type === 'tetromino')
    return getCoordinates([piece.x, piece.y], piece.shape);
}

export function canPlace(board: BoardState, piece: PieceData, coord: Coord): boolean {
  /// XXX This doesn't seem to handle coordinates outside the board!
  const coords = piece.type === 'tile' ? [coord] : getCoordinates(coord, piece.shape);
  for (const [col, row] of coords)
    if (!isBlank(board, row, col))
      return false;
  return true;
}

export function setPieceCoord<T extends HasBoard>(game: T, piece: PieceData & Partial<PlacedPieceData>, coord: Coord): T {
  const newPiece = { ...piece, x: coord[0], y: coord[1] };
  game.pieces[piece.id] = newPiece;

  if ('x' in piece) {
    for (const [x, y] of getPieceCoordinates(piece as PlacedPiece)) {
      if (game.board[y]?.[x]?.id === piece.id)
        game.board[y][x] = null;
    }
  }

  for (const [x, y] of getPieceCoordinates(newPiece)) {
    if (!game.board[y])
      game.board[y] = [];
    game.board[y][x] = { id: piece.id };
  }

  return game;
}

/**
 * Move a piece to the specified coordinates
 */
export function swapPiece(game: GameState, dest: Coord, pieceID=game.swapping) {
  const [col, row] = dest;
  const piece = game.pieces[pieceID];
  const newBoard = game.board.map(row => [...row]);
  newBoard[row][col] = null;
  if (!canPlace(newBoard, piece, dest))
    return game;

  let newGame = setPieceCoord({
    ...game,
    board: newBoard,
    pieces: { ...game.pieces },
    swapping: null,
  }, piece, dest);

  // Moving a placed piece:
  if ('x' in piece) {
    const otherPieceId = game.board[row]?.[col]?.id;
    if (otherPieceId) {
      newGame = setPieceCoord(newGame, game.pieces[otherPieceId], [piece.x, piece.y]);
    }
  } else {
    let found = false;
    const trayTiles = newGame.trayTiles.filter(data => {
      if (data.id === pieceID) {
        found = true;
        return false;
      }

      return true;
    });

    if (found)
      newGame.trayTiles = trayTiles;
  }

  return newGame;
}

// export function dropPiece(game: GameState): GameState {
//   const { board, dropping, selectedColumn } = game;

//   if (!dropping) {
//     return game;
//   }

//   // debugger;
//   const row = findLanding(board, dropping, selectedColumn);

//   // Game over!
//   if (row < 0)
//     return game;

//   const newBoard = board.slice().map(row => row.slice());
//   const piece = { ...dropping, x: selectedColumn, y: row };
//   const newGame = {
//     ...game,
//     board: newBoard,
//     dropping: null,
//     pieces: { ...game.pieces, [dropping.id]: piece }
//   };

//   return setPieceCoord(newGame, piece, [selectedColumn, row]);
// }

export function findLanding(board: BoardState, piece: PieceData, column: number): number {
  let row = board.length - 1;

  while (row >= 0) {
    if (!canPlace(board, piece, [column, row]))
      break;

    --row;
  }

  return (row + 1 >= board.length) ? -1 : row + 1;
}

export function getTiles(game: GameState, coords: Coord[]): PlacedPiece[] {
  return coords.map(([x, y]) => game.pieces[game.board[y][x].id]) as PlacedPiece[];
}

type Direction = [(-1 | 0 | 1), (-1 | 0 | 1)];
export function traceChain(game: GameState, coord: Coord, dir: Direction): Coord[] {
  let [x, y] = coord;
  const [dx, dy] = dir
  const pieces: Coord[] = []

  if (game.board[y][x] === null) return null;

  while (game.board[y += dy]?.[x += dx]) {
    pieces.push([x, y])
  }

  return pieces
}

export function getTileChains(game: GameState, coord: Coord): PlacedPiece[][] {
  const dirs: Direction[] = [[1, 0], [0, -1]];
  const chains: PlacedPiece[][] = [];

  for (const [dx, dy] of dirs) {
    const tail: Coord[] = traceChain(game, coord, [dx, dy])
    if (!tail) continue;

    const head: Coord[] = traceChain(game, coord, [-dx, -dy] as Direction)
    if (head.length + tail.length < 1) continue;

    const chain: Coord[] = [...head.reverse(), coord, ...tail]
    chains.push(getTiles(game, chain))
  }

  return chains;
}

export function isSupported(game: GameState, pieceId: number): boolean {
  const piece = game.pieces[pieceId];

  if (!('x' in piece))
    return true;

  const { x, y } = piece;

  if (y === 0) return true;
  if (piece.type === 'tile') {
    const below = game.board[y - 1]?.[x];
    return below ? isSupported(game, below.id) : false;
  } else if (piece.type === 'tetromino') {
    //
    const coordinates = getCoordinates([x, y], piece.shape);
    for (let i = 0; i < coordinates.length; i++) {
      if (y === 0) return true;
      const below = game.board[y - 1]?.[x];
      if (!below || piece.id === below.id) continue;
      if (isSupported(game, below.id)) {
        return true
      };
    }

    return false;
  }
}

export function findUnsupported(game: GameState) {
  return Object.values(game.pieces)
    .filter(piece => !isSupported(game, piece.id)) as PlacedPiece[];
}

export function defaultMerger(data: CellData, other: any) {
  return Object.assign(data, other);
}

type BoardCellIteratorItem<T = CellData> = [Coord, T];
type BoardCellIterator<T = CellData> = Iterable<BoardCellIteratorItem<T>>;

type BoardIteratorItem<T = CellData> = BoardCellIteratorItem<{ piece: PieceData, cell: T }>;
type BoardIterator<T = CellData> = Iterable<BoardIteratorItem<T>>;

type CellDataGetter<T> = (column: number, row: number) => T;
export function *iterCells<T>(rows: number, columns: number, getData: CellDataGetter<T>): BoardCellIterator<T> {
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < columns; x++) {
      yield [[x, y], getData(x, y)]
    }
  }
}

export function *iterPieces(game: GameState): BoardIterator {
  yield *iterCells(game.rows, game.columns,
                   (x, y) => {
                     const cell = game.board[y][x];
                     return { cell, piece: cell ? game.pieces[cell.id] : null };
                   });
}

export function *iterOpponentBoard(game: GameState, userId: string){
  const { knownBoard } = game.players.get(userId);
  yield *iterCells(game.rows, game.columns,
                   (x, y) => {
                     const key = `${x},${y}`;
                     const known = knownBoard.get(key);

                     return {
                       piece: known && known.letter &&
                         { letter: known.letter, type: 'tile', id: null } as PieceData,
                       cell: known && Object.assign({ id: null }, known)
                     };
                   });
}
