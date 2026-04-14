import * as path from "@std/path";

function toFilePath(p: string | URL): string {
  if (typeof p === "string") return p;
  if (p.protocol === "file:") return decodeURIComponent(p.pathname);
  throw new TypeError(`Unsupported URL protocol: ${p.protocol}`);
}

async function ensureDir(filePath: string): Promise<void> {
  const dir = path.dirname(filePath);
  try {
    await Deno.mkdir(dir, { recursive: true });
  } catch (err) {
    if (!(err instanceof Deno.errors.AlreadyExists)) throw err;
  }
}

function toUint8Array(
  data: string | Uint8Array | ArrayBuffer | Blob,
): Uint8Array | string {
  if (typeof data === "string") return data;
  if (data instanceof Uint8Array) return data;
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  throw new TypeError("Unsupported data type for Bun.write");
}

/**
 * Write data to a file, creating parent directories automatically.
 *
 * **Limitation**: Only supports `string`, `Uint8Array`, `ArrayBuffer`,
 * and `Blob` inputs. Bun's `Bun.write()` also accepts `ReadableStream`,
 * `Response`, and `BunFile` — these are not yet implemented.
 */
export async function write(
  destination: string | URL,
  data: string | Uint8Array | ArrayBuffer | Blob,
): Promise<void> {
  const filePath = toFilePath(destination);
  await ensureDir(filePath);
  const normalized = toUint8Array(data);
  if (typeof normalized === "string") {
    await Deno.writeTextFile(filePath, normalized);
  } else {
    await Deno.writeFile(filePath, normalized);
  }
}
