import { zip } from '../util/iter';
import { PerTileLetterCounts, WildCard } from './constants';
import type {
  BoardState,
  PieceData,
  PlacedPiece,
  PlacedPieceData,
  Coord,
  Shape,
  CellData,
  PlacedTile,
  KnownBoard
} from './eventReducer';
import type { GameState } from './state';


export type HasBoard = Pick<GameState, 'board' | 'pieces'>;
export type HasGrid = Pick<GameState, 'rows' | 'columns'>;
type Direction = [(-1 | 0 | 1), (-1 | 0 | 1)];

const LegalDirs: Direction[] = [[0, -1], [1, 0]];

const isBlank = (board: BoardState, row: number, column: number): boolean =>
  !(row in board) || !(column in board[row]) || !board[row][column];

export const normalizeChar = (c: string) =>
  c.normalize('NFD')[0].toUpperCase();


/// XXX Use 'TileLetter' instead of string...
export const letterMatches = (tileLetter: string, letter: string) =>
  tileLetter === letter || tileLetter === WildCard || tileLetter === normalizeChar(letter);

export const isValidCoord = ({rows, columns}: HasGrid, [x, y]: Coord) =>
  x >= 0 && x < columns && y >= 0 && y < rows;

export const isValidDir = (d: [number, number]) =>
  Array.isArray(d) && LegalDirs.some(([dx, dy]) => (d[0] === dx && d[1] === dy));

export const getLetter = (game: HasBoard, column: number, row: number): string => {
  const piece = game.pieces[game.board[row]?.[column]?.id];

  return piece && piece.type === 'tile' ? piece.letter : null;
}

const pi_2 = Math.PI / 2;
const rotate = (x: number, y: number, steps: number = 1) =>
  ([x * Math.cos(pi_2 * steps) - y * Math.sin(pi_2 * steps),
    x * Math.sin(pi_2 * steps) + y * Math.cos(pi_2 * steps)]);

///// This probably belongs in another file
export function getLetterCounts(players: number, width: number, height: number) {
  const totalTiles = players * width * height;
  let count = 0;

  const letterCounts = Object.keys(PerTileLetterCounts).reduce(
    (lc, l) => {
      count += (lc[l] = Math.ceil(totalTiles * PerTileLetterCounts[l]));
      return lc;
    }, {} as { [k in string]: number });

  // Ensure that all players will get an equal number of tiles; pad the pool
  // with wildcard tiles
  letterCounts[WildCard] += players - (count % players);

  return letterCounts;
}

