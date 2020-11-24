import * as React from 'react';


import './App.css';

import { GameState, useGame } from './game/state';
import { PlacedTile, TileData, PieceId, Coord, CellData, PieceData } from './game/eventReducer';
import { ActionType, DropTarget } from './game/actions';
import * as $board from './game/board';

import JoinScreen from './screen/Join';
import PregameScreen from './screen/Pregame';


type TileProps = {
  tile: TileData,
  draggable?: boolean,
  data?: CellData,
};

const Tile: React.FC<TileProps> = ({ tile, draggable=true }) =>
  <div className="tile" draggable={draggable} data-pieceid={tile.id}>
    {tile.letter}
  </div>;

const TetrominoShape = ({ shape, className }) =>
    null;

interface DragState {
  pieceID: PieceId;
  source?: 'tray' | 'board',
  target?: DropTarget;
}

function getTarget(e): DropTarget {
  let target: HTMLElement = e.target as HTMLElement;
  let pieceID: string, coords: string;

  while (target) {
    pieceID = target.getAttribute('data-pieceid');
    coords = target.getAttribute('data-coords');
    if (pieceID || coords)
      break;
    target = target.parentElement;
  }

  if (!target) return null;

  return Object.assign(
    {},
    pieceID && { pieceID: parseInt(pieceID) },
    coords && { coords: coords.split(',').map(s => parseInt(s)) as Coord }
  );
};

const isTarget = (target: DropTarget, pieceID: number, coords: Coord=[-1, -1]) => (
  (pieceID && pieceID === target.pieceID)
  || (target.coords && target.coords[0] == coords[0] && target.coords[1] === coords[1]));

const useDragging = (dispatch: React.Dispatch<ActionType>) => {
  const [dragState, setDragState] = React.useState(null as DragState);

  const onDragStart = React.useCallback(e => {
    const target = getTarget(e.nativeEvent);
    const source = e.currentTarget.getAttribute('data-dragsource');

    if (!target || !('pieceID' in target)) return;

    setDragState({ pieceID: target.pieceID, source });
  }, []);

  const onDragOver = React.useCallback(e => {
    const target = getTarget(e.nativeEvent);

    if (target) {
      setDragState(state => {
        const newState = (state && { ...state, target });
        return newState;
      });
      e.preventDefault();
    }
  }, []);

  const onDrop = React.useCallback(e => {
    const target = getTarget(e.nativeEvent);

    if (dragState) {
      // Can't drop from the tray onto a placed piece
      if (dragState.source === 'tray' && 'pieceID' in target)
        return setDragState(null);

      dispatch({
        type: 'drop_piece',
        payload: {
          pieceID: dragState.pieceID,
          target: target || dragState.target
        }
      });

      e.preventDefault();
      return setDragState(null);
    }
  }, [dispatch, dragState]);

  return {
    onDragStart,
    onDragOver,
    onDrop,

    dragState
  };
};

type BoardProps<T = CellData> = {
  TileComponent?: React.ComponentType<TileProps>,
  className?: string,
  style?: React.CSSProperties,
  dragState?: DragState,
  onDragOver?: any,
  onDragStart?: any,
  onDrop?: any,
  tiles: Iterable<[Coord, { cell: T, piece: PieceData }]>,
  rows: number,
  columns: number,
};

