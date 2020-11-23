import seedrandom from 'seedrandom';

import { ActionResult, EventPayload, handleMessage, SharedGameState } from './eventReducer';


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

  const Payloads: [number, EventPayload][] = [];

  for (const [pidx, payload] of Payloads) {
    const result = sendAs(payload, pidx);

    state = result.state;
    console.log(state);
  }
});
