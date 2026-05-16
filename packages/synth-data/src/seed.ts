// Deterministic seeding utilities. We deliberately roll our own tiny PRNG
// (xorshift32) so a given seed string always produces the same synthetic
// person/document chain — important for repeatable demo runs and for the
// scenario engine, which needs to know "the truth" of a generated document
// in order to score the user's validation step.

/**
 * 32-bit MurmurHash3-ish mixing function. Turns a seed string into a 32-bit
 * unsigned integer. Used to seed both our xorshift PRNG and `faker.seed`.
 */
export function xmur3(str: string): number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  h ^= h >>> 16;
  return h >>> 0;
}

/**
 * Build a deterministic 32-bit xorshift PRNG from a seed string. Each call
 * returns a float in `[0, 1)`. Same seed → same sequence forever.
 */
export function seedRng(seed: string): () => number {
  let state = xmur3(seed);
  if (state === 0) state = 0x9e3779b9; // xorshift can't start at 0
  return () => {
    state ^= state << 13;
    state >>>= 0;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    // Divide by 2^32 to land in [0, 1).
    return state / 0x100000000;
  };
}

/** Numeric seed for `faker.seed(n)` derived from a string seed. */
export function fakerSeedFrom(seed: string): number {
  return xmur3(seed);
}

/** Generate a fresh random seed string (non-deterministic). */
export function randomSeed(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}
