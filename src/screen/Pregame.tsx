import * as React from "react";
import { ownerName } from "../game";

import { ActionType } from "../game/actions";
import { GameState } from "../game/state";

type PregameScreenProps = {
  game: GameState,
  dispatch: (action: ActionType) => any
};

const PregameScreen: React.FunctionComponent<PregameScreenProps> = ({ game, dispatch }) => {
  const moreNeeded = game.config.minPlayers - game.players.size ;
  const ready = moreNeeded <= 0;
  const { protocol, host } = window.location;
  const url = `${protocol}//${host}/game/${encodeURIComponent(game.gameId)}`;

  return (
    <div className="pregame-screen screen">
      Players: {Array.from(game.players.values(), data => `${data.name}`).join(', ')}
      <br />
      <a href={url}>Link</a>
      <br/>
      {game.ownerId === game.myId ?
       <button disabled={!ready} onClick={() => dispatch({ type: 'start' })}>
         {ready ? "Start the Game!" : "Waiting for players..."}
       </button>
      :
       <div className="">
         {ready ?
          `Waiting for ${ownerName(game)} to start the game...` :
          `Waiting for ${moreNeeded} more players...`}
       </div>
      }
    </div>
  );
}


export default PregameScreen;
