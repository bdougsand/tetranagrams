import * as React from 'react';
import { EventPayload } from '../game/eventReducer';
import { GameState } from '../game/state';

type LastEventProps = {
  game: Pick<GameState, 'players' | 'eventCache' | 'myId' | 'lastEvent' >,
};

type MessageFn<T=EventPayload> = (action: T) => string;

type FindFnType<Union, K> = Union extends { type: K } ? Union : never;

const Messages: { [k in EventPayload["type"]]?: MessageFn<FindFnType<EventPayload, k>> } = {
  /* guess(data) { */
  /* } */
};


const LastEventDisplay: React.FC<LastEventProps> = props => {
  const { game: { players, eventCache, myId, lastEvent } } = props;
  const name = React.useCallback((userId: string, poss=false) => (
    userId === myId ? (poss ? 'your': 'you') : (players.get(userId).name + (poss ? "'s" : ''))
  ), [myId, players]);
  const Player = React.useCallback(({ id, poss=false }) =>
    (<span className="player-name">
      {name(id, poss)}
    </span>), [name]);

  if (!lastEvent)
    return null;

  const { payload, reId, sender } = lastEvent;

  let message: JSX.Element;
  if (payload.type === 'guess') {
    message = <>
      <Player id={sender} /> fired at <Player id={payload.targetId}/>...
    </>
  } else if (payload.type === 'word') {
    message = <>
      <Player id={sender} /> fired at <Player id={payload.targetId}/>
    </>
  } else if (payload.type === 'answer') {
    const guesserId = eventCache[reId].sender
    message = <>
      <Player id={guesserId} /> fired at <Player id={sender}/> {
        payload.answer ? <>and hit a "{payload.answer}!"</> : <>and missed!</>}
    </>;
  } else if (payload.type === 'draw') {
    message = <>
      <Player id={sender} /> drew mores tiles!
    </>
  } else {
  }

  if (!message) return null;

  return (
    <h3 className={`action-message ${payload.type}-message`} data-eventid={lastEvent.id}>
      {message}
    </h3>
  );
};

export default LastEventDisplay;
