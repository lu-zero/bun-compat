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

const fileState = new WeakMap<FileSink, { file: Deno.FsFile; path: string }>();

export class FileSink {
  constructor(path: string) {
    fileState.set(this, {
      file: Deno.openSync(path, {
        write: true,
        create: true,
        append: true,
      }),
      path,
    });
  }

  write(data: string | Uint8Array): number {
    const bytes = typeof data === "string"
      ? new TextEncoder().encode(data)
      : data;
    return fileState.get(this)!.file.writeSync(bytes);
  }

  flush(): number | undefined {
    fileState.get(this)!.file.syncSync();
    return 0;
  }

  end(): void {
    const s = fileState.get(this)!;
    try {
      s.file.syncSync();
    } catch {}
    s.file.close();
  }

  ref(): void {}

  unref(): void {}
}

const bunPaths = new WeakMap<BunFile, string>();

export class BunFile {
  constructor(input: string | URL) {
    bunPaths.set(this, toPath(input));
  }

  get path(): string {
    return bunPaths.get(this)!;
  }

  get type(): string {
    return mimeType(bunPaths.get(this)!);
  }

  async text(): Promise<string> {
    return Deno.readTextFile(bunPaths.get(this)!);
  }

  async json(): Promise<any> {
    return JSON.parse(await Deno.readTextFile(bunPaths.get(this)!));
  }

  async arrayBuffer(): Promise<ArrayBuffer> {
    const data = await Deno.readFile(bunPaths.get(this)!);
    return data.buffer as ArrayBuffer;
  }

  async bytes(): Promise<Uint8Array> {
    return Deno.readFile(bunPaths.get(this)!);
  }

  async exists(): Promise<boolean> {
    try {
      await Deno.stat(bunPaths.get(this)!);
      return true;
    } catch (err) {
      if (err instanceof Deno.errors.NotFound) return false;
      throw err;
    }
  }

  async write(data: string | Uint8Array | ArrayBuffer | Blob): Promise<void> {
    const { write } = await import("./write.ts");
    await write(bunPaths.get(this)!, data);
  }

  writer(): FileSink {
    return new FileSink(bunPaths.get(this)!);
  }

  get writable(): WritableStream<Uint8Array> {
    const writer = Deno.openSync(bunPaths.get(this)!, {
      write: true,
      create: true,
      truncate: true,
    });
    return writer.writable;
  }

  get readable(): ReadableStream<Uint8Array> {
    const file = Deno.openSync(bunPaths.get(this)!, { read: true });
    return file.readable;
  }

  get size(): number | undefined {
    try {
      return Deno.statSync(bunPaths.get(this)!).size;
    } catch {
      return undefined;
    }
  }

  async stat(): Promise<BunStat | null> {
    try {
      const info = await Deno.stat(bunPaths.get(this)!);
      return toBunStat(info);
    } catch {
      return null;
    }
  }

  slice(start?: number, end?: number, contentType?: string): BunFile {
    return new BunFile(bunPaths.get(this)!);
  }

  async unlink(): Promise<void> {
    await Deno.remove(bunPaths.get(this)!);
  }
}

export function file(input: string | URL): BunFile {
  return new BunFile(input);
}
