import * as React from 'react';
import { useState } from 'react';

import './App.css';

import { GameState, useGame } from './game/state';
import type { PlacedTile, TileData, PieceId, Coord, CoordString, CellData, PieceData,
              BattleshipPhase as BattleshipPhaseType, BananagramsPhase } from './game/eventReducer';
import { ActionType, DropTarget } from './game/actions';
import { useCountdown } from './util/hooks';

import { fitWord } from './game/board';
import * as $board from './game/board';
import * as $u from './util';

import JoinScreen from './screen/Join';
import PregameScreen from './screen/Pregame';

import Countdown from './component/Countdown';
import Selection, { useSelection } from './component/Selection';


type TileProps = {
  tile: TileData,
  draggable?: boolean,
  data?: CellData,
};

const Tile: React.FC<TileProps> = ({ tile, draggable=true }) =>
  <div className="tile" draggable={draggable} data-pieceid={tile.id} data-tilevalue={tile.letter}>
    {tile.letter}
  </div>;

const TetrominoShape = ({ shape, className }) =>
  null;

interface DragState {
  pieceID: PieceId;
  source?: 'tray' | 'board',
  target?: DropTarget;
}

function getTarget(e: { target: HTMLElement }): DropTarget {
  let target = e.target;
  let pieceID: string, coords: string;

  while (target) {
    pieceID = target.getAttribute?.('data-pieceid');
    coords = target.getAttribute?.('data-coords');
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
  || (target.coords && target.coords[0] === coords[0] && target.coords[1] === coords[1]));

const useDragging = (dispatch: React.Dispatch<ActionType>) => {
  const [dragState, setDragState] = useState(null as DragState);

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
  BlankCellComponent?: React.ComponentType<{ row: number, column: number }>,
  className?: string,
  style?: React.CSSProperties,
  dragState?: DragState,
  onDragOver?: any,
  onDragStart?: any,
  onDrop?: any,
  onClick?: any,
  tiles: Iterable<[Coord, { cell: T, piece: PieceData }]>,
  rows: number,
  columns: number,
  extraTileProps?: any,
  isSelected?: (column: number, row: number, pieceId: number) => boolean,
};

function Board<T extends CellData = CellData>(props: BoardProps<T>) {
  const { tiles, TileComponent = Tile, BlankCellComponent, dragState,
          onDragStart, onDragOver, onDrop, rows, className = '', isSelected,
          extraTileProps = {} } = props;
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
            <div className={$u.classnames(
              "tile-wrapper", {
                blank: blank,
                tetromino: tetro,
                'drop-target': isDropTarget,
                'selected': isSelected?.(c, r, id),
              }
            )}
                 data-coords={[c, r]}
                 style={style}
                 key={id || `${c}-${r}`} >
              {blank ? (BlankCellComponent ?
                        <BlankCellComponent row={r} column={c} {...extraTileProps} />
                      : null) :
               tetro ? <TetrominoShape shape={tetro}
                                       className={`tetromino ${tetroClasses}`}
               /> :
               <TileComponent tile={piece as PlacedTile}
                              data={cell}
                              draggable={!!onDragStart}
                              {...extraTileProps} />}
            </div>
          );
        })}
    </div>
  );
};

type TrayProps = {
  tiles: TileData[],
  onDragStart?: any,
  renderEmpty?: React.ReactChild,
};

const Tray: React.FunctionComponent<TrayProps> = ({ onDragStart, tiles, renderEmpty }) => {
  return (
    <div className={$u.classnames("tile-tray", { empty: !tiles.length })}
         onDragStart={onDragStart}
         data-dragsource="tray"
    >
      {tiles.map(tile => <Tile tile={tile} draggable={!!onDragStart} key={tile.id} />)}
      {!tiles.length ? renderEmpty : null}
    </div>
  );
};

type BananaPhaseProps = {
  game: GameState,
  dispatch: (action: ActionType) => any
};

