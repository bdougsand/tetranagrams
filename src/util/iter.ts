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

export function *map<T, S>(xs: Iterable<T>, fn: (x: T, idx: number) => S) {
  let i = 0;
  for (const x of xs)
    yield fn(x, i++);
}

export function updateMap<K, V>(m: Map<K, V>, it: Iterable<[K, V]>, merge = Object.assign) {
  m = new Map(m);
  for (const [k, v] of it) {
    if (m.has(k))
      m.set(k, merge(m.get(k), v));
    else
      m.set(k, v);
  }

  return m;
}

export function *range(start: number, end: number) {
  let i = start;
  while (i < end) {
    yield i++;
  }
}

export function *concat<T>(...iterables: Iterable<T>[]) {
  for (const it of iterables)
    yield *it;
}

export function zip<S, T>(itA: Iterable<S>, itB: Iterable<T>): Generator<[S, T]>;
export function zip<S, T, U>(itA: Iterable<S>, itB: Iterable<T>, itC: Iterable<U>): Generator<[S, T, U]>;
export function zip<S, T, U, V>(itA: Iterable<S>, itB: Iterable<T>, itC: Iterable<U>, itD: Iterable<V>): Generator<[S, T, U, V]>;
export function zip<S, T, U, V, W>(itA: Iterable<S>, itB: Iterable<T>, itC: Iterable<U>, itD: Iterable<V>, itE: Iterable<W>): Generator<[S, T, U, V, W]>;
export function *zip(...iterables: any[]) {
  const iterators = iterables.map(it => it[Symbol.iterator]());

  while (true) {
    const nextVals = [];
    for (const it of iterators) {
      const next = it.next();
      if (next.done)
        return;
      nextVals.push(next.value);
    }
    yield nextVals;
  }
}

type Reducer<T, S> = (result: S, currentVal: T, index: number) => S;
export function reduce<T, S=T>(xs: Iterable<T>, fn: Reducer<T, S>, init?: S) {
  const iter = xs[Symbol.iterator]();
  let result = init;

  let i = 0, current: IteratorResult<T>;

  if (init === undefined) {
    current = iter.next();
    result = current.value;
  }

  current = iter.next();

  while (!current.done) {
    result = fn(result, current.value, i++);
    current = iter.next();
  }

  return result;
}
