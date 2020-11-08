import { findUnsupported, setPieceCoord } from './board';
import type { GameState } from './state';


export function gameTick(game: GameState, tick: number) {
  const unsupported = findUnsupported(game);
  if (unsupported.length) {
    const newGame = {
      ...game,
      board: game.board.map(row => [...row]),
      pieces: { ...game.pieces },
    };

    for (const piece of unsupported) {
      setPieceCoord(newGame, piece, [piece.x, piece.y - 1]);
    }

    return newGame;
  }

  return game;
}