const BananaPhase: React.FC<BananaPhaseProps> = ({ game, dispatch }) => {
  const { poolDrained } = game.phase as BananagramsPhase;
  const dragging = useDragging(dispatch);
  const countdown = useCountdown(poolDrained && poolDrained + 30000);
  const isOver = countdown === 0;
  const selected = useSelection({
    selector: '.tile',
    getID: elt => elt.getAttribute('data-pieceid'),
    ignore: '[draggable]',
  });
  const isSelected = React.useCallback(
    (_c, _r, id) => (id && !isOver && selected.has(''+id)),
    [selected]);

  const islands = React.useMemo(() => {
    return $board.getIslands(game);
  }, [game.pieces])
  const isleCount = islands.length - 1;

  const trayTiles = game.trayTiles.map(({ id }) => game.pieces[id]);

  return (
    <>
      <h3 className="instructions">
        Form connected words with your tiles. When your tray is empty, you can <strong>Draw</strong> more. When anyone draws, everyone draws--so be quick!
      </h3>
      {isleCount > 0 &&
       <h4 className="warning">
         You have {isleCount} isolated "island{isleCount === 1 ? '' : 's'}" of tiles. Connect them before the next phase, or you will lose those tiles!
       </h4>}
      {
        poolDrained ?
        <div className="countdown-container">
          <Countdown ms={countdown} />
        </div> :
        <div className="pool">
          {game.pool.length} letters remaining!
        </div>
      }
      <div className="board-container">
        <Board tiles={$board.iterPieces(game)}
               rows={game.rows}
               columns={game.columns}
               isSelected={isSelected}
               {...(isOver ? {} : dragging)}
        />
      </div>
      <div className="bottom">
        {
          isOver ?
          (
            game.ownerId === game.myId ?
            <button onClick={() => { dispatch({ type: 'battleship' }); }}>
              Man Your Battlestations!
            </button> :
            <div>Prepping battleships...</div>
          ) :
          <Tray tiles={trayTiles as TileData[]}
                onDragStart={dragging.onDragStart}
                renderEmpty={
                  <button onClick={() => { dispatch({ type: 'draw' }); }}
                          disabled={!!poolDrained}>
                    {poolDrained ? 'No tiles remaining' : 'Draw'}
                  </button>
                }/>
        }
      </div>
    </>
  );
};

type FittingTiles = { [k in CoordString]: string };
type BattleshipTileProps = TileProps & {
  players: GameState["players"],
  targeted: Coord,
  fittingTiles?: FittingTiles,
};

const BattleshipTile: React.FC<BattleshipTileProps> = props => {
  const { players, targeted, fittingTiles = {} } = props;
  const tile = props.tile as $board.BattleshipTile;
  const { guesserId, letter, hidden } = tile;
  const { name } = players.get(guesserId) || {};
  const title = hidden ?
                'No one has guessed this tile yet!' :
                (`${name} targeted this tile and ` + (letter ? `hit "${letter}!"` : 'missed!'));

  const isTargeted = tile.x === targeted?.[0] && tile.y === targeted?.[1];
  const fitting = fittingTiles[`${tile.x},${tile.y}`];

  return (
    <div className={$u.classnames({ tile: letter,
                                    'hit-tile': letter && !hidden,
                                    hidden: hidden,
                                    miss: !letter,
                                    targeting: isTargeted,
                                    fitting: !!fitting })}
         title={title}>
      {!hidden &&
       <div className="overlay">
         { letter ? '\u25CB' : fitting || '\u00D7' }
       </div>}
      {letter}
    </div>
  );
};

type BattleshipCellProps = {
  row: number,
  column: number,
  targeted: Coord,
  fittingTiles: FittingTiles
};
const BattleshipCell: React.FC<BattleshipCellProps> = ({ row, column, targeted, fittingTiles }) => {
    const fitting = fittingTiles[`${column},${row}`];

    return (
      (row === targeted[1] && column === targeted[0])
      ? <div className={$u.classnames("targeting overlay", { fitting: !!fitting })}>
        {fitting || '*'}
      </div>
      : fitting
      ? <div className="fitting">{fitting}</div>
      : null);
  };

type BattleshipPhaseProps = {
  game: GameState,
  dispatch: (action: ActionType) => any
};

