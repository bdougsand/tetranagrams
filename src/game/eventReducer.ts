import * as $board from './board';
import { isValidCoord } from "./board";
import Server, { EventMessage, GameConfig } from "./server";
import { concat, map, nextKey } from './util';

// playerBoard- [ [3,6]: "b", [7,8]: null, [18,6]: "u"]
export type PregamePhase = { state: 'pregame' };
export type BananagramsPhase = {
  state: 'bananagrams',
  started: number,
  /** Timestamp when the pool was drained */
  poolDrained?: number
};
export type BattleshipPhase = {
  state: 'battleship',
  turn: string,
  waitingForResponse?: boolean,
  /** Timestamp */
  complete?: number,
};
export type GamePhase = PregamePhase | BananagramsPhase | BattleshipPhase;

// Local game state ///////////////////////////////////////////////////////////
export interface PlacedPieceData {
  x: number;
  y: number;
}

type TileLetter = string;

export interface TileData {
  id: number;
  type: 'tile';
  /** */
  letter: TileLetter;
}

export type Shape = string[];
export type Coord = [number, number];
export interface TetrominoData {
  id: number;
  type: 'tetromino';
  shape: Shape;
}
export type PieceData = TileData | TetrominoData;
export type PlacedPiece = PieceData & PlacedPieceData;
export type PlacedTile = TileData & PlacedPieceData;
export type PieceId = number;

export interface CellData {
  id: number;
};

export type BoardState = CellData[][];

export interface SharedGameState {
  /** Optional name for the game */
  name: string;
  gameId: string;
  ownerId: string;
  players: Map<string, PlayerData>; // added in the order they joined (includes local player)
  phase: GamePhase;
  pool: string[];
  columns: number;
  rows: number;
  rand: seedrandom.prng;
  config: GameConfig;

  // These values will be different across clients
  myId: string;
  trayTiles: CellData[];

  // NOTE Should error messages also go here? Just the ones initiated by the
  // current player? All of them? Do they get cleaned up at some point?
  // Alternatively, events could return a wrapper that has `state`, `error`, and
  // `response` fields (and potentially others).

  // This could be used to check locally if a move will be allowed or not.

  // Local state

  /** The current layout of the local player's board */
  board: BoardState;
  pieces: { [id in string]: (PlacedPiece|PieceData) };
  _nextId: PieceId;
}

export interface ActionResult<S extends SharedGameState = SharedGameState, T=EventPayload> {
  /**
    * The new state after applying the event action. If there are any changes,
    * it will be a new object.
    */
  state: S;
  /** Set if the action is invalid */
  error?: any;
  /** If set, send a response message with this payload */
  response?: T;
  /** Send the response privately */
  responseRecipient?: string;
}

const randomIndex = (pool: any[], rand=Math.random) => {
  return Math.floor(rand() * pool.length);
};

const getGuess = (state: SharedGameState, targetId: string, coord: Coord): KnownData =>
  state.players.get(targetId)?.knownBoard.get(coord.join(','));

function updateMap<K, V>(m: Map<K, V>, k: K, fn: (val: V) => V): Map<K, V> {
  return new Map(m).set(k, fn(m.get(k)));
}

function battleshipComplete(state: SharedGameState) {
  let count = 0;
  for (const { remaining } of state.players.values()) {
    if (remaining) {
      if (++count > 1) return false;
    }
  }

  return count <= 1;
}

const initBoard = (rows: number, cols: number): BoardState =>
  Array(rows).fill(null).map(() => Array(cols).fill(null));

export type CoordString = string;
export type KnownData = {
  guesserId?: string,
  /** null on a miss */
  letter?: TileLetter | null,
};
export type KnownBoard = Map<CoordString, KnownData>;
type PlayerData = {
  name: string,
  knownBoard: KnownBoard,
  remaining?: number,
};
type PlayerOptions = Partial<Pick<PlayerData, 'name'>>;

const initPlayer = (options: PlayerOptions): PlayerData =>
  ({ name: 'unnamed player', ...options, knownBoard: new Map() })

export type ClientParams = Pick<Server, 'userId' | 'rand' | 'owner' | 'gameId' | 'config'>;
type ActionFn<T = EventPayload, S extends SharedGameState = SharedGameState> =
  (state: S, event: EventMessage<T>, params: ClientParams) => ActionResult<S>;

