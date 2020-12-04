import * as React from 'react';

const Countdown = ({ ms }) => {
  const minutes = '' + Math.floor(ms/60000);
  const seconds = '' + Math.floor(ms%60000/1000);

  return (
    <div className={'countdown-clock' + (ms <= 10000 ? ' imminent' : '' )}>
      <div className="minutes">{minutes.padStart(2, '0')}</div>
      <div className="clock-separator">:</div>
      <div className="seconds">{seconds.padStart(2, '0')}</div>
    </div>
  );
}

export default Countdown;
