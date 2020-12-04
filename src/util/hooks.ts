import * as React from 'react';
import { useCallback } from 'react';


const timeLeft = (toTime: number) => Math.max(toTime - Date.now(), 0);

/**
 *
 */
export function useCountdown(toTime: number, options = { updateInterval: 1000 }) {
  const [remaining, setRemaining] = React.useState(timeLeft === null ? null : timeLeft(toTime));
  const data = React.useRef({ interval: null, timeout: null, intervalMS: options.updateInterval });

  React.useEffect(() => {
    const d = data.current;
    clearInterval(d.interval);

    if (!toTime)
      return;

    d.interval = setInterval(() => {
      const remaining = timeLeft(toTime);

      setRemaining(remaining);
      if (!remaining)
        clearInterval(d.interval);
    }, d.intervalMS);
  }, [toTime]);

  return toTime ? remaining : null;
}

type Selection = {
  end: [number, number],
  start: [number, number],
  dragging?: boolean,
};
export type IsSelectedFn = (x: number, y: number) => boolean;
type GetCoordsFn = (target: HTMLElement) => ({ coords?: [number, number] });

function getRange(start: [number, number], end: [number, number]): [number, number, number, number] {
  return [
    Math.min(start[0], end[0]), Math.min(start[1], end[1]),
    Math.max(start[0], end[0]), Math.max(start[1], end[1]),
  ];
}

type Range = [number, number, number, number];
function rangeContains([xmin, ymin, xmax, ymax]: Range, x: number, y: number) {
  return x >= xmin && x <= xmax && y >= ymin && y <= ymax;
}

export function useSelection(getCoords: GetCoordsFn) {
  const [selection, setSelection] = React.useState(null as Selection);

  const selectionStart = selection?.start;
  const selectionEnd = selection?.end;
  const contains: IsSelectedFn = useCallback((x, y) => {
    if (!selectionStart) return false;

    return rangeContains(getRange(selectionStart, selectionEnd), x, y);
  }, [selectionStart, selectionEnd]);

  const expand = useCallback((x, y) => {
    setSelection(selection => {
      if (!selection) {
        return {
          start: [x, y],
          end: [x, y],
        };
      }

      if (selection.end[0] === x && selection.end[1] === y)
        return selection;

      return {
        ...selection,
        end: [x, y]
      };
    });
  }, []);

  const onMouseDown = useCallback(e => {
    const check = getCoords(e.nativeEvent.target);

    if (!check?.coords) {
      setSelection(null);
      return;
    }

    const { coords: [x, y] } = check;

    setSelection(sel =>
      (sel && rangeContains(getRange(sel.start, sel.end), x, y)
        ? null
        : {
          start: [x, y],
          end: [x, y],
          dragging: true,
        }));
  }, [getCoords]);

  const dragIsActive = !!selection?.dragging;
  const onMouseMove = React.useCallback(e => {
    if (!selection || !selection.dragging)
      return;

    e.preventDefault();
    const check = getCoords(e.nativeEvent.target);
    if (!check) return;

    expand(check.coords[0], check.coords[1]);
  }, [expand, dragIsActive, getCoords]);

  const onMouseUp = React.useCallback(e => {
    setSelection(selection => {
      if (selection) {
        return { ...selection, dragging: false };
      }
    })
  }, []);

  return {
    contains, // function that takes a row and column and returns a boolean
    onMouseDown,
    onMouseMove,
    onMouseUp
  };
}
