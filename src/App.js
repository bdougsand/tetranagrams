import React, { useEffect, useRef, useState } from 'react';
import logo from './logo.svg';
import './App.css';

import { Shapes, TetrominoShape } from './svg';

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

const randomIndex = pool => {
  return Math.floor(Math.random()*pool.length);
};

const initGame = () => {
  const pool = Object.keys(letters).reduce((pool, letter) => {
    for (let i = letters[letter]; i > 0; --i)
      pool.push(letter);
    return pool;
  }, []);

  return {
    pool,
    /** @type {BoardState} */
    board: [],
    columns: 4,
    rows: 10,
    selectedColumn: 0,
    /** @type {TileData} */
    lastLetter: null,
    _nextId: 1,
    /** @type {[number, number]} */
    swapping: null,
    /** @type {{ [k in number]: { shape: string[] } }} */
    tetrominos: {},
  };
};

/** @typedef {{ id: number, letter?: string, tetromino?: boolean } | ' '} TileData */

/** @type {(tile: TileData) => boolean} */
const isBlank = tile => (tile === ' ');

const isTetromino = tile => tile.tetromino;

// check if TileData is a tetromino, then return all cells that are part of tetramino

//
//   ['** ', ' **'],
// [[0,0], [0, 1], [1,1], [1,2]];

/**
 * convert array of strings into an array of relative coordinates, relative to the top left [0,0] of shape, unrotated
 * 
 * @param {number[]} coordinate
 * @param {string[]} tetromino 
 * @returns {number[][]}
 */
export const getCoordinates = (anchor, tetromino) => {
  const boardCoordinates = [];
  tetromino.forEach((str, yIdx) => {
    Array.from(str).forEach((cel, xIdx) => {
      if (cel !== ' '){
        boardCoordinates.push([anchor[0] + xIdx, anchor[1] + yIdx]);
      }
    })
  })
  console.log(boardCoordinates);
  return boardCoordinates;
}


//given actual coordinate of the top left, convert relative coordinates into board space coordinates

/** @typedef {ReturnType<typeof initGame>} GameState */

function drawLetter(game) {
  if (game.lastLetter || !game.pool.length) {
    return game;
  }

  const idx = randomIndex(game.pool);
  const letter = game.pool[idx];
  const pool = game.pool.slice(0, idx).concat(game.pool.slice(idx+1));

  return {
    ...game,
    pool,
    lastLetter: { letter, id: game._nextId },
    _nextId: game._nextId+1
  };
}

function findEmptyRow(board, column) {
  let row = board.length;

  while (row > 0) {
    if (!isBlank(board[row-1][column]))
      break;

    --row;
  }

  return row;
}

function dropLetter(game) {
  const { board, lastLetter, selectedColumn } = game;

  if (!lastLetter) {
    return game;
  }

  const row = findEmptyRow(board, selectedColumn);

  let newRow;
  if (board[row]) {
    newRow = [...board[row]];
  } else {
    if (board.length >= game.rows) {
      // Game over!
      return game;
    }

    newRow = Array(game.columns).fill(' ');
  }

  newRow.splice(selectedColumn, 1, lastLetter);
  const newBoard = board.slice();
  newBoard[row] = newRow;

  return {
    ...game,
    board: newBoard,
    lastLetter: null,
  };
}

/**
 * @param {GameState["board"]} board
 */
function findUnsupported(board) {
  const columnUnsupported = {};
  const found = [];

  for (let i = 0, rl = board.length; i < rl; i++) {
    for (let j = 0, cl = board[i].length; j < cl; j++) {
      const tile = board[i][j];
      if (isBlank(tile)) {
        columnUnsupported[j] = true;
      } else if (columnUnsupported[j]) {
        found.push([i, j]);
      }
    }
  }

  return found;
}

/**
 * @param {GameState} game
 */
function gameTick(game, tick) {
  const unsupported = findUnsupported(game.board);
  if (unsupported.length) {
    const newGame = {
      ...game,
      board: [...game.board.map(row => [...row])]
    };
    for (const [i, j] of unsupported) {
      newGame.board[i-1][j] = newGame.board[i][j];
      newGame.board[i][j] = ' ';
    }

    return newGame;
  }

  return game;
}

function dropTetromino(game) {
  const { board, selectedColumn, _nextId, tetrominos } = game;
  const row = findEmptyRow(board, selectedColumn);
  let newRow;
  if (board[row]) {
    newRow = [...board[row]];
  } else {
    if (board.length >= game.rows) {
      // Game over!
      return game;
    }

    newRow = Array(game.columns).fill(' ');
  }

  newRow.splice(selectedColumn, 1, {
    tetromino: true,
    id: _nextId
  });
  const newBoard = board.slice();
  newBoard[row] = newRow;

  return {
    ...game,
    board: newBoard,
    _nextId: _nextId+1,
    tetrominos: {
      ...tetrominos,
      [_nextId]: {
        shape: Shapes[0]
      }
    }
  };
}

