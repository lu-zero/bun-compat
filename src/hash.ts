const P1 = 0x9e3779b185ebca87n;
const P2 = 0xc2b2ae3d27d4eb4fn;
const P3 = 0x165667b19e3779f9n;
const P4 = 0x85ebca77c2b2ae63n;
const P5 = 0x27d4eb2f165667c5n;
const M = 0xffffffffffffffffn;

function rotl64(x: bigint, r: number): bigint {
  return ((x << BigInt(r)) | (x >> BigInt(64 - r))) & M;
}

function round(acc: bigint, val: bigint): bigint {
  acc = (acc + val * P2) & M;
  acc = rotl64(acc, 31);
  acc = (acc * P1) & M;
  return acc;
}

function mergeRound(acc: bigint, val: bigint): bigint {
  val = round(0n, val);
  acc = (acc ^ val) & M;
  acc = (acc * P1) & M;
  acc = (acc + P4) & M;
  return acc;
}

function readU64(data: Uint8Array, offset: number): bigint {
  let v = 0n;
  for (let i = 0; i < 8; i++) {
    v |= BigInt(data[offset + i]) << BigInt(i * 8);
  }
  return v;
}

function xxHash64Impl(
  input: Uint8Array | string,
  seed: bigint | number = 0,
): bigint {
  const data =
    typeof input === "string" ? new TextEncoder().encode(input) : input;
  const len = data.length;
  const seedN = BigInt(seed) & M;
  let h64: bigint;

  if (len >= 32) {
    const limit = len - 32;
    let v1 = (seedN + P1 + P2) & M;
    let v2 = (seedN + P2) & M;
    let v3 = seedN;
    let v4 = (seedN - P1) & M;

    let i = 0;
    while (i <= limit) {
      v1 = round(v1, readU64(data, i));
      i += 8;
      v2 = round(v2, readU64(data, i));
      i += 8;
      v3 = round(v3, readU64(data, i));
      i += 8;
      v4 = round(v4, readU64(data, i));
      i += 8;
    }

    h64 = rotl64(v1, 1) + rotl64(v2, 7) + rotl64(v3, 12) + rotl64(v4, 18);
    h64 = mergeRound(h64, v1);
    h64 = mergeRound(h64, v2);
    h64 = mergeRound(h64, v3);
    h64 = mergeRound(h64, v4);
  } else {
    h64 = (seedN + P5) & M;
  }

  h64 = (h64 + BigInt(len)) & M;

  let i = len - (len % 32);
  for (; i + 8 <= len; i += 8) {
    h64 = (h64 ^ round(0n, readU64(data, i))) & M;
    h64 = rotl64(h64, 27);
    h64 = (h64 * P1) & M;
    h64 = (h64 + P4) & M;
  }

  if (i + 4 <= len) {
    const val =
      BigInt(data[i]) |
      (BigInt(data[i + 1]) << 8n) |
      (BigInt(data[i + 2]) << 16n) |
      (BigInt(data[i + 3]) << 24n);
    h64 = (h64 ^ (val * P1)) & M;
    h64 = rotl64(h64, 23);
    h64 = (h64 * P2) & M;
    h64 = (h64 + P3) & M;
    i += 4;
  }

  while (i < len) {
    h64 = (h64 ^ (BigInt(data[i]) * P5)) & M;
    h64 = rotl64(h64, 11);
    h64 = (h64 * P1) & M;
    i++;
  }

  h64 = (h64 ^ (h64 >> 33n)) & M;
  h64 = (h64 * P2) & M;
  h64 = (h64 ^ (h64 >> 29n)) & M;
  h64 = (h64 * P3) & M;
  h64 = (h64 ^ (h64 >> 32n)) & M;

  return h64;
}

const XXH32_PRIME1 = 0x9e3779b1;
const XXH32_PRIME2 = 0x85ebca77;
const XXH32_PRIME3 = 0xc2b2ae3d;
const XXH32_PRIME4 = 0x27d4eb2f;
const XXH32_PRIME5 = 0x165667b1;

