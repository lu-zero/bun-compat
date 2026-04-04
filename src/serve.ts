export interface ServeOptions {
  port?: number;
  hostname?: string;
  fetch: (req: Request, server: BunServer) => Response | Promise<Response>;
  websocket?: any;
  reusePort?: boolean;
  key?: string;
  cert?: string;
  ca?: string;
  passphrase?: string;
  development?: boolean;
  idleTimeout?: number;
  maxRequestBodySize?: number;
}

export interface BunServer {
  requestIP?: (
    req: Request,
  ) => { address: string; family: string; port: number } | null;
  upgrade<P = unknown>(
    req: Request,
    opts?: { headers?: Headers; data?: P },
  ): boolean;
  stop(closeActiveConnections?: boolean): void;
  port: number;
  hostname: string;
  url: URL;
  pendingWebsockets: Set<any>;
  publish(
    topic: string,
    data: string | ArrayBufferLike | Blob | ArrayBufferView,
    compress?: boolean,
  ): number;
}

class BunServerImpl implements BunServer {
  #httpServer: Deno.HttpServer;
  #wsUpgradeHandler?: (req: Request, opts?: { headers?: Headers }) => boolean;

  constructor(
    httpServer: Deno.HttpServer,
    wsUpgradeHandler?: (req: Request, opts?: { headers?: Headers }) => boolean,
  ) {
    this.#httpServer = httpServer;
    this.#wsUpgradeHandler = wsUpgradeHandler;
  }

  requestIP(
    _req: Request,
  ): { address: string; family: string; port: number } | null {
    return null;
  }

  upgrade(
    _req: Request,
    _opts?: { headers?: Headers; data?: unknown },
  ): boolean {
    if (this.#wsUpgradeHandler) {
      return this.#wsUpgradeHandler(_req, _opts);
    }
    return false;
  }

  stop(closeActiveConnections?: boolean): void {
    this.#httpServer.shutdown();
    if (closeActiveConnections) {
      void this.#httpServer.finished;
    }
  }

  get port(): number {
    const addr = this.#httpServer.addr;
    if (addr && typeof addr === "object" && "port" in addr) {
      return (addr as Deno.NetAddr).port;
    }
    return 0;
  }

  get hostname(): string {
    const addr = this.#httpServer.addr;
    if (addr && typeof addr === "object" && "hostname" in addr) {
      return (addr as Deno.NetAddr).hostname;
    }
    return "0.0.0.0";
  }

  get url(): URL {
    return new URL(`http://${this.hostname}:${this.port}/`);
  }

  get pendingWebsockets(): Set<any> {
    return new Set();
  }

  publish(
    _topic: string,
    _data: string | ArrayBufferLike | Blob | ArrayBufferView,
    _compress?: boolean,
  ): number {
    return 0;
  }
}

export function serve(opts: ServeOptions): BunServer {
  const handler = async (req: Request): Promise<Response> => {
    const bunServer = new BunServerImpl(dummyServer);
    try {
      return await opts.fetch(req, bunServer);
    } catch (err) {
      return new Response(`Internal Server Error: ${err}`, { status: 500 });
    }
  };

  const ac = new AbortController();

  const httpServer = Deno.serve({
    port: opts.port ?? 0,
    hostname: opts.hostname ?? "0.0.0.0",
    handler,
    signal: ac.signal,
    onListen: () => {},
  });

  const dummyServer = httpServer;

  return new BunServerImpl(httpServer);
}