const initGame: ActionFn<InitPayload> = (_, event, server) => {
  const myId = server.userId;

  const { columns = 8, rows = 8, name = '', ownerName } = event.payload;

  const state: SharedGameState = {
    name,
    gameId: server.gameId,
    ownerId: event.sender,
    players: new Map(),
    phase: { state: 'pregame' },
    pool: [],
    rows,
    columns,
    rand: server.rand,
    config: server.config,

    // These values will be different across clients
    myId,
    trayTiles: [],

    board: initBoard(columns, rows),
    pieces: {},
    _nextId: 1,
  };

  return _joinGame(state, event.sender, { name: ownerName });
};

function _joinGame(state: SharedGameState, userId: string, options: PlayerOptions): ActionResult {
  if (state.phase.state !== 'pregame')
    return {
      state,
      error: "You can't join the game now!"
    };

  if (state.players.has(userId))
    return {
      state,
      error: "You're already in the game"
    };

  const players = new Map(state.players);
  players.set(userId, initPlayer(options));

  return {
    state: {
      ...state,
      players
    }
  };
}

const joinGame: ActionFn<JoinPayload> = (state, event) => (_joinGame(state, event.sender, { name: event.payload.name }));

const leaveGame: ActionFn<LeavePayload> = (state, _event) => {
  // TODO
  return { state };
}

/**
 * Helper function that modifies the state in place. Be sure to copy 'trayTiles',
 * 'pool', and '_nextId' if building a new state.
 */
function _drawLetter(state: SharedGameState, userId: string): SharedGameState {
  if (!state.pool.length)
    return state;

  const idx = randomIndex(state.pool, state.rand);
  const [letter] = state.pool.splice(idx, 1);

  if (userId === state.myId) {
    const piece: PieceData = { type: 'tile', letter, id: state._nextId++ };
    state.trayTiles.push({ id: piece.id });
    state.pieces[piece.id] = piece;
  }

  return state;
}

function _drawLetters(state: SharedGameState, n = 1): SharedGameState {
  for (let i = n; i > 0; i--) {
    for (const userId of state.players.keys()) {
      _drawLetter(state, userId);
      if (!state.pool.length)
        return state;
    }
  }
  return state;
}

const StartingLetters = 15;

const startGame: ActionFn<StartPayload> = (state, { timestamp }) => {
  if (state.players.size < state.config.minPlayers || state.phase.state !== 'pregame')
    return {
      state,
      error: "You must have at least two players to start the game"
    };

  const pool = $board.makePool($board.getLetterCounts(
    state.players.size, state.columns, state.rows
  ));

  return {
    state: _drawLetters({
      ...state,
      _nextId: state._nextId,
      phase: { state: 'bananagrams', started: timestamp },
      trayTiles: [...state.trayTiles],
      pool,
    }, StartingLetters)
  };
};

// gets a server as argument
// init -- whenever sent by owner, initialize rng
// join -- when a player joins
// draw - first draw by owner, after anyone, on draw all recieve tiles; only during bananagrams phase
// start with 15 tiles
// draw removes letter from pool
// pass something back over the server (i.e. coordinates hit or no hit)
// access to random function
// on a turn - guess a tile, guess a word, then set turn to next person

const draw: ActionFn<DrawPayload> = (state, event) => {
  const phase = state.phase as BananagramsPhase;
  const newState = _drawLetters({
    ...state,
    _nextId: state._nextId,
    trayTiles: [...state.trayTiles],
    pool: [...state.pool],
  });

  newState.phase = newState.pool.length ? phase : { ...phase, poolDrained:
                                                    event.timestamp };

  return { state: newState };
};

