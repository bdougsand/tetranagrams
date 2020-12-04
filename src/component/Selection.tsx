import * as React from 'react';


type Rect = { x: number, y: number, width: number, height: number };
const getRect = (x, y, w, h) => {
  if (w < 0) {
    x += w;
    w = Math.abs(w);
  }

  if (h <= 0) {
    y += h;
    h = Math.abs(h);
  }

  return {
    x, y, width: w, height: h
  };
};

const inside = (p1, l1, p2, l2) => {
  const p2_2 = p2 + l2;
  const p1left = p1 < p2;
  const p1inside = !p1left && p1 <= p2_2;

  const p1_2 = p1 + l1;
  const p2right = p1_2 > p2_2;
  const p2inside = !p2right && p1_2 >= p2;

  return (p1left ? (p2right || p2inside) : p1inside)
}

const overlap = (rect1: Rect, rect2: Rect) => {
  return inside(rect1.x, rect1.width, rect2.x, rect2.width) &&
         inside(rect1.y, rect1.height, rect2.y, rect2.height);
};

type EnabledSelectionOptions = {
  onSelectionChange?: (selection: string[]) => any,
  selector: string,
  ignore?: string,
  getID?: (element: Element) => string,
};

type SelectionOptions = { enabled: false } | ({ enabled: true, } & EnabledSelectionOptions);

const defaultSelectionOptions: SelectionOptions = {
  enabled: false,
};

type SelectionState = {
  start: [number, number]
  dims: [number, number]
};

type SelectionContextType = { setSelectionOptions: (options: SelectionOptions) => void };
const SelectionContext = React.createContext(null as SelectionContextType);

export default class Selection extends React.Component {
  state = {
    options: defaultSelectionOptions,
    selecting: null as SelectionState,
  }

  div: React.RefObject<HTMLDivElement>

  constructor(props) {
    super(props);
      this.div = React.createRef();
  }

  setSelectionOptions = (options: SelectionOptions) => {
    this.setState({ options });
  }

  getRect() {
    let { start: [x, y], dims: [w, h] } = this.state.selecting;

    return getRect(x, y, w, h);
  }

  renderSelectionArea() {
    if (!this.state.selecting)
      return null;

    const { x, y, width, height } = this.getRect();

    const style = {
      left: `${x}px`,
      top: `${y}px`,
      width: `${width}px`,
      height: `${height}px`
    };

    return (
      <div className="selection-area" style={style} />
    );
  }

  onMouseDown = e => {
    const { options } = this.state;

    if (!options.enabled || (options.ignore && (e.nativeEvent.target as Element).matches(options.ignore)))
      return;

    e.preventDefault();
    e.stopPropagation();

    this.setState({
      selecting: {
        start: [e.pageX, e.pageY],
        dims: [0, 0],
      }
    });
  }

  onMouseUp = () => {
    this.setState({ selecting: null });
  }

  onMouseMove = e => {
    if (!this.state.selecting)
      return;

    e.preventDefault();

    const {start, ...rest} = this.state.selecting;
    const [x, y] = start;

    this.setState({
      selecting: {
        ...rest,
        start,
        dims: [e.pageX - x, e.pageY - y]
      }
    });

    this.updateSelection();
  }

  updateSelection() {
    const { options, selecting } = this.state;
    if (!options.enabled || !selecting)
      return;

    const sel = this.getRect();
    const selection = [];

    for (const elt of this.div.current.querySelectorAll(options.selector)) {
      const rect = elt.getBoundingClientRect();
      if (overlap(sel, rect)) {
        selection.push(options.getID(elt));
      }
    }

    options.onSelectionChange?.(selection);
  }

  render() {
    const { options } = this.state;
    const { enabled } = options;

    const divProps = enabled ?
                     { onMouseDown: this.onMouseDown,
                       onMouseUp: this.onMouseUp,
                       onMouseMove: this.onMouseMove }
                   : {};

    return (
      <SelectionContext.Provider value={{ setSelectionOptions: this.setSelectionOptions }}>
        <div className="selection" ref={this.div} {...divProps}>
          {this.props.children}
          {enabled && this.renderSelectionArea()}
        </div>
      </SelectionContext.Provider>
    );
  }
}

export const useSelection = (options: Omit<EnabledSelectionOptions, 'onSelectionChange'>) => {
  const { setSelectionOptions } = React.useContext(SelectionContext);
  const [selection, setSelection] = React.useState(new Set<string>());

  React.useEffect(() => {
    setSelectionOptions({
      enabled: true,
      onSelectionChange(ids) {
        setSelection(new Set(ids));
      },
      ...options
    });

    // Disable selection when this component unmounts
    return () => {
      setSelectionOptions({
        enabled: false
      });
    };
  }, []);

  return selection;
};
