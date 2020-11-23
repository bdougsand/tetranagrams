import * as React from "react";

import { GameState } from "../game/state";
import { ActionType } from "../game/actions";
import { getFormData } from "../util";

type JoinScreenProps = {
    game: GameState,
    dispatch: (action: ActionType) => any
};


const JoinScreen: React.FunctionComponent<JoinScreenProps> = ({ dispatch }) => {
  const [gameOptions, setGameOptions] = React.useState(null);

  const onSubmit = React.useCallback((e: React.FormEvent<HTMLFormElement>) => {
    const currentTarget = e.nativeEvent.currentTarget as HTMLFormElement;
    const formName = currentTarget.name;

    e.preventDefault();

    setGameOptions(
      (gameOptions: any) => {
        const options = Object.assign(
          gameOptions || {},
          (formName === 'new-game' || formName === 'join-game') && { action: formName },
          getFormData(currentTarget)
        );

        setGameOptions(options);

        if (formName === 'player') {
          if (options.action === 'new-game') {
            dispatch({
              type: 'create',
              serverOptions: {},
              gameOptions: options.gameOptions,
              userName: options.userName
            });
          } else {
            dispatch({
              type: 'join',
              gameId: options.gameId,
              name: options.userName
            });
          }
        }
      }
    );
  }, [dispatch]);

  if (!gameOptions) {
    return (
      <div className="join-screen screen">
        <form name="new-game" onSubmit={onSubmit}>
          <h2>New Game</h2>
          <label>
            Game Name
            <input type="text" name="gameOptions.name"/>
          </label>
          <button type="submit">New Game</button>
        </form>
        <hr/>
        <form name="join-game" onSubmit={onSubmit}>
          <h2>Existing Game</h2>
          <label>
            Game ID
            <input type="text" name="gameId"/>
          </label>
          <button type="submit">Join Game</button>
        </form>
      </div>
    );
  }

  return (
    <div className="join-screen">
      <form className="join" onSubmit={onSubmit} name="player">
        <label>
          Player Name
          <input type="text" name="userName"/>
        </label>
        <button type="submit">Submit</button>
      </form>
    </div>
  );
};

export default JoinScreen;
