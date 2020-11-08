import { ClientParams, EventPayload, InitPayload } from "./eventReducer";
import { CreateGameOptions, EventMessage } from "./server";

export type CreateAction = {
  type: 'create',
  serverOptions: CreateGameOptions,
  userName: string,
  gameOptions: Pick<InitPayload, 'columns' | 'rows' | 'name'>,

};
export type DrawAction = {
  type: 'draw'
};
export type JoinAction = {
  type: 'join',
  gameId: string,
  name: string,
};

export type StartAction = { type: 'start' };

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

export type DropPiece = {
  type: 'drop_piece',
  payload: {
    pieceID: number,
    coords: [number, number],
  }
};

export type ActionType =
  CreateAction
  | DrawAction
  | JoinAction
  | ServerAction
  | StartAction
  | DropPiece;
