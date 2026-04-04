export interface JSONLChunkResult {
  values: unknown[];
  error: unknown;
  read: number;
  done: boolean;
}

function parseLines(text: string): unknown[] {
  const results: unknown[] = [];
  for (const line of text.split("\n")) {
    if (line.trim() === "") continue;
    results.push(JSON.parse(line));
  }
  return results;
}

export const JSONL: {
  parse(input: Uint8Array | string): unknown[];
  parseChunk(
    input: Uint8Array | string,
    start?: number,
    end?: number,
  ): JSONLChunkResult;
} = {
  parse(input: Uint8Array | string): unknown[] {
    const text = typeof input === "string"
      ? input
      : new TextDecoder().decode(input);
    return parseLines(text);
  },

  parseChunk(
    input: Uint8Array | string,
    start?: number,
    end?: number,
  ): JSONLChunkResult {
    let data: Uint8Array;
    let offset = 0;

    if (typeof input === "string") {
      data = new TextEncoder().encode(input);
    } else {
      data = input;
      offset = start ?? 0;
    }

    const stop = end ?? data.length;
    const slice = data.slice(offset, stop);
    const text = new TextDecoder().decode(slice);
    const lines = text.split("\n");

    const values: unknown[] = [];
    let error: unknown = undefined;
    let readBytes = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.trim() === "") {
        if (i < lines.length - 1) {
          readBytes += new TextEncoder().encode(line + "\n").length;
        }
        continue;
      }

      try {
        values.push(JSON.parse(line));
        readBytes += new TextEncoder().encode(line + "\n").length;
      } catch (err) {
        if (i === lines.length - 1) {
          error = err;
          const lastNewline = text.lastIndexOf("\n", text.length - 2);
          if (lastNewline >= 0) {
            readBytes =
              new TextEncoder().encode(text.slice(0, lastNewline + 1)).length;
          }
        } else {
          error = err;
        }
        break;
      }
    }

    const lastByte = data[stop - 1];
    const done = !error && (stop === 0 || lastByte === 0x0a);
    return { values, error, read: readBytes + offset, done };
  },
};
