import * as React from 'react';
import './App.css';

import { Shapes, TetrominoShape } from './svg';

interface PlacedPieceData {
  x: number;
  y: number;
}

interface TileData {
  id: number;
  type: 'tile';
  letter: string;
}

type Shape = string[];
type Coord = [number, number];
interface TetrominoData {
  id: number;
  type: 'tetromino';
  shape: Shape;
}
type PieceData = TileData | TetrominoData;
type PlacedPiece = PieceData & PlacedPieceData;
type PlacedTile = TileData & PlacedPieceData;
type PieceId = number;

interface CellData {
  id: number;
};

type BoardState = CellData[][];
export interface GameState {
  pool: string[];
  board: BoardState;
  columns: number;
  rows: number;
  selectedColumn: number;
  _nextId: PieceId;
  dropping: PieceData;
  pieces: { [id in string]: PlacedPiece };

  swapping: PieceId;
  draggingOver: Coord;
}

// 

//https://hasbro-new.custhelp.com/app/answers/detail/a_id/19/~/how-many-of-each-letter-tile-are-included-in-a-scrabble-game%3F
const letters = {
  A: 9,
  B: 2,
  C: 2,
  D: 4,
  E: 12,
  F: 2,
  G: 3,
  H: 2,
  I: 9,
  J: 1,
  K: 1,
  L: 4,
  M: 2,
  N: 6,
  O: 8,
  P: 2,
  Q: 1,
  R: 6,
  S: 4,
  T: 6,
  U: 4,
  V: 2,
  W: 2,
  X: 1,
  Y: 2,
  Z: 1,
  Blank: 2
};

const randomIndex = (pool: any[]) => {
  return Math.floor(Math.random() * pool.length);
};

const initGame = (): GameState => {
  const columns = 6;
  const rows = 10;
  const pool = Object.keys(letters).reduce((pool, letter) => {
    for (let i = letters[letter]; i > 0; --i)
      pool.push(letter);
    return pool;
  }, []);

  return {
    pool,
    board: Array(rows).fill(null).map(() => Array(columns).fill(null)),
    columns,
    rows,
    selectedColumn: 0,
    dropping: null,
    _nextId: 1,
    swapping: null,
    draggingOver: null,
    pieces: {}
  };
};

const getShapeDimensions = (shape: Shape) => {
  const w = shape.reduce(((max, row) => Math.max(max, row.length)), 0);

  return [w, shape.length];
};

// check if TileData is a tetromino, then return all cells that are part of tetramino

//
//   ['** ', ' **'],
// [[0,0], [0, 1], [1,1], [1,2]];
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