function Board<T extends CellData = CellData>(props: BoardProps<T>) {
  const { tiles, TileComponent = Tile, dragState, onDragStart, onDragOver,
          onDrop, rows, className = ''} = props;
  const renderedIds = {};

  return (
    <div className={`board ${className}`}
         onDragStart={onDragStart}
         onDragOver={onDragOver}
         onDrop={onDrop}
         data-dragsource="board"
         style={{
           gridTemplateColumns: `repeat(${props.columns}, 4em)`,
           gridTemplateRows: `[header] 0em repeat(${rows}, 4em)`
         }}
    >
      {
        Array.from(tiles, ([[c, r], { piece, cell }]) => {
          const id = cell?.id;
          if (id) {
            // if (renderedIds[id])
            //   return null;

            renderedIds[id] = true;
          }

          const blank = !cell;
          const tetro = piece?.type === 'tetromino' && piece.shape;
          const row = rows - r + 1;

          const style = {
            gridColumnStart: c + 1,
            gridRowStart: row
          };
          let tetroClasses = '';

          if (tetro) {
            /* const [w, h] = getShapeDimensions(tetro);
             * Object.assign(style, {
             *     gridColumnEnd: c + 1 + w,
             *     gridRowStart: row - (h - 1),
             *     gridRowEnd: row + 1,
             * });

             * tetroClasses = w > h ? 'wide' : 'tall'; */
            tetroClasses = '';
          }

          const dropTarget = dragState && dragState.target;
          const isDropTarget = dropTarget && isTarget(dropTarget, id, [c, r]);

          return (
            <div className={"tile-wrapper" + (blank ? ' blank' : '') +
                                                  (tetro ? ' tetromino' : '') +
                                                  (isDropTarget ? ' drop-target' : '')}
                 data-coords={[c, r]}
                 style={style}
                 key={id || `${c}-${r}`} >
              {blank ? null :
               tetro ? <TetrominoShape shape={tetro}
                                       className={`tetromino ${tetroClasses}`}
               /> :
               <TileComponent tile={piece as PlacedTile} data={cell} />}
            </div>
          );
        })}
    </div>
  );
  };

type TrayProps = {
  tiles: TileData[],
  onDragStart?: any,
};

const Tray: React.FunctionComponent<TrayProps> = ({ onDragStart, tiles }) => {
  return (
    <div className="tile-tray"
         onDragStart={onDragStart}
         data-dragsource="tray"
    >
      {tiles.map(tile => <Tile tile={tile} draggable={!!onDragStart} key={tile.id} />)}
    </div>
  );
};

type BananaPhaseProps = {
  game: GameState,
  dispatch: (action: ActionType) => any
};

const BananaPhase: React.FC<BananaPhaseProps> = ({ game, dispatch }) => {
  const dragging = useDragging(dispatch);
  const trayTiles = game.trayTiles.map(({ id }) => game.pieces[id]);

  return (
    <>
      <div className="pool">
        {game.pool.length} letters remaining!
      </div>
      <div className="board-container">
        <Board tiles={$board.iterPieces(game)}
               rows={game.rows}
               columns={game.columns}
               {...dragging}
        />
      </div>
      <Tray tiles={trayTiles as TileData[]} onDragStart={dragging.onDragStart} />
      {!trayTiles.length &&
       <button onClick={() => { dispatch({ type: 'draw' }); }}>
         Draw!
       </button>}
    </>
  );
};

type GameScreenProps = {
  game: GameState,
  dispatch: (action: ActionType) => any
};

const GameScreen: React.FunctionComponent<GameScreenProps> = ({ game, dispatch }) => {
  const { phase: { state: phase } } = game;

  return (
    <div className="game">
      <div className="game-info">
        <h1>{game.name}</h1>
        Game ID: {game.gameId}
      </div>

      {phase === 'pregame'
      ? <PregameScreen game={game} dispatch={dispatch} />
      : phase === 'bananagrams'
      ? <BananaPhase game={game} dispatch={dispatch} />
      : <div />
      }
    </div>
  );
};

function App() {
  // pieces: move one at a time,
  // const [game, dispatch] = React.useReducer(gameReducer, null, initGame);

  // const swapping = game.pieces[game.swapping];
  // const words = swapping && getTileChains(game, [swapping.x, swapping.y]).map(
  //   chain => chain.map(tile => tile.type === 'tile' ? tile.letter : '').join('')
  // );
  const [app, dispatch] = useGame();

  return (
    <div className="App">
      {
        app.game ? <GameScreen game={app.game} dispatch={dispatch} /> : 
        <JoinScreen game={app.game} dispatch={dispatch} />
      }
    </div>
  );
}

export default App;
