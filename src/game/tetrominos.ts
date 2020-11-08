import { Shapes } from "../svg";
import type { Shape } from "./eventReducer";


export const getShapeDimensions = (shape: Shape) => {
  const w = shape.reduce(((max, row) => Math.max(max, row.length)), 0);

  return [w, shape.length];
};


export { Shapes } from '../svg';
