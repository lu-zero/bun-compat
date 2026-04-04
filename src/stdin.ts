function stdinStream(): ReadableStream<Uint8Array> {
  return Deno.stdin.readable;
}

async function stdinText(): Promise<string> {
  const chunks: Uint8Array[] = [];
  const reader = Deno.stdin.readable.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const total = chunks.reduce((sum, c) => sum + c.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return new TextDecoder().decode(result);
}

export const stdin: {
  text: () => Promise<string>;
  stream: () => ReadableStream<Uint8Array>;
  readonly readable: ReadableStream<Uint8Array>;
} = {
  text: stdinText,
  stream: stdinStream,
  get readable(): ReadableStream<Uint8Array> {
    return Deno.stdin.readable;
  },
};
