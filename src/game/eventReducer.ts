import { getLetter } from "./board";
import Server, { EventMessage, GameConfig } from "./server";
import { nextKey } from './util';

// playerBoard- [ [3,6]: "b", [7,8]: null, [18,6]: "u"]
type PregamePhase = { state: 'pregame' };
type BananagramsPhase = {
  state: 'bananagrams',
  started: number,
  /** Timestamp when the pool was drained */
  poolDrained?: number
};
type BattleshipPhase = { state: 'battleship', turn: string };
type GamePhase = PregamePhase | BananagramsPhase | BattleshipPhase;

// Local game state ///////////////////////////////////////////////////////////
export interface PlacedPieceData {
  x: number;
  y: number;
}

export interface TileData {
  id: number;
  type: 'tile';
  letter: string;
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
  /** Could be used to send a reply */
  response?: T;
}

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

const randomIndex = (pool: any[], rand=Math.random) => {
  return Math.floor(rand() * pool.length);
};

const getGuess = (state: SharedGameState, targetId: string, coord: Coord): KnownData =>
  state.players.get(targetId)?.knownBoard.get(coord.join(','));

function updateMap<K, V>(m: Map<K, V>, k: K, fn: (val: V) => V): Map<K, V> {
  return new Map(m).set(k, fn(m.get(k)));
}

const initBoard = (rows: number, cols: number): BoardState =>
  Array(rows).fill(null).map(() => Array(cols).fill(null));

type CoordString = string;
type KnownData = {
  guesserId: string,
  letter?: string | null
};
type PlayerData = {
  name: string,
  knownBoard: Map<CoordString, KnownData>,
};
type PlayerOptions = Partial<Pick<PlayerData, 'name'>>;

const initPlayer = (options: PlayerOptions): PlayerData =>
  ({ name: 'unnamed player', ...options, knownBoard: new Map() })

export type ClientParams = Pick<Server, 'userId' | 'rand' | 'owner' | 'gameId' | 'config'>;
type ActionFn<T = EventPayload, S extends SharedGameState = SharedGameState> =
  (state: S, event: EventMessage<T>, params: ClientParams) => ActionResult<S>;

const initGame: ActionFn<InitPayload> = (_, event, server) => {
  const myId = server.userId;

  const { columns = 6, rows = 6, name = '', ownerName } = event.payload;
  const pool = Object.keys(letters).reduce((pool, letter) => {
    for (let i = letters[letter]; i > 0; --i)
      pool.push(letter);
    return pool;
  }, []);

  const state: SharedGameState = {
    name,
    gameId: server.gameId,
    ownerId: event.sender,
    players: new Map(),
    phase: { state: 'pregame' },
    pool,
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

const leaveGame: ActionFn<LeavePayload> = (state, event) => {
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

  return {
    state: _drawLetters({
      ...state,
      _nextId: state._nextId,
      phase: { state: 'bananagrams', started: timestamp },
      trayTiles: [...state.trayTiles],
      pool: [...state.pool]
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

const startBattleship: ActionFn<StartBattleship> = (state, event) => {
  if (state.pool.length) {
    return {
      state,
      error: "There are still tiles left in the pool!",
    };
  }

  // TODO Potentially add a required delay between when the pool is drained and
  // when the battleship phase can begin

  return {
    state: {
      ...state,
      phase: {
        state: 'battleship',
        turn: nextKey(state.players)
      }
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

  return Object.assign({
    state: {
      ...state,
      players,
      phase: {
        ...phase,
        // Update the turn
        turn: nextKey(state.players, sender)
      }
    }
  }, payload.targetId === state.myId && {
    response: {
      type: 'answer',
      coord: payload.coord,
      answer: getLetter(state, ...payload.coord)
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
      }))
    }));

  return {
    state: {
      ...state,
      players
    },
  };
}

const guessWord: ActionFn<GuessWordPayload> = (state, _event) => {
  return { state };
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
type GuessPayload = {
  type: 'guess',
  targetId: string,
  coord: [number, number]
};

/** Response from the target of a guess */
type AnswerPayload = {
  type: 'answer',
  coord: [number, number],
  /** The value of the tile at the coordinate, or null if a miss */
  answer: string | null
};

/** Attempt to complete a partly revealed word on an opponent's board */
type GuessWordPayload = {
  type: 'word',
  targetId: string,
  guess: string,
  /** Any coordinate that falls inside the word */
  coord: [number, number],
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
  | GuessWordPayload;

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
  'word': _inPhase(guessWord, 'battleship'),
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
    error: `Unrecognized action: ${payload.type}`
  };
}
