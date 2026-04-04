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

export const hash: {
  xxHash64(input: Uint8Array | string, seed?: bigint | number): bigint;
  wyhash(input: Uint8Array | string, seed?: bigint | number): bigint;
} = {
  xxHash64(input: Uint8Array | string, seed: bigint | number = 0): bigint {
    const data = typeof input === "string"
      ? new TextEncoder().encode(input)
      : input;
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
      const val = BigInt(data[i]) | (BigInt(data[i + 1]) << 8n) |
        (BigInt(data[i + 2]) << 16n) | (BigInt(data[i + 3]) << 24n);
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
  },

  wyhash(input: Uint8Array | string, seed: bigint | number = 0): bigint {
    return hash.xxHash64(input, seed);
  },
};