export function getTiles(game: GameState, coords: Coord[]): PlacedPiece[] {
  return coords.map(([x, y]) => game.pieces[game.board[y][x].id]);
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

//   const pieces = game.pieces;
//   const { id: pieceID } = game.board[coord[1]][coord[0]];
//   const piece = pieces[pieceID];

//   return getTileChains;
// }

function drawLetter(game: GameState): GameState {
  if (game.dropping || !game.pool.length) {
    return game;
  }

  const idx = randomIndex(game.pool);
  const letter = game.pool[idx];
  const pool = game.pool.slice(0, idx).concat(game.pool.slice(idx + 1));
  const id = game._nextId;

  return {
    ...game,
    pool,
    dropping: { id, letter, type: 'tile' },
    _nextId: game._nextId + 1
  };
}

const isBlank = (board: BoardState, row: number, column: number): boolean =>
  !(row in board) || !(column in board[row]) || !board[row][column];

function canPlace(board: BoardState, piece: PieceData, coord: Coord): boolean {
  const coords = piece.type === 'tile' ? [coord] : getCoordinates(coord, piece.shape);
  for (const [col, row] of coords)
    if (!isBlank(board, row, col))
      return false;
  return true;
}

function findLanding(board: BoardState, piece: PieceData, column: number): number {
  let row = board.length - 1;

  while (row >= 0) {
    if (!canPlace(board, piece, [column, row]))
      break;

    --row;
  }

  return (row + 1 >= board.length) ? -1 : row + 1;
}

function dropPiece(game: GameState): GameState {
  const { board, dropping, selectedColumn } = game;

  if (!dropping) {
    return game;
  }

  // debugger;
  const row = findLanding(board, dropping, selectedColumn);

  // Game over!
  if (row < 0)
    return game;

  const newBoard = board.slice().map(row => row.slice());
  const piece = { ...dropping, x: selectedColumn, y: row };
  const newGame = {
    ...game,
    board: newBoard,
    dropping: null,
    pieces: { ...game.pieces, [dropping.id]: piece }
  };

  return setPieceCoord(newGame, piece, [selectedColumn, row]);
}

export function isSupported(game: GameState, pieceId: number): boolean {
  const piece = game.pieces[pieceId];
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

const getPieceCoordinates = (piece: PlacedPiece) => {
  if (piece.type === 'tile')
    return [[piece.x, piece.y]];
  else if (piece.type === 'tetromino')
    return getCoordinates([piece.x, piece.y], piece.shape);
}

/**
 * @param game Altered in place
 * @param piece 
 * @param coord 
 */
export function setPieceCoord(game: GameState, piece: PieceData & Partial<PlacedPieceData>, coord: Coord): GameState {
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


function findUnsupported(game: GameState) {
  return Object.values(game.pieces).filter(piece => !isSupported(game, piece.id));
}

function gameTick(game: GameState, tick: number) {
  const unsupported = findUnsupported(game);
  if (unsupported.length) {
    const newGame = {
      ...game,
      board: game.board.map(row => [...row]),
      pieces: { ...game.pieces },
    };
    for (const piece of unsupported) {
      setPieceCoord(newGame, piece, [piece.x, piece.y - 1]);
    }

    return newGame;
  }

  return game;
}

function dropTetromino(game: GameState, shape: Shape = randItem(Shapes)) {
  return dropPiece({
    ...game,
    dropping: { id: game._nextId, type: 'tetromino', shape },
    _nextId: game._nextId + 1
  });
}

function randItem<T>(xs: T[]): T {
  return xs[Math.floor(Math.random() * xs.length)];
}


function swapPiece(game: GameState, dest: Coord, pieceID=game.swapping) {
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

  const otherPieceId = game.board[row]?.[col]?.id;
  if (otherPieceId) {
    newGame = setPieceCoord(newGame, game.pieces[otherPieceId], [piece.x, piece.y]);
  }
  return newGame;
}

const gameReducer = (game: GameState, action: { type: string, payload?: any }) => {
  switch (action.type) {
    case 'SELECT_COLUMN':
      return {
        ...game,
        selectedColumn: action.payload.column
      };

    case 'TICK':
      return gameTick(game, action.payload);

    case 'DRAW_LETTER':
      return drawLetter(game);

    case 'DROP_LETTER':
      return dropPiece(game);

    case 'DRAW_N_DROP': {
      return ['DRAW_LETTER', 'DROP_LETTER'].map(type => ({ type })).reduce(gameReducer, game);
    }

    case 'DROP_TET': {
      return dropTetromino(game);
    }

    case 'START_SWAPPING': {
      return {
        ...game,
        swapping: action.payload.id
      };
    }

    case 'SWAP_WITH': {
      return swapPiece(game, [action.payload.column, action.payload.row]);
    }

    case 'DROP_TILE': {
      console.log(action);
      return swapPiece(game, action.payload.coords, action.payload.pieceID);
    }

    default:
      return game;
  }
};

const Tile: React.FC<{ tile: TileData }> = ({ tile }) =>
  <div className="tile" draggable data-pieceid={tile.id}>
    {tile.letter}
    </div>;

type BoardProps = {
  game: GameState,
  TileComponent?: React.ComponentType<{ tile: PlacedTile }>,
  dispatch: React.Dispatch<any>,
};

const Board: React.FC<BoardProps> =
  ({ game, TileComponent = Tile, dispatch }) => {
    const { board: data, columns, rows, selectedColumn, swapping } = game;
    const renderedIds = {};

    const [dragState, setDragState] = React.useState(null);

    const onDragStart = React.useCallback(e => {
      let target: HTMLElement = e.target as HTMLElement;
      while (target) {
        if (target.hasAttribute('data-pieceid'))
          break;
        target = target.parentElement;
      }

      if (!target) return;

      setDragState({ pieceID: parseInt(target.getAttribute('data-pieceid')) });
    }, []);

    const onDragOver = React.useCallback(e => {
      let target: HTMLElement = e.target as HTMLElement;
      while (target) {
        if (target.classList.contains('tile-wrapper'))
          break;
        target = target.parentElement;
      }

      if (target) {
        const coords = target.getAttribute('data-coords').split(',').map(s => parseInt(s));
        setDragState(state => (state && { ...state, draggedOver: coords }));
        e.preventDefault();
      }
    }, []);

    const onDrop = React.useCallback(e => {
      let target: HTMLElement = e.target as HTMLElement;
      while (target) {
        if (target.classList.contains('tile-wrapper'))
          break;
        target = target.parentElement;
      }

      if (target) {
        const coords = target.getAttribute('data-coords').split(',').map(s => parseInt(s));
        setDragState(state => {
          if (state)
            dispatch({ type: 'DROP_TILE', payload: { coords, pieceID: state.pieceID } });

          return null;
        });
        
        e.preventDefault();
      }
    }, [dispatch])

    return (
      <div className={"board" + (swapping ? ' swapping' : '')}
           onDragOver={onDragOver}
           onDragStart={onDragStart}
           onDrop={onDrop}
      >
        {new Array(columns).fill(1).map((_, i) => (
          <div className={'column-header ' + (i === selectedColumn ? 'selected' : '')}
            onClick={() => { dispatch({ type: 'SELECT_COLUMN', payload: { column: i } }) }}
          />
        ))}
        {data.map((row, r) => {
          return (
            row.map((tile, c) => {
              const id = tile?.id;
              if (id) {
                // if (renderedIds[id])
                //   return null;

                renderedIds[id] = true;
              }

              const blank = !tile;
              const piece = tile && game.pieces[id];
              const tetro = piece?.type === 'tetromino' && piece.shape;
              const row = rows - r + 1;

              const style = {
                gridColumnStart: c + 1,
                gridRowStart: row
              };
              let tetroClasses = '';

              if (tetro) {
                const [w, h] = getShapeDimensions(tetro);
                Object.assign(style, {
                  gridColumnEnd: c + 1 + w,
                  gridRowStart: row - (h - 1),
                  gridRowEnd: row + 1,
                });

                tetroClasses = w > h ? 'wide' : 'tall';
              }

              return (
                <div className={"tile-wrapper" + (blank ? ' blank' : '') +
                  (swapping === id ? ' swapping-tile' : '') +
                  (tetro ? ' tetromino' : '') +
                   (dragState && dragState.draggedOver && 
                    (dragState.draggedOver[0] === c && dragState.draggedOver[1] === r) ? ' drop-target' : '')
                }
                  data-coords={[c, r]}
                  onClick={e => {
                    if (swapping) {
                      dispatch({ type: 'SWAP_WITH', payload: { row: r, column: c } });
                    } else {
                      dispatch({ type: 'START_SWAPPING', payload: { id } });
                    }
                  }}
                  style={style}
                  key={id || `${c}-${r}`} >
                  {blank ? null :
                    tetro ? <TetrominoShape shape={tetro}
                      className={`tetromino ${tetroClasses}`}
                    /> :
                      <TileComponent tile={piece as PlacedTile} />}
                </div>
              );
            })
          );
        })}
      </div>
    );
  };


function App() {
  // pieces: move one at a time,
  const [game, dispatch] = React.useReducer(gameReducer, null, initGame);

  const swapping = game.pieces[game.swapping];
  const words = swapping && getTileChains(game, [swapping.x, swapping.y]).map(
    chain => chain.map(tile => tile.type === 'tile' ? tile.letter : '').join('')
  );

  return (
    <div className="App">
      <div>{game.pool.length} letter(s) remaining in the pool</div>
      <Board game={game} dispatch={dispatch} />
      <button onClick={() => dispatch({ type: 'DRAW_N_DROP' })}>
        Draw 'n' Drop
      </button>
    {words && <div>
        {words.map((word, i) => <div key={i}>{word}</div>)}
      </div>}
      {/* <button onClick={() => dispatch({ type: 'DROP_TET' })}>
        Drop Tetromino
      </button> */}
    </div>
  );
}

export default App;