/**
 * @param {GameState} game
 * @param {{ type: string, payload?: any }} action
 *
 * @returns {GameState}
 */
const gameReducer = (game, action) => {
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
    return dropLetter(game);

  case 'DRAW_N_DROP': {
    return ['DRAW_LETTER', 'DROP_LETTER'].map(type => ({ type })).reduce(gameReducer, game);
  }

  case 'DROP_TET': {
    return dropTetromino(game);
  }

  case 'START_SWAPPING': {
    return {
      ...game,
      swapping: [action.payload.row, action.payload.column]
    };
  }

  case 'SWAP_WITH': {
    const newBoard = game.board.slice();
    const tileA = newBoard[game.swapping[0]][game.swapping[1]];
    const tileB = newBoard[action.payload.row][action.payload.column];

    newBoard[game.swapping[0]] = newBoard[game.swapping[0]].slice();
    newBoard[action.payload.row] = newBoard[action.payload.row].slice();
    newBoard[game.swapping[0]][game.swapping[1]] = tileB;
    newBoard[action.payload.row][action.payload.column] = tileA;

    return {
      ...game,
      board: newBoard,
      swapping: null
    };
  }

    default:
      return game;
  }
};

const Tile = ({tile}) => {
  return <div className="tile">{tile.letter}</div>;
};

/** @typedef {TileData[][]} BoardState */

const Board = ({ game, TileComponent=Tile, dispatch }) => {
  const { board: data, columns, rows, selectedColumn, swapping } = game;

  return (
  <div className={"board" + (swapping ? ' swapping' : '')}>
    {new Array(columns).fill(1).map((_, i) => (
      <div className={'column-header ' + (i === selectedColumn ? 'selected' : '')}
            onClick={() => { dispatch({ type: 'SELECT_COLUMN', payload: { column: i } }) }}
        />
    ))}
    {data.map((row, r) => {
      return (
          row.map((tile, c) => {
            const blank = isBlank(tile);
            return (
              <div className={"tile-wrapper" + (blank ? ' blank' : '') + 
                              (swapping && swapping[0] === r && swapping[1] === c ? ' swapping-tile' : '')}
                  onClick={e => {
                    if (swapping) {
                      dispatch({ type: 'SWAP_WITH', payload: { row: r, column: c } });
                    } else {
                      dispatch({ type: 'START_SWAPPING', payload: { row: r, column: c } });
                    }
                  }}
                   style={{ 
                     gridColumnStart: `${c+1}`, 
                     gridColumnEnd: isTetromino(tile) ? c+2 : null,
                     gridRowStart: isTetromino(tile) ? rows-r+1-2 : `${rows-r+1}`,
                     gridRowEnd: isTetromino(tile) ? rows-r+2 : null
                    }}
                   key={tile.id} >
                {isBlank(tile) ? null :
                isTetromino(tile) ? <TetrominoShape shape={game.tetrominos[tile.id].shape}
                                        className="tetromino"
                                         /> :
                 <TileComponent tile={tile}/>}
              </div>
            );
          })
      );
    })}
  </div>
  );
};

const useGameTick = (ms, dispatch, scale=1) => {
  const state = useRef(null);

  useEffect(() => {
    if (state.current) {
      const { interval } = state.current;
      if (interval) {
        clearTimeout(interval);
      }
    }

    const interval = setInterval(() => {
      dispatch({
        type: 'TICK',
        payload: {
          delta: (Date.now() - state.current.last)*state.current.scale,
          tick: state.current.tick++,
        }
      });

      state.current.last = Date.now();
    }, ms);

    state.current = {
      interval,
      last: Date.now(),
      scale,
      tick: 0
    };

    return () => {
      console.log('cleaning up');
      clearTimeout(state.current.interval);
      state.current = null;
    };
  }, [ms]);

  useEffect(() => {
    if (state.current)
      state.current.scale = scale;

  }, [scale]);
};


function App() {
  // pieces: move one at a time,
  const [game, dispatch] = React.useReducer(gameReducer, null, initGame);
  const [shape, setShape] = useState(0);
  useGameTick(500, dispatch);
  // console.log(JSON.stringify(game));

  return (
    <div className="App">
      {/* {JSON.stringify(game,)} */}
      <div>{game.pool.length} letter(s) remaining in the pool</div>
      <Board game={game} dispatch={dispatch}/>
      <button onClick={() => dispatch({ type: 'DRAW_N_DROP' })}>
        Draw 'n' Drop
      </button>
      <button onClick={() => dispatch({ type: 'DROP_TET' })}>
        Drop Tetromino
      </button>
      <TetrominoShape shape={Shapes[shape]}
                      onClick={() => setShape(i => ((i + 1) % Shapes.length))}
                      className="tetromino"
                      width={100}
                      height={100} />
    </div>
  );
}

export default App;