function xxHash32Impl(input: Uint8Array | string, seed: number = 0): number {
  const data =
    typeof input === "string" ? new TextEncoder().encode(input) : input;
  const len = data.length;

  function rotl32(x: number, r: number): number {
    return ((x << r) | (x >>> (32 - r))) >>> 0;
  }

  let h32: number;

  if (len >= 16) {
    const limit = len - 16;
    let v1 = (seed + XXH32_PRIME1 + XXH32_PRIME2) >>> 0;
    let v2 = (seed + XXH32_PRIME2) >>> 0;
    let v3 = seed >>> 0;
    let v4 = (seed - XXH32_PRIME1) >>> 0;

    let i = 0;
    while (i <= limit) {
      v1 = rotl32(
        (v1 +
          ((data[i] |
            (data[i + 1] << 8) |
            (data[i + 2] << 16) |
            (data[i + 3] << 24)) >>>
            0) *
            XXH32_PRIME2) >>>
          0,
        13,
      );
      v1 = (v1 * XXH32_PRIME1) >>> 0;
      i += 4;
      v2 = rotl32(
        (v2 +
          ((data[i] |
            (data[i + 1] << 8) |
            (data[i + 2] << 16) |
            (data[i + 3] << 24)) >>>
            0) *
            XXH32_PRIME2) >>>
          0,
        13,
      );
      v2 = (v2 * XXH32_PRIME1) >>> 0;
      i += 4;
      v3 = rotl32(
        (v3 +
          ((data[i] |
            (data[i + 1] << 8) |
            (data[i + 2] << 16) |
            (data[i + 3] << 24)) >>>
            0) *
            XXH32_PRIME2) >>>
          0,
        13,
      );
      v3 = (v3 * XXH32_PRIME1) >>> 0;
      i += 4;
      v4 = rotl32(
        (v4 +
          ((data[i] |
            (data[i + 1] << 8) |
            (data[i + 2] << 16) |
            (data[i + 3] << 24)) >>>
            0) *
            XXH32_PRIME2) >>>
          0,
        13,
      );
      v4 = (v4 * XXH32_PRIME1) >>> 0;
      i += 4;
    }

    h32 =
      (rotl32(v1, 1) + rotl32(v2, 7) + rotl32(v3, 12) + rotl32(v4, 18)) >>> 0;
  } else {
    h32 = (seed + XXH32_PRIME5) >>> 0;
  }

  h32 = (h32 + len) >>> 0;

  let i = len - (len % 16);
  for (; i + 4 <= len; i += 4) {
    h32 =
      (rotl32(
        (h32 +
          ((data[i] |
            (data[i + 1] << 8) |
            (data[i + 2] << 16) |
            (data[i + 3] << 24)) >>>
            0) *
            XXH32_PRIME3) >>>
          0,
        17,
      ) *
        XXH32_PRIME4) >>>
      0;
  }

  while (i < len) {
    h32 =
      (rotl32((h32 + data[i] * XXH32_PRIME5) >>> 0, 11) * XXH32_PRIME1) >>> 0;
    i++;
  }

  h32 = ((h32 ^ (h32 >>> 15)) * XXH32_PRIME2) >>> 0;
  h32 = ((h32 ^ (h32 >>> 13)) * XXH32_PRIME3) >>> 0;
  h32 = (h32 ^ (h32 >>> 16)) >>> 0;

  return h32;
}

type HashCallable = {
  (input: string | Uint8Array | ArrayBuffer, seed?: number | string): number;
  xxHash64(input: Uint8Array | string, seed?: bigint | number): bigint;
  xxHash32(input: Uint8Array | string, seed?: number): number;
  wyhash(input: Uint8Array | string, seed?: number): bigint;
};

function hashCallable(
  input: string | Uint8Array | ArrayBuffer,
  seed?: number | string,
): number {
  const s = typeof seed === "string" ? parseInt(seed, 10) : (seed ?? 0);
  return xxHash32Impl(input as string | Uint8Array, s);
}

(hashCallable as Record<string, unknown>).xxHash64 = xxHash64Impl;
(hashCallable as Record<string, unknown>).xxHash32 = xxHash32Impl;

/**
 * wyhash implementation.
 *
 * Attempts to load the native WASM wyhash module (built via wasmbuild
 * from the `wyhash` Rust crate). Falls back to xxHash64 if the WASM
 * module is unavailable. The WASM version produces correct wyhash
 * values; the xxHash64 fallback produces different output.
 */
let wyhashImpl: (input: Uint8Array | string, seed?: number) => bigint =
  xxHash64Impl;

try {
  // deno-lint-ignore no-sloppy-imports
  const wasm = await import("./wasm/wyhash_wasm.js");
  const prev = wyhashImpl;
  wyhashImpl = (input: Uint8Array | string, seed?: number): bigint => {
    const data =
      typeof input === "string" ? new TextEncoder().encode(input) : input;
    return wasm.wyhash(data, BigInt(seed ?? 0));
  };
} catch {
  // WASM wyhash not available, using xxHash64 fallback
}

(hashCallable as Record<string, unknown>).wyhash = wyhashImpl;

export const hash = hashCallable as HashCallable;
