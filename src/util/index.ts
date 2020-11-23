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
