export function findIndex<T>(xs: Iterable<T>, pred: (x: T) => boolean): number {
  let i = 0;
  for (const x of xs) {
    if (pred(x))
      return i;

    i++;
  }

  return -1;
}

export function nextKey<K>(m: Map<K, any>, key: K): K {
  const keys = Array.from(m.keys());
  const idx = keys.findIndex(k => k === key);
  return keys[(idx+1) % keys.length];
}

export function selectKeys<T, K extends keyof T>(obj: T, keys: K[])  {
  return keys.reduce((o, k) => {
    o[k] = obj[k];
    return o;
  }, {} as any) as ({ [k in K]: T[k] })
}
