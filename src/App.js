import React from 'react';
import logo from './logo.svg';
import './App.css';

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
    /** @type {string} */
    lastLetter: null,
  };
};

/** @type {(tile: TileData) => boolean} */
const isBlank = tile => (tile === ' ');

/** @typedef {ReturnType<typeof initGame>} GameState */

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

    case 'DRAW_LETTER': {
      if (game.lastLetter || !game.pool.length) {
        return game;
      }

      const idx = randomIndex(game.pool);
      const letter = game.pool[idx];
      const pool = game.pool.slice(0, idx).concat(game.pool.slice(idx+1));

      return {
        ...game,
        pool,
        lastLetter: letter
      };
    }

    case 'DROP_LETTER': {
      const { board, lastLetter, selectedColumn } = game;

      if (!lastLetter) {
        return game;
      }

      let row = 0;

      while (row < board.length) {
        if (!isBlank(board[row][selectedColumn]))
          break;

        ++row;
      }
      row -= 1;

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
      const newBoard = ((row === -1 ? [newRow] : [...board.slice(0, row), newRow])
                        .concat(board.slice(row+1)));
      return {
        ...game,
        board: newBoard,
        lastLetter: null,
      };
    }

  case 'DRAW_N_DROP': {
    return ['DRAW_LETTER', 'DROP_LETTER'].map(type => ({ type })).reduce(gameReducer, game);
  }

    default:
      return game;
  }
};

const Tile = ({tile}) => {
  return <div className="tile">{tile}</div>;
};

/** @typedef {any} TileData */
/** @typedef {TileData[][]} BoardState */

const Board = ({ game, TileComponent=Tile, dispatch }) => {
  const { board: data, columns, selectedColumn } = game;
  
  return (
  <div className="board">
    <div className="header">
      {new Array(columns).fill(1).map((_, i) => (
        <div className={'column-header ' + (i === selectedColumn ? 'selected' : '')}
             onClick={() => { dispatch({ type: 'SELECT_COLUMN', payload: { column: i } }) }}
         />
      ))}
    </div>
    {data.map(row => {
      return (
        <div className="row">
          {row.map(tile => {
            return (
              <div className="tile-wrapper">
                <TileComponent tile={tile}/>
              </div>
            );
          })}
        </div>
      );
    })}
  </div>
  );
};

function App() {
  // pieces: move one at a time, 
  const [game, dispatch] = React.useReducer(gameReducer, null, initGame);
  // console.log(JSON.stringify(game));

  return (
    <div className="App">
      {/* {JSON.stringify(game,)} */}
      <div>{game.pool.length} letter(s) remaining in the pool</div>
      <Board game={game} dispatch={dispatch}/>
      <button onClick={() => dispatch({ type: 'DRAW_N_DROP' })}>
        Draw 'n' Drop
      </button>
    </div>
  );
}

export default App;