const startBattleship: ActionFn<StartBattleship> = (state, _event) => {
  if (state.pool.length) {
    return {
      state,
      error: "There are still tiles left in the pool!",
    };
  }

  // TODO Potentially add a required delay between when the pool is drained and
  // when the battleship phase can begin

  const phase: BattleshipPhase = {
    state: 'battleship',
    turn: nextKey(state.players)
  };

  // Remove all but the largest "island"s of tiles from the board. If more than
  // one island is the largest, an arbitrary one is kept. (It ends up being
  // dependent on the order in which the game.pieces object's keys are
  // traversed. I see some potential problems here for repeatability if at some
  // point we restore local state across reloads, but a small tweak would fix
  // this).
  const islands = $board.getIslands(state);
  if (islands.length > 1) {
    const trayTiles = [...state.trayTiles];
    const pieces = {...state.pieces};
    const board = state.board.map(row => [...row]);

    const [, largeIdx] = islands.reduce(
      (lg, isle, i) => (isle.length > lg[0] ? [isle.length, i] : lg),
      [0, -1]);
    islands.forEach((isle, idx) => {
      if (idx !== largeIdx) {
        for (const pieceId of isle) {
          const piece = {...pieces[pieceId]} as PlacedPiece;
          board[piece.y][piece.x] = null;
          delete piece['x'];
          delete piece['y'];
          pieces[pieceId] = piece;
          trayTiles.push({ id: parseInt(pieceId) });
        }
      }
    });

    return {
      state: {
        ...state,
        phase,
        trayTiles,
        pieces,
        board
      }
    };
  }

  return {
    state: {
      ...state,
      phase,
    }
  };
};

const guess: ActionFn<GuessPayload> = (state, event) => {
  const { sender, payload } = event;
  const phase = state.phase as BattleshipPhase;

  if (phase.turn !== sender)
    return {
      state,
      error: "It's not your turn"
    };

  if (!isValidCoord(state, payload.coord)) {
    return {
      state,
      error: "Invalid coordinate"
    };
  }

  const guess = getGuess(state, payload.targetId, payload.coord)
  if (guess) {
    return {
      state,
      error: "That coordinate has already been guessed"
    };
  }

  const coordStr = payload.coord.join(',');
  const players = updateMap(state.players, payload.targetId,
                            target => ({
                              ...target,
                              knownBoard: new Map(target.knownBoard)
                                .set(coordStr, { guesserId: event.sender })
                            }));

  const newState = {
    ...state,
    players,
    phase: {
      ...phase,
      turn: nextKey(state.players, sender)
    }
  };
  return Object.assign({
    state: newState
  }, payload.targetId === state.myId && {
    response: {
      type: 'answer',
      coord: payload.coord,
      answer: $board.getLetter(state, ...payload.coord),
      remaining: $board.hiddenTiles(newState).length,
    } as AnswerPayload
  });
};

const answer: ActionFn<AnswerPayload> = (state, event) => {
  const coordStr = event.payload.coord.join(',');

  const players = updateMap(
    state.players, event.sender,
    target => ({
      ...target,
      knownBoard: updateMap(target.knownBoard, coordStr, known => ({
        ...known,
        letter: event.payload.answer
      })),
      remaining: event.payload.remaining,
    }));

  const newState = {
    ...state,
    players
  };

  if (battleshipComplete(newState))
    newState.phase = { ...(state.phase as BattleshipPhase), complete: event.timestamp };

  return { state: newState };
}

const reveal: ActionFn<RevealPayload> = (state, event) => {
  const players = updateMap(
    state.players, event.sender,
    target => ({
      ...target,
      knownBoard: new Map(concat(map(event.payload.board,
                                     ([coord, letter]) => ([coord.join(','), { letter }] as [string, KnownData])),
                                 target.knownBoard.entries()))
    }));

  return {
    state: {
      ...state,
      players
    },
  };
};

const guessWord: ActionFn<GuessWordPayload> = (state, event) => {
  const { sender, payload } = event;
  const phase = state.phase as BattleshipPhase;

  if (phase.turn !== sender || phase.waitingForResponse)
    return {
      state,
      error: "It's not your turn"
    };

  if (!isValidCoord(state, payload.coord)) {
    return {
      state,
      error: "Invalid coordinate"
    };
  }

  if (!$board.isValidDir(payload.dir)) {
    return {
      state,
      error: "Invalid direction"
    };
  }

  const newState = {
    ...state,
    phase: {
      ...state.phase,
      waitingForResponse: true
    }
  };
  return Object.assign({
    state: newState
   }, payload.targetId === state.myId && {
    response: {
      type: 'word_response',
      coord: payload.coord,
      dir: payload.dir,
      guess: payload.guess,
      isHit: $board.wordMatches(state, payload.guess, payload.coord, payload.dir),
      remaining: $board.hiddenTiles(newState).length,
    } as GuessWordAnswerPayload
  });
};

