import { Dispatch, useEffect, useReducer, useRef } from 'react';

import { ActionType } from './actions';
import * as actions from './actions';
import { handleMessage, PieceId, PieceData, Coord, SharedGameState, ActionResult, EventPayload } from './eventReducer';
import Server, { EventMessage } from './server';
import { selectKeys } from './util';
import { swapPiece } from './board';


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
  async checkedSend(game: GameState, payload: EventPayload, reId?: number) {
    const result = this.simulateResult(game, payload);
    if (result.error) {
      throw result.error;
    }

    return await this.send(payload, reId);
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

  draw(app, action: actions.DrawAction) {
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
      app.server.send(result.response, event.id);
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
    const game = swapPiece(app.game, action.payload.coords, action.payload.pieceID);

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

function initApp(server: GameServer): AppState {
  return {
    server
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
