export function setIn(obj: any, path: string[], val: any) {
  if (!path.length)
    return obj;

  let here = obj;
  for (const k of path.slice(0, -1)) {
    if (!(k in here)) {
      here[k] = {};
    }
    here = here[k];
  }

  here[path[path.length-1]] = val;
}

export function getFormData(target: HTMLFormElement, options: any = {}) {
  for (const elt of Array.from(target.elements) as HTMLInputElement[]) {
    if (!elt.name) continue;

    setIn(options, elt.name.split('.'), elt.value);
  }

  return options;
}

type ClassNameArg = string | { [k in string]: any } | ClassNameArg[];
export function _classnames(args: ClassNameArg[]): string[] {
  const ks: string[] = [];

  for (const arg of args) {
    if (!arg)
      continue;

    if (Array.isArray(arg))
      ks.push(..._classnames(arg));
    else if (typeof arg === 'string')
      ks.push(arg);
    else
      ks.push(...Object.keys(arg).filter(k => !!arg[k]));
  }

  return ks;
}

export function classnames(...args: ClassNameArg[]): string {
  return _classnames(args).join(' ');
}

export function getAttributes<K extends string>(e: { target: HTMLElement }, attributes: K[]): { [k in K]: string } {
  let target = e.target;
  const remaining = new Set(attributes);
  const data: any = {};

  while (target) {
    for (const attr of remaining) {
      const val = target.getAttribute?.(attr);
      if (val) {
        data[attr] = val;
        remaining.delete(attr);
        if (!remaining.size)
          return data;
      }
    }

    target = target.parentElement;
  }

  return data;
}