export function makePool(letterCounts: ReturnType<typeof getLetterCounts>) {
  const pool: string[] = [];
  for (const letter of Object.keys(letterCounts)) {
    for (let i = letterCounts[letter]; i > 0; --i)
      pool.push(letter);
  }
  return pool;
}

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
  });
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
export function swapPiece(game: GameState, dest: Coord, pieceID: number) {
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

export function readLetters(game: GameState, coord: Coord, dir: Direction) {
  const chain = traceChain(game, coord, dir);
  return chain ?
    getTiles(game, [coord].concat(chain))
      .map(piece => getLetter(game, piece.x, piece.y))
    : [];
}

export function normalizeWord(word: string) {
  return Array.from(
    word.normalize('NFC'),
    lett => {
      const nl = lett.normalize('NFD')[0].toUpperCase();
      return nl in PerTileLetterCounts ? nl : '';
    }
  ).join('');
}

export function wordMatches(game: GameState, word: string, coord: Coord, dir: Direction) {
  word = normalizeWord(word);
  console.log(word);
  for (const [actual, letter] of zip(readLetters(game, coord, dir), word)) {
    if (!letterMatches(actual, letter))
      return false;
  }

  return true;
}


export function getTileChains(game: GameState, coord: Coord): PlacedPiece[][] {
  const dirs = LegalDirs;
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

/**
 *  Find groups of connected tiles. Returns an array of arrays of piece IDs.
 */
export function getIslands(game: Pick<GameState, 'pieces' | 'board'>) {
  const assignments: { [k in string]: string } = {};
  const sets: { [k in string]: string[] } = {};

  const addToSet = (s: string, id: string) => {
    assignments[id] = s;
    if (!sets[s]) sets[s] = [];
    sets[s].push(id);
  };
  const mergeSets = (s1: string, s2: string) => {
    if (s1 === s2) return s1;

    const oldS = s1 < s2 ? s1 : s2;
    const newS = s1 < s2 ? s2 : s1;

    for (const id of sets[oldS]) {
      assignments[id] = newS;
      sets[newS].push(id);
    }

    delete sets[oldS];
    return newS;
  };

  const dirs: Direction[] = [[-1, 0], [1, 0], [0, -1], [0, 1]];

  let nextSet = 1;
  for (const pieceId of Object.keys(game.pieces)) {
    const piece = game.pieces[pieceId];
    if (!('x' in piece))
      continue;

    let thisSet = assignments[pieceId];
    if (!thisSet) {
      thisSet = (nextSet++).toString(36).padStart(2, '0');
      addToSet(thisSet, pieceId);
    }

    for (const [dx, dy] of dirs) {
      const otherPieceId = game.board[piece.y + dy]?.[piece.x + dx]?.id;

      if (!otherPieceId)
        continue;

      const otherSet = assignments[otherPieceId];
      if (otherSet) {
        thisSet = mergeSets(thisSet, otherSet);
      } else {
        addToSet(thisSet, '' + otherPieceId);
      }
    }
  }

  return Object.values(sets);
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

/**
 * Iterates over every cell of the board
 */
export function *iterPieces(game: HasBoard & HasGrid): BoardIterator {
  yield *iterCells(game.rows, game.columns,
                   (x, y) => {
                     const cell = game.board[y][x];
                     return { cell, piece: cell ? game.pieces[cell.id] : null };
                   });
}

export type BattleshipTile = PlacedTile & {
  hidden: boolean,
  guesserId?: string,
};

export function *iterBattleshipBoard(game: GameState, userId: string){
  const isMe = userId === game.myId;
  const { knownBoard } = game.players.get(userId);

  yield *iterCells(game.rows, game.columns,
                   (x, y) => {
                     const key = `${x},${y}`;
                     const known = knownBoard.get(key);
                     const myCell = isMe && game.board[y][x];
                     const myTile = myCell && game.pieces[myCell.id] as PlacedTile;
                     const myLetter = myTile?.letter;

                     return {
                       piece: {
                         letter: known?.letter || myLetter,
                         type: 'tile',
                         id: null,
                         x,
                         y,
                         hidden: myCell && !known,
                         guesserId: known?.guesserId,
                       } as BattleshipTile,
                       cell: known ?
                         Object.assign({ id: null }, known)
                         : (myCell || null)
                     };
                   });
}

/**
 * Checks each legal direction to check which substring (including the empty
 * string) of `word` will fit the known information about the board. Returns an
 * array of objects containing information about the partial and complete match
 * in each direction.
 */
export function fitWord(board: KnownBoard, coord: Coord, word: string, grid: HasGrid) {
  word = word.toLocaleUpperCase();
  const [x0, y0] = coord;
  const legalDirs = LegalDirs;

  let i = 0;
  let done = 0;

  const result = legalDirs.map(dir => ({ dir,
                                         tiles: [] as { x: number, y: number, letter: string }[],
                                         done: false,
                                         word: '' }))

  for (const c of word) {
    for (const dirResult of result) {
      if (dirResult.done)
        continue;

      const { dir: [dx, dy] } = dirResult;
      const x = x0 + dx*i;
      const y = y0 + dy*i;

      if (isValidCoord(grid, [x, y])) {
        const known = board.get(`${x},${y}`);
        const letter = known?.letter?.toLocaleUpperCase();

        if ((!letter && !known) || letterMatches(letter, c)) {
          dirResult.tiles.push({ x, y, letter: c });
          dirResult.word += c;
          continue;
        }
      }

      dirResult.done = true;
      done += 1;
    }

    if (done === result.length)
      break;

    i++;
  }

  return result;
}

/**
 * Returns an array of tiles that have not yet been revealed.
 */
export function hiddenTiles(game: Pick<GameState, 'players' | 'myId'> & HasBoard & HasGrid) {
  const known = game.players.get(game.myId).knownBoard;
  const pieces: PieceData[] = [];
  for (const [[x, y], { piece }] of iterPieces(game)) {
    if (piece && !known.has(`${x},${y}`))
      pieces.push(piece);
  }

  return pieces;
}
