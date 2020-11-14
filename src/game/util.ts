export function findIndex<T>(xs: Iterable<T>, pred: (x: T) => boolean): number {
  let i = 0;
  for (const x of xs) {
    if (pred(x))
      return i;

    i++;
  }

  return -1;
}

export function nextKey<K>(m: Map<K, any>, key: K=null): K {
  const keys = m.keys();
  const first = keys.next();

  let k = first;
  while (!k.done) {
    if (k.value === key) {
      k = keys.next();
      break;
    }

    k = keys.next();
  }

  return k.value || first.value
}

export function selectKeys<T, K extends keyof T>(obj: T, keys: K[])  {
  return keys.reduce((o, k) => {
    o[k] = obj[k];
    return o;
  }, {} as any) as ({ [k in K]: T[k] })
}
