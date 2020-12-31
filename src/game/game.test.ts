import seedrandom from 'seedrandom';
import { getIslands } from './board';
import * as $board from './board';

import { ActionResult, EventPayload, handleMessage, SharedGameState } from './eventReducer';
import { GameState } from './state';
import { WildCard } from './constants';


test('', () => {
  const Players = [
    { id: 'brian', name: 'Brian' },
    { id: 'tester', name: 'Tester' },
  ];

  let id = 1;

  // TODO Should track local state for each player

  let state: SharedGameState;
  let rand = seedrandom('testseed');
  let stampOffset = 0;

  function sendAs(payload: EventPayload, idx=0): ActionResult {
    const p = Players[idx];
    return handleMessage(
      state, {
        sender: p.id,
        payload,
        timestamp: Date.now() + stampOffset,
        id: id++
      },
      {
        userId: p.id,
        owner: Players[0].id,
        rand,
        gameId: '123',
        config: {
          seed: '',
          minPlayers: 2
        }
      })
  }

  function sendAsAndUpdate(payload: EventPayload, idx=0): SharedGameState {
    let result = sendAs(payload, idx);

    if (result.error)
      throw result.error;

    state = result.state;

    if (result.response) {
      // 0 is hardcoded for now, because that's whose state we're simulating
      console.log(`sending response to ${payload.type}:`, result.response);
      sendAsAndUpdate(result.response, 0);
    }

    return state;
  }

  {
    const result = sendAs({ type: 'init', ownerName: 'Brian' }, 0);
    state = result.state;
  }

  Players.slice(0).forEach((p, idx) => {
    const result = sendAs({ type: 'join', name: p.name }, idx);
    state = result.state
  });

  expect(state.players.size).toEqual(Players.length);
  sendAsAndUpdate({ type: 'start' }, 0);

  {
    let poolSize = state.pool.length;
    let lastPoolSize = poolSize;
    let pIdx = 0, nplayers = state.players.size;
    do {
      lastPoolSize = poolSize;
      const result = sendAs({ type: 'draw' }, pIdx);
      state = result.state;
      poolSize = state.pool.length

      pIdx = (pIdx+1) % nplayers;
      expect(lastPoolSize - poolSize).toBeLessThanOrEqual(nplayers);
    } while (poolSize)

    expect(state.pool.length).toEqual(0);
  }

  sendAsAndUpdate({ type: 'battleship' }, 0);

  {
    const turn = (state.phase as any).turn;
    sendAsAndUpdate({ type: 'guess', coord: [0, 0], targetId: Players[1].id }, 0);
    expect(state.players.get(Players[1].id).knownBoard.has('0,0')).toBeTruthy();
    console.log(turn, '->', (state.phase as any).turn);
  }

  {
    sendAsAndUpdate({ type: 'guess', coord: [0, 0], targetId: Players[0].id }, 1);
    expect(state.players.get(Players[0].id).knownBoard.get('0,0')).toHaveProperty('letter');
  }

  for (const {id} of Players) {
    console.log(id, Array.from(state.players.get(id).knownBoard.entries()));
  }

  {
    // Test that 'islands' are cleaned up when transitioning to Battleships
    let newState: GameState = {
      ...state,
      phase: { state: 'bananagrams', started: Date.now() },
      pieces: {
        "1":{"type":"tile","letter":"E","id":1,"x":2,y:4},
        "2":{"type":"tile","letter":"V","id":2,"x":3,y:4},
        "3":{"type":"tile","letter":"R","id":3,"x":1,"y":0},
        "5":{"type":"tile","letter":"E","id":5,"x":2,"y":0},
        "6":{"type":"tile","letter":"E","id":6,x:3,y:0},
        "7":{"type":"tile","letter":"C","id":7},
        "8":{"type":"tile","letter":"E","id":8,x:3,y:2},
        "9":{"type":"tile","letter":"E","id":9,x:4,y:2},
        "10":{"type":"tile","letter":"E","id":10},
        "11":{"type":"tile","letter":"A","id":11,x:1,y:1},
        "12":{"type":"tile","letter":WildCard,"id":12,x:1,y:2},
        "13":{"type":"tile","letter":"D","id":13,"x":4,y:0},
        "14":{"type":"tile","letter":"R","id":14,x:2,y:2},
        "15":{"type":"tile","letter":"N","id":15,x:5,y:2}
      },
      board: [
        [null,{"id":3},{"id":5},{"id":6},{"id":13},null],        // REED
        [null,{"id":11},null,null,null,null],                    // A
        [null,{"id":12},{"id":14},{"id":8},{"id":9},{"id":15}],  // GREEN
        [null,null,null,null,null,null],                         //
        [null,null,{"id":1},{"id":2},null,null],                 //  EV
        [null,null,null,null,null,null]
      ]
    };

    expect(getIslands(newState)).toHaveLength(2);

    newState = handleMessage(newState, {
      sender: 'brian',
      payload: { type: 'battleship' },
      timestamp: Date.now() + stampOffset,
      id: id++
    }, {
      userId: 'brian',
      owner: 'brian',
      rand,
      gameId: '123',
      config: {
        seed: '',
        minPlayers: 2
      }
    }).state;

    expect(getIslands(newState)).toHaveLength(1);

    expect($board.readLetters(newState, [1, 0], [1, 0])).toStrictEqual(['R', 'E', 'E', 'D']);
    expect($board.wordMatches(newState, "reed", [1, 0], [1, 0])).toBeTruthy();

    expect($board.wordMatches(newState, "preen", [1, 2], [1, 0])).toBeTruthy();
    expect($board.wordMatches(newState, "green", [1, 2], [1, 0])).toBeTruthy();
  }

  const Payloads: [number, EventPayload][] = [];

  for (const [pidx, payload] of Payloads) {
    const result = sendAs(payload, pidx);

    state = result.state;
    console.log(state);
  }

  {
  }
});
