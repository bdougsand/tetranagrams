export const WildCard = ' ';

// Based on https://hasbro-new.custhelp.com/app/answers/detail/a_id/19/~/how-many-of-each-letter-tile-are-included-in-a-scrabble-game
export const LetterCounts = {
  A: 9,
  B: 2,
  C: 2,
  D: 4,
  E: 12,
  F: 2,
  G: 3,
  H: 2,
  I: 9,
  J: 1,
  K: 1,
  L: 4,
  M: 2,
  N: 6,
  O: 8,
  P: 2,
  Q: 1,
  R: 6,
  S: 4,
  T: 6,
  U: 4,
  V: 2,
  W: 2,
  X: 1,
  Y: 2,
  Z: 1,
  [WildCard]: 2,
};


const ScrabbleTiles = 15*15*1.75;
export const PerTileLetterCounts = Object.keys(LetterCounts).reduce(
  (lc, l) => {
    lc[l] = LetterCounts[l]/ScrabbleTiles
    return lc;
  }, {} as { [k in keyof typeof LetterCounts]: number }
)
