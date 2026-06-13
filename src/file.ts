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

export interface BunStat {
  size: number;
  mtimeMs: number | null;
  atimeMs: number | null;
  ctimeMs: number | null;
  birthtimeMs: number | null;
  mode: number | null;
  uid: number | null;
  gid: number | null;
  dev: number | null;
  ino: number | bigint | null;
  nlink: number | null;
  rdev: number | null;
  blksize: number | null;
  blocks: number | null;
  isFile(): boolean;
  isDirectory(): boolean;
  isSymlink(): boolean;
}

function toBunStat(info: Deno.FileInfo): BunStat {
  return {
    size: info.size,
    mtimeMs: info.mtime ? info.mtime.getTime() : null,
    atimeMs: info.atime ? info.atime.getTime() : null,
    ctimeMs: info.ctime ? info.ctime.getTime() : null,
    birthtimeMs: info.birthtime ? info.birthtime.getTime() : null,
    mode: info.mode ?? null,
    uid: info.uid ?? null,
    gid: info.gid ?? null,
    dev: info.dev ?? null,
    ino: info.ino ?? null,
    nlink: info.nlink ?? null,
    rdev: info.rdev ?? null,
    blksize: info.blksize ?? null,
    blocks: info.blocks ?? null,
    isFile: () => info.isFile,
    isDirectory: () => info.isDirectory,
    isSymlink: () => info.isSymlink,
  };
}

export class FileSink {
  _file: Deno.FsFile;
  _path: string;

  constructor(path: string) {
    this._path = path;
    this._file = Deno.openSync(path, {
      write: true,
      create: true,
      append: true,
    });
  }

  write(data: string | Uint8Array): number {
    const bytes = typeof data === "string"
      ? new TextEncoder().encode(data)
      : data;
    const n = this._file.writeSync(bytes);
    return n;
  }

  flush(): number | undefined {
    this._file.syncSync();
    return 0;
  }

  end(): void {
    try {
      this._file.syncSync();
    } catch {}
    this._file.close();
  }

  ref(): void {}

  unref(): void {}
}

export class BunFile {
  _path: string;

  constructor(input: string | URL) {
    this._path = toPath(input);
  }

  get path(): string {
    return this._path;
  }

  get type(): string {
    return mimeType(this._path);
  }

  async text(): Promise<string> {
    return Deno.readTextFile(this._path);
  }

  async json(): Promise<any> {
    return JSON.parse(await Deno.readTextFile(this._path));
  }

  async arrayBuffer(): Promise<ArrayBuffer> {
    const data = await Deno.readFile(this._path);
    return data.buffer as ArrayBuffer;
  }

  async bytes(): Promise<Uint8Array> {
    return Deno.readFile(this._path);
  }

  async exists(): Promise<boolean> {
    try {
      await Deno.stat(this._path);
      return true;
    } catch (err) {
      if (err instanceof Deno.errors.NotFound) return false;
      throw err;
    }
  }

  async write(data: string | Uint8Array | ArrayBuffer | Blob): Promise<void> {
    const { write } = await import("./write.ts");
    await write(this._path, data);
  }

  writer(): FileSink {
    return new FileSink(this._path);
  }

  get writable(): WritableStream<Uint8Array> {
    const writer = Deno.openSync(this._path, {
      write: true,
      create: true,
      truncate: true,
    });
    return writer.writable;
  }

  get readable(): ReadableStream<Uint8Array> {
    const file = Deno.openSync(this._path, { read: true });
    return file.readable;
  }

  get size(): number | undefined {
    try {
      return Deno.statSync(this._path).size;
    } catch {
      return undefined;
    }
  }

  async stat(): Promise<BunStat | null> {
    try {
      const info = await Deno.stat(this._path);
      return toBunStat(info);
    } catch {
      return null;
    }
  }

  slice(start?: number, end?: number, contentType?: string): BunFile {
    return new BunFile(this._path);
  }

  async unlink(): Promise<void> {
    await Deno.remove(this._path);
  }
}

export function file(input: string | URL): BunFile {
  return new BunFile(input);
}
