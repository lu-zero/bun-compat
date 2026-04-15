interface SocketHandlers {
  open?(socket: DenoSocket): void;
  data?(socket: DenoSocket, data: Uint8Array): void;
  close?(socket: DenoSocket): void;
  error?(socket: DenoSocket, error: Error): void;
}

interface DenoSocket {
  write(data: string | Uint8Array): number;
  flush(): void;
  end(): void;
  reload(options: { socket: SocketHandlers }): void;
}

function createSocket(conn: Deno.Conn, handlers: SocketHandlers): DenoSocket {
  let active = true;
  let currentHandlers = handlers;
  const writer = conn.writable.getWriter();
  const reader = (conn.readable as ReadableStream<Uint8Array>).getReader();

  const socket: DenoSocket = {
    write(data: string | Uint8Array): number {
      const bytes = typeof data === "string"
        ? new TextEncoder().encode(data)
        : data;
      writer.write(bytes).catch(() => {});
      return bytes.byteLength;
    },
    flush() {},
    end() {
      if (!active) return;
      active = false;
      writer.close().catch(() => {});
      reader.cancel().catch(() => {});
      try {
        conn.close();
      } catch {}
    },
    reload(options: { socket: SocketHandlers }) {
      currentHandlers = options.socket;
    },
  };

  (async () => {
    try {
      while (active) {
        const result = await reader.read();
        if (result.done) break;
        currentHandlers.data?.(socket, new Uint8Array(result.value));
      }
    } catch {
      // connection closed
    } finally {
      if (active) {
        active = false;
        currentHandlers.close?.(socket);
      }
    }
  })();

  currentHandlers.open?.(socket);
  return socket;
}

interface ListenResult {
  port: number;
  hostname: string;
  stop(): void;
}

export function listen(options: {
  hostname?: string;
  port?: number;
  socket: SocketHandlers;
}): ListenResult {
  const hostname = options.hostname ?? "127.0.0.1";
  const server = Deno.listen({ hostname, port: options.port ?? 0 });
  const addr = server.addr as Deno.NetAddr;
  const { port } = addr;

  let stopped = false;

  (async () => {
    try {
      for await (const conn of server) {
        if (stopped) {
          conn.close();
          break;
        }
        createSocket(conn, options.socket);
      }
    } catch {
      // server closed
    }
  })();

  return {
    port,
    hostname,
    stop() {
      stopped = true;
      try {
        server.close();
      } catch {}
    },
  };
}

export function connect(options: {
  unix?: string;
  hostname?: string;
  port?: number;
  socket: SocketHandlers;
}): Promise<DenoSocket> {
  return (async () => {
    let conn: Deno.Conn;
    if (options.unix) {
      conn = await Deno.connect({ transport: "unix", path: options.unix });
    } else {
      conn = await Deno.connect({
        transport: "tcp",
        hostname: options.hostname ?? "127.0.0.1",
        port: options.port!,
      });
    }
    return createSocket(conn, options.socket);
  })();
}

export type { DenoSocket, SocketHandlers };
