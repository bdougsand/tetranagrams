import * as React from 'react';


const timeLeft = (toTime: number) => Math.max(toTime - Date.now(), 0);

/**
 *
 */
export function useCountdown(toTime: number, options = { updateInterval: 1000 }) {
  const [, setRemaining] = React.useState({});
  const data = React.useRef({ interval: null, timeout: null, intervalMS: options.updateInterval });

  React.useEffect(() => {
    const d = data.current;
    clearInterval(d.interval);

    if (!toTime)
      return;

    d.interval = setInterval(() => {
      const remaining = timeLeft(toTime);

      setRemaining({});

      if (!remaining) clearInterval(d.interval);
    }, d.intervalMS);
  }, [toTime]);

  return toTime ? timeLeft(toTime) : null;
}