const BattleshipPhase: React.FC<BattleshipPhaseProps> = ({ game, dispatch }) => {
  const { turn } = game.phase as BattleshipPhaseType;
  const { myId, players } = game;
  const player = players.get(turn);
  const myTurn = turn === myId;

  const [[targetedId, targetedCoords], setTargeting] = useState([null, null] as [string, Coord]);
  let [guessedWord, setGuessedWord] = useState('');
  const [launching, setLaunching] = useState(false);

  const onSelect = React.useCallback(e => {
    const { 'data-coords': coords, 'data-playerid': targetId } =
      $u.getAttributes(e, ['data-coords', 'data-playerid']);

    if (!coords || !targetId || targetId === game.myId ||
        !players.get(targetId)?.remaining) {
      setTargeting([null, null]);
      return;
    }

    setTargeting([
      targetId,
      coords.split(',').map(x => parseInt(x)) as Coord
    ]);

    e.preventDefault();
    e.stopPropagation();
  }, [game.players]);

  const onLaunch = React.useCallback(e => {
    dispatch(Object.assign({
      type: 'guess',
      targetId: targetedId,
      coord: targetedCoords,
    }, guessedWord && {
      type: 'word',
      dir: [1, 0],
      guess: guessedWord,
    }) as ActionType);

    setLaunching(true);

    e.preventDefault();
    e.stopPropagation();
  }, [targetedId, targetedCoords, guessedWord, dispatch]);

  const onChangeGuessText = React.useCallback(e => {
    setGuessedWord(e.currentTarget.value);
  }, []);

  React.useEffect(() => {
    // Runs at the beginning and end of the player's turn
    setTargeting([null, null]);
    setLaunching(false);
  }, [myTurn]);

  let fittingTiles = {};
  if (targetedId && targetedCoords && guessedWord) {
    const bestFits = fitWord(game.players.get(targetedId).knownBoard, targetedCoords, guessedWord, game)
      .reduce((fits, fit) => {
        if (!fits.length || fit.word.length > fits[0].word.length)
          return [fit];

        if (fits[0].word.length === fit.word.length)
          fits.push(fit);

        return fits;
      }, [] as ReturnType<typeof fitWord>);

    for (const fit of bestFits) {
      for (const tile of fit.tiles) {
        fittingTiles[`${tile.x},${tile.y}`] = tile.letter;
      }
    }

    guessedWord = bestFits[0]?.word;
  }

  const opponentBoards = [];
  players.forEach((_, playerId) => {
    const targeted = playerId === targetedId;
    const player = players.get(playerId);
    opponentBoards.push(
      <div className={$u.classnames('opponent', {
        'my-board': playerId === game.myId,
        'completed': player.remaining === 0
      })}
           key={playerId}
           data-playerid={playerId}>
        <Board tiles={$board.iterBattleshipBoard(game, playerId)}
               rows={game.rows}
               columns={game.columns}
               TileComponent={BattleshipTile}
               BlankCellComponent={targeted ? BattleshipCell : null}
               extraTileProps={{ players: game.players,
                                 myBoard: playerId === game.myId && game.board,
                                 targeted: targeted ? targetedCoords : null,
                                 fittingTiles: targeted && fittingTiles }}
        />
        <h2>
          {targeted ? <div className="reticule">{'>>'}</div> : ''}
          {player.name}
          {targeted ? <div className="reticule">{'<<'}</div> : ''}
        </h2>
        <div className="player-details">
          {(isNaN(player.remaining) ? '??? tiles' : $u.pluralize(player.remaining, 'tile')) + ' remaining'}
        </div>
      </div>
    );
  });

  return (
    <div className={$u.classnames('battleship', { 'my-turn': myTurn })}>
      <h3 className="instructions">
        {myTurn ?
         launching ? 'Launching...' : 'Pick a target!' :
         `${player.name} is picking a target...`}
      </h3>
      <div className="battleship-opponents" onClick={myTurn ? onSelect : null}>
        {opponentBoards}
      </div>

      <div className="controls-wrapper">
        <div className="launch-controls">
          <button disabled={!targetedCoords} onClick={onLaunch}>
            {!targetedCoords ? 'Aim!' : 'Launch!'}
          </button>
          <label>
            Guess Word<br/>
            <input type="text"
                   value={guessedWord}
                   onChange={onChangeGuessText} />
          </label>
        </div>
      </div>
    </div>
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
      </div>

      {phase === 'pregame'
      ? <PregameScreen game={game} dispatch={dispatch} />
      : phase === 'bananagrams'
      ? <BananaPhase game={game} dispatch={dispatch} />
      : phase === 'battleship'
      ? <BattleshipPhase game={game} dispatch={dispatch} />
      : <div/>
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
    <Selection>
      <div className="App">
        {
          app.game ? <GameScreen game={app.game} dispatch={dispatch} /> : 
          <JoinScreen game={app.game} dispatch={dispatch} />
        }
      </div>
    </Selection>
  );
}

export default App;
