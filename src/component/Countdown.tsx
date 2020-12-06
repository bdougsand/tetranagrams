import * as React from 'react';

const Countdown = ({ ms }) => {
  if (isNaN(ms)) ms = 0;

  const minutes = '' + Math.floor(ms/60000);
  const seconds = '' + Math.floor(ms%60000/1000);

  return (
    <div className={'countdown-clock' + (ms <= 10000 ? ' imminent' : '' )}>
      <span className="minutes">{minutes.padStart(2, '0')}</span>
      <span className="clock-separator">:</span>
      <span className="seconds">{seconds.padStart(2, '0')}</span>
    </div>
  );
}

export default Countdown;
