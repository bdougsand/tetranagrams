import * as React from 'react';
import Server from './game/server';

import './App.css';

import { Shapes, TetrominoShape } from './svg';

// check if TileData is a tetromino, then return all cells that are part of tetramino

//
//   ['** ', ' **'],
// [[0,0], [0, 1], [1,1], [1,2]];

//   const pieces = game.pieces;
//   const { id: pieceID } = game.board[coord[1]][coord[0]];
//   const piece = pieces[pieceID];

//   return getTileChains;
// }

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
