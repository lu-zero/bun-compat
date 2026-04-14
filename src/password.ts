const encoder = new TextEncoder();

async function pbkdf2(
  password: string,
  salt: Uint8Array,
  iterations: number,
  keyLen: number,
  hash: string,
): Promise<Uint8Array> {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: salt as BufferSource, iterations, hash },
    keyMaterial,
    keyLen * 8,
  );
  return new Uint8Array(bits);
}

function generateSalt(len: number = 16): Uint8Array {
  const salt = new Uint8Array(len);
  crypto.getRandomValues(salt);
  return salt;
}

function toHex(data: Uint8Array): string {
  return Array.from(data)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function fromHex(hex: string): Uint8Array {
  const data = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    data[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return data;
}

/**
 * Password hashing and verification.
 *
 * **Limitation**: All algorithms (bcrypt, argon2id, argon2d, argon2i)
 * are implemented using PBKDF2-SHA256. Hashes produced here are
 * **NOT compatible** with real Bun's bcrypt or argon2 output.
 * They use a custom `$algorithm$salt$hash` format that only this
 * shim can verify. Do not use for interoperability with Bun-native
 * hashed passwords.
 */
export const password: {
  hash(password: string, algorithm?: string): Promise<string>;
  verify(password: string, hashed: string): Promise<boolean>;
} = {
  async hash(password: string, algorithm: string = "bcrypt"): Promise<string> {
    if (algorithm === "bcrypt" || algorithm === undefined) {
      const salt = generateSalt(16);
      const hash = await pbkdf2(password, salt, 100000, 32, "SHA-256");
      return `$bcrypt$${toHex(salt)}$${toHex(hash)}`;
    }
    if (
      algorithm === "argon2id" ||
      algorithm === "argon2d" ||
      algorithm === "argon2i"
    ) {
      const salt = generateSalt(16);
      const hash = await pbkdf2(password, salt, 100000, 32, "SHA-256");
      return `$${algorithm}$${toHex(salt)}$${toHex(hash)}`;
    }
    throw new Error(`Unsupported algorithm: ${algorithm}`);
  },

  async verify(password: string, hashed: string): Promise<boolean> {
    const parts = hashed.split("$");
    if (parts.length !== 4) return false;
    const [_empty, _algo, saltHex, hashHex] = parts;
    const salt = fromHex(saltHex);
    const expected = fromHex(hashHex);
    const actual = await pbkdf2(password, salt, 100000, 32, "SHA-256");
    if (actual.length !== expected.length) return false;
    let diff = 0;
    for (let i = 0; i < actual.length; i++) {
      diff |= actual[i] ^ expected[i];
    }
    return diff === 0;
  },
};
