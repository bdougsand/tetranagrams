import * as React from 'react';
import { EventPayload } from '../game/eventReducer';
import { EventMessage } from '../game/server';

const LastEventDisplay: React.FC<{ event: EventMessage<EventPayload> }> = props => {
  const { event } = props;
  const lastMessage = React.useRef(null);

  return (
    <div>

    </div>
  );
};

export default LastEventDisplay;
