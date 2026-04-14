import * as nodeCrypto from "node:crypto";

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
