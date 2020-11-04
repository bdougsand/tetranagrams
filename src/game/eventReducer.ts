import seedrandom from 'seedrandom';

import Server, { EventMessage } from "./server";

// playerBoard- [ [3,6]: "b", [7,8]: null, [18,6]: "u"]

interface PlayerData {
  name: string;
  board?: any;
}

type PregamePhase = { state: 'pregame' };
type BananagramsPhase = { state: 'bananagrams', started: number, poolDrained?: number };
type BattleshipPhase = { state: 'battleship', turn: string };
type GamePhase = PregamePhase | BananagramsPhase | BattleshipPhase;

export interface SharedGameState {
  /** Optional name for the game */
  name: string;
  ownerId: string;
  players: Map<string, PlayerData>; // added in the order they joined (includes local player)
  phase: GamePhase;
  myId: string;
  myLetters: string[];
  pool: string[];
  columns: number;
  rows: number;
  rand: seedrandom.prng;
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

const randomIndex = (pool: any[], rand=Math.random) => {
  return Math.floor(rand() * pool.length);
};

const initGame = (event: EventMessage<InitPayload>, myId: string): SharedGameState => {
  const { columns = 6, rows = 10, seed, name = '', ownerName } = event.payload;
  const pool = Object.keys(letters).reduce((pool, letter) => {
    for (let i = letters[letter]; i > 0; --i)
      pool.push(letter);
    return pool;
  }, []);

  const state: SharedGameState = {
    name,
    ownerId: event.sender,
    players: new Map(),
    phase: { state: 'pregame' },
    pool,
    rows,
    columns,
    rand: seedrandom(seed),

    // These values will be different across clients
    myId,
    myLetters: []
  };

  return joinGame(state, event.sender, { name: ownerName });
};

function joinGame(state: SharedGameState, userId: string, options: { name: string }): SharedGameState {
  if (state.phase.state !== 'pregame')
    return state;

  const players = new Map(state.players);
  players.set(userId, options);

  return {
    ...state,
    players
  };
}

function leaveGame(state: SharedGameState) {
  // TODO
  return state;
}

/**
 * Helper function that modifies the state in place. Be sure to copy 'myLetters'
 * and 'pool' if building a new state.
 */
function _drawLetter(state: SharedGameState, userId: string): SharedGameState {
  if (!state.pool.length)
    return state;

  const idx = randomIndex(state.pool, state.rand);
  const [letter] = state.pool.splice(idx, 1);

  if (userId === state.myId)
    state.myLetters.push(letter);

  return state;
}

function _drawLetters(state: SharedGameState, n = 1): SharedGameState {
  state.players.forEach((_, userId) => {
    for (let i = n; i > 0; -i) {
      _drawLetter(state, userId);
    }
  });
  return state;
}

const StartingLetters = 15;

function startGame(state: SharedGameState, timestamp: number): SharedGameState {
  if (state.players.size < 2 || state.phase.state !== 'pregame')
    return state;

  return _drawLetters({
    ...state,
    phase: { state: 'bananagrams', started: timestamp },
    myLetters: [...state.myLetters],
    pool: [...state.pool]
  }, StartingLetters);
}

// gets a server as argument
// init -- whenever sent by owner, initialize rng
// join -- when a player joins
// draw - first draw by owner, after anyone, on draw all recieve tiles; only during bananagrams phase
// start with 15 tiles
// draw removes letter from pool
// pass something back over the server (i.e. coordinates hit or no hit)
// access to random function
// on a turn - guess a tile, guess a word, then set turn to next person

function draw(state: SharedGameState, event: EventMessage<DrawPayload>): SharedGameState {
  const newState = _drawLetters({
    ...state,
    myLetters: [...state.myLetters],
    pool: [...state.pool],
  });

  if (!newState.pool.length)
    newState.phase = { ...(newState.phase as BananagramsPhase),
                       poolDrained: event.timestamp };

  return newState;
}

type InitPayload = {
  type: 'init',
  seed: string,
  columns: number,
  rows: number,
  name: string,
  ownerName: string
};
type StartPayload = { type: 'start', };
type JoinPayload = { type: 'join', name: string };
type LeavePayload = { type: 'leave' };
type DrawPayload = { type: 'draw' };
type GuessPayload = { type: 'guess', coord: [number, number] };
type AnswerPayload = { type: 'answer', coord: [number, number], replyId: number };

type EventPayload =
  InitPayload |
  JoinPayload |
  LeavePayload |
  StartPayload |
  DrawPayload |
  GuessPayload |
  AnswerPayload;

export function sharedGameStateReducer(state: SharedGameState, event: EventMessage, server: Server): SharedGameState {
  const payload: EventPayload = event.payload;

  if (event.sender !== server.owner) {
    /// These events can only be sent by the game owner
    if (payload.type === 'init')
      return initGame(event, server.userId);

    if (payload.type === 'start') {
      return startGame(state, event.timestamp);
    }
  }

  if (payload.type === 'join') {
    return joinGame(state, event.sender, { name: payload.name });
  }

  if (state.players.has(event.sender)) {
    /// These events can only be sent by players who have joined the game
    if (payload.type === 'leave') {
      return leaveGame(state);
    }

    const { phase } = state;
    if (phase.state === 'bananagrams') {
      /// Events valid during the bananagrams phase

      return draw(state, event);
    } else if (phase.state === 'battleship') {
      /// Events valid during the battleship phase

      // answer

      if (phase.turn === event.sender) {
        // Events valid on the sending player's turn

        // guess
      }
    }
  }

  return state;
  // payload
  // type
  // should ignore? (based on current state)
  // 
  // sender
  // id
  // (timestamp)

}
