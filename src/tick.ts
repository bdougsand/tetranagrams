import { useEffect, useRef, useState } from 'react';


export const useGameTick = (ms, dispatch: React.Dispatch<any>, scale=1) => {
    const state = useRef(null);
  
    useEffect(() => {
      if (state.current) {
        const { interval } = state.current;
        if (interval) {
          clearTimeout(interval);
        }
      }
  
      const interval = setInterval(() => {
        dispatch({
          type: 'TICK',
          payload: {
            delta: (Date.now() - state.current.last)*state.current.scale,
            tick: state.current.tick++,
          }
        });
  
        state.current.last = Date.now();
      }, ms);
  
      state.current = {
        interval,
        last: Date.now(),
        scale,
        tick: 0
      };
  
      return () => {
        console.log('cleaning up');
        clearTimeout(state.current.interval);
        state.current = null;
      };
    }, [ms, dispatch, scale]);
  
    useEffect(() => {
      if (state.current)
        state.current.scale = scale;
  
    }, [scale]);
  };