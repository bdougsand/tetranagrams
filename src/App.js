import React from 'react';
import logo from './logo.svg';
import './App.css';

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
        lastLetter: { letter, id: game._nextId },
        _nextId: game._nextId+1
      };
    }

    case 'DROP_LETTER': {
      const { board, lastLetter, selectedColumn } = game;

      if (!lastLetter) {
        return game;
      }

      let row = board.length;

      while (row > 0) {
        if (!isBlank(board[row-1][selectedColumn]))
          break;

        --row;
      }

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

  case 'DRAW_N_DROP': {
    return ['DRAW_LETTER', 'DROP_LETTER'].map(type => ({ type })).reduce(gameReducer, game);
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

/** @typedef {any} TileData */
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
                   style={{ 'gridColumn': `${c+1}`, 'gridRow': `${rows-r+1}` }}
                   key={tile.id} >
                {isBlank(tile) ? null : <TileComponent tile={tile}/>}
              </div>
            );
          })
      );
    })}
  </div>
  );
}; 

const Shapes = [
  ['X ',
   'X ',
   'XX'],
   [' X',
    ' X',
    'XX'],
  ['X ',
   'XX',
   'X '],
  ['X ',
   'XX',
   ' X'],
   [' X',
   'XX',
   'X '],
  ['XXXX'],
  ['XX',
   'XX'],
];



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
      <svg viewBox="0 0 3 3" width={50} height={75} >
      <polyline points="0,0 " stroke={'blue'}  style={{ transform: `rotation(90deg)` }} strokeWidth={1} fill={'transparent'}/>
        <path d="M 0,3 0,0 1,0 1,2 2,2 2,3 Z" transform={'rotate(90 1.5 1.5)'} style={{ fill: 'red', transform: `rotation(90deg)` }} />
      </svg>
    </div>
  );
}

export default App;
