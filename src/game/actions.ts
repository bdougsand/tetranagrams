import type { ClientParams, EventPayload, InitPayload, Coord, GuessPayload, GuessWordPayload } from "./eventReducer";
import { CreateGameOptions, EventMessage } from "./server";

// Actions that may get sent to the server ////////////////////////////////////
export type CreateAction = {
  type: 'create',
  serverOptions: CreateGameOptions,
  userName: string,
  gameOptions: Pick<InitPayload, 'columns' | 'rows' | 'name'>,

};
export type DrawAction = {
  type: 'draw'
};

export type ConnectAction = {
  type: 'connect',
  gameId: string,
};
export type JoinAction = {
  type: 'join',
  gameId: string,
  name: string,
};

export type StartAction = { type: 'start' };
export type BattleshipAction = { type: 'battleship' };

export type GuessAction = GuessPayload;
export type GuessWordAction = GuessWordPayload;

// Actions that affect local state ////////////////////////////////////////////
export type DropTarget = {
  coords?: Coord,
  pieceID?: number,
};

export type DropPiece = {
  type: 'drop_piece',
  payload: {
    pieceID: number,
    target: DropTarget,
  }
};

export type RestoreAction = {
  type: 'restore',
  payload: {
    game: any
  }
};

/**
 * An action that originates from the server
 */
export type ServerAction = {
  type: 'server_action',
  payload: {
    event: EventMessage<EventPayload>,
    params: ClientParams
  }
}


export type ActionType =
  CreateAction
  | JoinAction
  | ConnectAction
  | RestoreAction
  | ServerAction
  | StartAction
  | DrawAction
  | DropPiece
  | BattleshipAction
  | GuessAction
  | GuessWordAction;
