/**
 * Synchronous cryptographic hasher compatible with Bun's `Bun.CryptoHasher`.
 *
 * Uses `node:crypto` under the hood. Supports SHA-1, MD5, SHA-256,
 * SHA-384, and SHA-512. Algorithms `xxhash64` and `wyhash` are accepted
 * but mapped to their Node.js equivalents (not real xxHash/wyhash).
 *
 * **Limitation**: `digest(encoding?)` without arguments returns
 * `Uint8Array` instead of Bun's `Buffer`. `digestSync()` is identical
 * to `digest()` since `node:crypto` is synchronous.
 */
import * as nodeCrypto from "node:crypto";
import type { Buffer } from "node:buffer";

export class CryptoHasher {
  #hash: nodeCrypto.Hash;

  constructor(algorithm: string) {
    const algoMap: Record<string, string> = {
      sha256: "sha256",
      "sha-256": "sha256",
      sha384: "sha384",
      "sha-384": "sha384",
      sha512: "sha512",
      "sha-512": "sha512",
      sha1: "sha1",
      md5: "md5",
      xxhash64: "xxhash64",
      wyhash: "wyhash",
    };
    const algo = algoMap[algorithm.toLowerCase()] ?? algorithm;
    this.#hash = nodeCrypto.createHash(algo);
  }

  update(data: string | Uint8Array | ArrayBuffer | Buffer): this {
    this.#hash.update(data as string | Uint8Array | ArrayBuffer | Buffer);
    return this;
  }

  digest(
    encoding?: "hex" | "base64" | "buffer" | "latin1",
  ): Uint8Array | string {
    if (encoding === "hex") return this.#hash.digest("hex");
    if (encoding === "base64") return this.#hash.digest("base64");
    return new Uint8Array(
      this.#hash.digest().buffer,
      this.#hash.digest().byteOffset,
      this.#hash.digest().byteLength,
    );
  }

  digestSync(
    encoding?: "hex" | "base64" | "buffer" | "latin1",
  ): Uint8Array | string {
    return this.digest(encoding);
  }
}
