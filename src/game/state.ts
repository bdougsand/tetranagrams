import { Dispatch, useEffect, useReducer, useRef } from 'react';

import { ActionType } from './actions';
import * as actions from './actions';
import { handleMessage, PieceId, Coord, SharedGameState, ActionResult, EventPayload } from './eventReducer';
import Server, { EventMessage } from './server';
import { selectKeys } from './util';
import { swapPiece } from './board';


const canDraw = (game: GameState): [boolean, string?] =>
  game.trayTiles.length > 0 ?
  [false, 'You have unused tiles in your tray'] :
  !game.pool.length ?
  [false, 'There are no more tiles to draw'] :
  [true];

class GameServer extends Server {
  getParams() {
    return selectKeys(this, ['userId', 'rand', 'owner', 'gameId', 'config'])
  }

  /**
   * Check if the user will be allowed to send an event in the current game
   * state.
   */
  simulateResult(game: GameState, payload: EventPayload) {
    const syntheticEvent: EventMessage = {
      id: this.lastKey+1,
      sender: this.userId,
      timestamp: Date.now(),
      payload
    };
    return handleMessage(game, syntheticEvent, this.getParams());
  }

  /**
   * Wraps Server.send, first checking that the action is allowed from the
   * current game state. Throws an error if not.
   */
  async checkedSend(game: GameState, ...args: Parameters<Server["send"]>) {
    const payload = args[0] as EventPayload;
    const result = this.simulateResult(game, payload);
    if (result.error) {
      throw result.error;
    }

    return await this.send(...args);
  }
}

export interface GameState extends SharedGameState {
  // dropping: PieceData;
  // These could be stored outside game state, e.g. in component state
  // selectedColumn: number;
  swapping: PieceId;
  draggingOver: Coord;
}

export interface AppState {
  /** This will be unset until we receive an 'init' event */
  game?: GameState;

  server: GameServer;
}

type GameActionHandler = (app: AppState, action: ActionType) => AppState;

const Handlers: { [k in ActionType["type"]]: GameActionHandler } = {
  // Actions that send events to the server ///////////////////////////////////
  join(app, action: actions.JoinAction) {
    app.server.joinGame({ id: action.gameId });
    app.server.send({
      type: 'join',
      name: action.name
    } as EventPayload);

    // TODO Store state indicating that the game is being joined, then clear it
    // when the message arrives back from the server

    return app;
  },

  create(app, action: actions.CreateAction) {
    console.log('creating');
    app.server.createGame(action.serverOptions);
    app.server.send({
      type: 'init',
      ownerName: action.userName,
      ...action.gameOptions,
    } as EventPayload);

    // TODO Store state indicating that the game is being created

    // The game state will be set up when we receive the event back from the
    // server
    return app;
  },

  start(app, _action) {
    try {
      app.server.checkedSend(app.game, { type: 'start' });
    } catch (err) {
      // TODO log the error
    }

    return app;
  },

  draw(app) {
    const [allowed,] = canDraw(app.game);
    if (!allowed) {
      return app;
    }

    try {
      app.server.checkedSend(app.game, { type: 'draw' });
    } catch (err) {

    }
    return app;
  },

  // Handle events coming back from the server ////////////////////////////////
  server_action(app, action: actions.ServerAction) {
    const { event, params } = action.payload;
    const result = handleMessage(app.game, event, params) as ActionResult<GameState>;

    if (result.response) {
      app.server.send(result.response, event.id, result.responseRecipient);
    }

    // TODO Display errors, if appropriate

    if (result.state === app.game)
      return app;

    return {
      ...app,

      game: result.state,
    };
  },

  // Purely local events //////////////////////////////////////////////////////
  drop_piece(app, action: actions.DropPiece) {
    let { coords, pieceID } = action.payload.target;

    let game = app.game;
    if (pieceID) {
      // If dropping onto another piece, get its coordinates
      const piece = app.game.pieces[pieceID];
      if ('x' in piece && !coords) {
        coords = [piece.x, piece.y];
      }
    }

    if (coords) {
      game = swapPiece(app.game, coords, action.payload.pieceID);
    }

    return game === app.game ? app : { ...app, game };
  }
};

function gameReducer(app: AppState, action: ActionType): AppState {
  const handler = Handlers[action.type];

  if (handler) {
    return handler(app, action);
  }

  return app;
}

const testGame: GameState = {
      swapping: null,
      draggingOver: null,
      rand: require('seedrandom')(''),
  "name":"New Game","gameId":"testgame","ownerId":"fakeID","players":new Map(),"phase":{"state":"bananagrams","started":1606076831437},"pool":["A","A","A","A","A","A","A","B","B","C","D","D","D","E","E","E","E","E","F","G","G","H","I","I","I","I","I","I","I","K","L","L","L","L","M","M","N","N","N","N","N","O","O","O","O","O","O","P","Q","R","R","R","R","S","S","S","T","T","T","T","T","T","U","U","U","V","W","W","Y","Y"],"rows":6,"columns":6,"config":{"minPlayers":2,"seed":"0.6fbsr19kvbo1enoq6rgg"},"myId":"fakeID","trayTiles":[{"id":1},{"id":2},{"id":3},{"id":4},{"id":5},{"id":6},{"id":7},{"id":8},{"id":9},{"id":10},{"id":11},{"id":12},{"id":13},{"id":14},{"id":15}],"board":[[null,null,null,null,null,null],[null,null,null,null,null,null],[null,null,null,null,null,null],[null,null,null,null,null,null],[null,null,null,null,null,null],[null,null,null,null,null,null]],"pieces":{"1":{"type":"tile","letter":"E","id":1},"2":{"type":"tile","letter":"V","id":2},"3":{"type":"tile","letter":"R","id":3},"4":{"type":"tile","letter":"Blank","id":4},"5":{"type":"tile","letter":"E","id":5},"6":{"type":"tile","letter":"E","id":6},"7":{"type":"tile","letter":"C","id":7},"8":{"type":"tile","letter":"E","id":8},"9":{"type":"tile","letter":"E","id":9},"10":{"type":"tile","letter":"E","id":10},"11":{"type":"tile","letter":"A","id":11},"12":{"type":"tile","letter":"G","id":12},"13":{"type":"tile","letter":"D","id":13},"14":{"type":"tile","letter":"R","id":14},"15":{"type":"tile","letter":"N","id":15}},"_nextId":16};

function initApp(server: GameServer): AppState {
  return {
    server,
    // game: testGame
  };
}

export function useGame(): [AppState, Dispatch<ActionType>] {
  const server = useRef(new GameServer());
  const [game, dispatch] = useReducer(gameReducer, server.current, initApp);

  useEffect(() => {
    server.current.handler = (event, server: GameServer) => {
      dispatch({
        type: 'server_action',
        payload: {
          event,
          params: server.getParams()
        }
      });
    };
  }, [dispatch]);

  // const wrappedDispatch = useCallback((action => {
  //   const untypedMessage = action as any;

  //   if (untypedMessage.__dispatchId) {
  //     console.log('Message already sent');
  //     return;
  //   }

  //   untypedMessage.__dispatchId = uuid.v4();
  //   console.log('assigned id:', untypedMessage.__dispatchId);

  //   dispatch(action);

  // }) as typeof dispatch, []);

  return [game, dispatch];
}