const guessWordResponse: ActionFn<GuessWordAnswerPayload> = (state, event) => {
  const { payload, sender } = event;
  const phase = state.phase as BattleshipPhase;
  const { coord, dir } = payload;

  const idxToCoordStr = idx => ([coord[0] + (dir[0]*idx), coord[1] + (dir[1]*idx)].join(','));

  // XXX Should players with no hidden tiles still be allowed to guess?
  return {
    state: {
      ...state,
      phase: {
        state: 'battleship',
        turn: payload.isHit ? phase.turn : nextKey(state.players, phase.turn),
      },
      players: updateMap(state.players, sender, target => (
        payload.isHit ? {
        ...target,
        knownBoard: new Map(Array.from(target.knownBoard.entries())
                                      .concat(Array.from(payload.guess, (char, idx) => ([idxToCoordStr(idx), { letter: char, guesserId: phase.turn }]))))
      } : target))
    }
  };
};

export type InitPayload = {
  type: 'init',
  columns?: number,
  rows?: number,
  name?: string,
  ownerName: string
};
type StartPayload = { type: 'start', };
type JoinPayload = { type: 'join', name: string };
type LeavePayload = { type: 'leave' };
type DrawPayload = { type: 'draw' };
type StartBattleship = { type: 'battleship' };
export type GuessPayload = {
  type: 'guess',
  targetId: string,
  coord: [number, number]
};

/** Response from the target of a guess */
type AnswerPayload = {
  type: 'answer',
  coord: Coord,
  /** The value of the tile at the coordinate, or null if a miss */
  answer: TileLetter | null,
  /** Number of tiles on the player's board that have not yet been revealed */
  remaining: number,
};

/** Player reveals their board */
type RevealPayload = {
  type: 'reveal',
  board: [Coord, string?][],
};

/** Attempt to complete a partly revealed word on an opponent's board */
export type GuessWordPayload = {
  type: 'word',
  targetId: string,
  guess: string,
  /** Start coordinate of the word */
  coord: [number, number],
  dir: [1, 0] | [0, -1],
};

export type GuessWordAnswerPayload = {
  type: 'word_response',
  coord: Coord,
  dir: GuessWordPayload["dir"],
  guess: string,
  isHit: boolean,
  /** Number of tiles on the player's board that have not yet been revealed */
  remaining: number,
};

export type EventPayload =
  InitPayload
  | JoinPayload
  | LeavePayload
  | StartPayload
  | DrawPayload
  | StartBattleship
  | GuessPayload
  | AnswerPayload
  | RevealPayload
  | GuessWordPayload
  | GuessWordAnswerPayload;

type ActionFnWrapper<ExtraArgs extends any[] = []> = (fn: ActionFn, ...rest: ExtraArgs) => ActionFn;

const _owner: ActionFnWrapper = (fn) => (
  (state, event, server) => (
    event.sender !== server.owner
      ? { state, error: "Permission denied" }
      : fn(state, event, server)));

const _inGame: ActionFnWrapper = fn => (
  (state, event, server) => (
    !state.players.has(event.sender)
      ? { state, error: "You haven't joined the game" }
      : fn(state, event, server)));

const _inPhase: ActionFnWrapper<[GamePhase["state"]]> = (fn, phase) => (
  (state, event, server) => (
    state.phase.state !== phase
      ? { state, error: `` }
      : fn(state, event, server)));

export const EventHandlers: { [k in EventPayload["type"]]: ActionFn } = {
  'init': _owner(initGame),
  'start': _owner(startGame),
  'join': joinGame,
  'leave': _inGame(leaveGame),
  'draw': _inPhase(draw, 'bananagrams'),
  'battleship': _owner(_inPhase(startBattleship, 'bananagrams')),
  'guess': _inPhase(guess, 'battleship'),
  'answer': _inPhase(answer, 'battleship'),
  'reveal': _inPhase(reveal, 'battleship'),
  'word': _inPhase(guessWord, 'battleship'),
  'word_response': _inPhase(guessWordResponse, 'battleship'),
};


/**
 * Process the result of an event message
 */
export const handleMessage: ActionFn<EventPayload> =
  (state, event, server) => {
  const payload = event.payload;
  const handler = EventHandlers[payload.type];

  if (handler) {
    return handler(state, event, server);
  }

  return {
    state,
    error: `Unrecognized action: ${payload}`
  };
}
