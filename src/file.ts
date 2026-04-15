import { contentType } from "@std/media-types";
import * as path from "@std/path";

function toPath(p: string | URL): string {
  if (typeof p === "string") return p;
  if (p.protocol === "file:") return decodeURIComponent(p.pathname);
  throw new TypeError(`Unsupported URL protocol: ${p.protocol}`);
}

function mimeType(p: string): string {
  return contentType(path.extname(p)) || "application/octet-stream";
}

export class FileSink {
  #file: Deno.FsFile;
  #path: string;

  constructor(path: string) {
    this.#path = path;
    this.#file = Deno.openSync(path, {
      write: true,
      create: true,
      append: true,
    });
  }

  write(data: string | Uint8Array): number {
    const bytes = typeof data === "string"
      ? new TextEncoder().encode(data)
      : data;
    const n = this.#file.writeSync(bytes);
    return n;
  }

  flush(): number | undefined {
    this.#file.syncSync();
    return 0;
  }

  end(): void {
    try {
      this.#file.syncSync();
    } catch {}
    this.#file.close();
  }
}

export class BunFile {
  #path: string;

  constructor(input: string | URL) {
    this.#path = toPath(input);
  }

  get path(): string {
    return this.#path;
  }

  get type(): string {
    return mimeType(this.#path);
  }

  async text(): Promise<string> {
    return Deno.readTextFile(this.#path);
  }

  async json(): Promise<any> {
    return JSON.parse(await Deno.readTextFile(this.#path));
  }

  async arrayBuffer(): Promise<ArrayBuffer> {
    const data = await Deno.readFile(this.#path);
    return data.buffer as ArrayBuffer;
  }

  async bytes(): Promise<Uint8Array> {
    return Deno.readFile(this.#path);
  }

  async exists(): Promise<boolean> {
    try {
      await Deno.stat(this.#path);
      return true;
    } catch (err) {
      if (err instanceof Deno.errors.NotFound) return false;
      throw err;
    }
  }

  async write(data: string | Uint8Array | ArrayBuffer | Blob): Promise<void> {
    const { write } = await import("./write.ts");
    await write(this.#path, data);
  }

  writer(): FileSink {
    return new FileSink(this.#path);
  }

  get writable(): WritableStream<Uint8Array> {
    const writer = Deno.openSync(this.#path, {
      write: true,
      create: true,
      truncate: true,
    });
    return writer.writable;
  }

  get readable(): ReadableStream<Uint8Array> {
    const file = Deno.openSync(this.#path, { read: true });
    return file.readable;
  }

  get size(): number | undefined {
    try {
      return Deno.statSync(this.#path).size;
    } catch {
      return undefined;
    }
  }

  async stat(): Promise<Deno.FileInfo | null> {
    try {
      return await Deno.stat(this.#path);
    } catch {
      return null;
    }
  }
}

export function file(input: string | URL): BunFile {
  return new BunFile(input);
}
