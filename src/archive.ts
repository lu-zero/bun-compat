import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as zlib from "node:zlib";

type TarEntryInput = string | File | Uint8Array;

interface ArchiveFile {
  name: string;
  size: number;
  type: "file" | "directory";
  read(): Promise<Uint8Array>;
}

class ArchiveFileEntry implements ArchiveFile {
  #data: Uint8Array;
  name: string;
  size: number;
  type: "file" | "directory" = "file";

  constructor(name: string, data: Uint8Array) {
    this.name = name;
    this.#data = data;
    this.size = data.byteLength;
  }

  async read(): Promise<Uint8Array> {
    return this.#data;
  }
}

export class Archive {
  #bytes: Uint8Array;

  constructor(data: Uint8Array | ArrayBuffer) {
    this.#bytes = data instanceof ArrayBuffer ? new Uint8Array(data) : data;
  }

  async files(): Promise<Map<string, ArchiveFileEntry>> {
    const result = new Map<string, ArchiveFileEntry>();

    const isGzipped = this.#bytes[0] === 0x1f && this.#bytes[1] === 0x8b;

    let tarBytes: Uint8Array;
    if (isGzipped) {
      tarBytes = await new Promise<Uint8Array>((resolve, reject) => {
        zlib.gunzip(this.#bytes, (err, buf) => {
          if (err) reject(err);
          else {
            resolve(new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength));
          }
        });
      });
    } else {
      tarBytes = this.#bytes;
    }

    let offset = 0;
    while (offset < tarBytes.length - 512) {
      const header = tarBytes.subarray(offset, offset + 512);
      if (header.every((b) => b === 0)) break;

      const nameBytes = header.subarray(0, 100);
      const name = new TextDecoder().decode(nameBytes).replace(/\0/g, "");
      const sizeOctal = new TextDecoder()
        .decode(header.subarray(124, 136))
        .replace(/\0/g, "")
        .trim();
      const typeFlag = header[156];

      const size = parseInt(sizeOctal, 8) || 0;

      if (name && typeFlag !== 53 && typeFlag !== 76) {
        const dataBlocks = Math.ceil(size / 512);
        const fileData = tarBytes.subarray(offset + 512, offset + 512 + size);
        result.set(name, new ArchiveFileEntry(name, new Uint8Array(fileData)));
        offset += 512 + dataBlocks * 512;
      } else {
        const dataBlocks = Math.ceil(size / 512);
        offset += 512 + dataBlocks * 512;
      }
    }

    return result;
  }

  static async write(
    outputPath: string,
    entries:
      | Record<string, TarEntryInput>
      | Array<{ name: string; data: string | Uint8Array }>,
    opts?: { compress?: boolean | "gzip" },
  ): Promise<void> {
    await fs.mkdir(path.dirname(outputPath), { recursive: true });

    const normalizedEntries: Record<string, string | Uint8Array> = {};
    if (Array.isArray(entries)) {
      for (const e of entries) {
        normalizedEntries[e.name] = e.data;
      }
    } else {
      for (const [k, v] of Object.entries(entries)) {
        if (typeof v === "string") {
          normalizedEntries[k] = v;
        } else if (v instanceof Uint8Array) {
          normalizedEntries[k] = v;
        } else if (v instanceof File) {
          normalizedEntries[k] = new Uint8Array(await v.arrayBuffer());
        } else {
          normalizedEntries[k] = v;
        }
      }
    }

    const tarBuffers: Uint8Array[] = [];

    for (const [name, content] of Object.entries(normalizedEntries)) {
      const data = typeof content === "string"
        ? new TextEncoder().encode(content)
        : content;
      const header = new Uint8Array(512);

      const nameBytes = new TextEncoder().encode(name);
      header.set(nameBytes.subarray(0, Math.min(nameBytes.length, 100)));

      const sizeStr = data.byteLength.toString(8).padStart(11, "0") + "\0";
      header.set(new TextEncoder().encode(sizeStr), 124);

      header.set(new TextEncoder().encode("0000000\0"), 100);
      header.set(new TextEncoder().encode("0000000\0"), 108);
      header.set(new TextEncoder().encode("0000000\0"), 116);
      header[156] = 0x30;

      const mtimeStr = Math.floor(Date.now() / 1000)
        .toString(8)
        .padStart(11, "0") + "\0";
      header.set(new TextEncoder().encode(mtimeStr), 136);

      let checksum = 0;
      for (let i = 0; i < 512; i++) {
        checksum += i >= 148 && i < 156 ? 32 : header[i];
      }
      const checkStr = checksum.toString(8).padStart(6, "0") + "\0 ";
      header.set(new TextEncoder().encode(checkStr), 148);

      tarBuffers.push(header);
      tarBuffers.push(data);

      const padding = (512 - (data.byteLength % 512)) % 512;
      if (padding > 0) {
        tarBuffers.push(new Uint8Array(padding));
      }
    }

    tarBuffers.push(new Uint8Array(1024));

    const totalLen = tarBuffers.reduce((s, b) => s + b.byteLength, 0);
    const tarData = new Uint8Array(totalLen);
    let off = 0;
    for (const buf of tarBuffers) {
      tarData.set(buf, off);
      off += buf.byteLength;
    }

    if (opts?.compress === true || opts?.compress === "gzip") {
      const gzipped = await new Promise<Uint8Array>((resolve, reject) => {
        zlib.gzip(tarData, (err, buf) => {
          if (err) reject(err);
          else {
            resolve(new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength));
          }
        });
      });
      await fs.writeFile(outputPath, gzipped);
    } else {
      await fs.writeFile(outputPath, tarData);
    }
  }
}
