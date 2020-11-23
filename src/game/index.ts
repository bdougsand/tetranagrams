import { GameState } from "./state";

export const ownerName =
  (game: GameState) => game.players.get(game.ownerId).name;
