declare global {
  interface BunGlobal {
    env: Record<string, string>;
    argv: string[];
    sleep(ms: number): Promise<void>;
    nanoseconds(): bigint;
    which(name: string): string | null;
    file(path: string | URL): any;
    write(path: string | URL, data: any): Promise<void>;
    spawn(
      cmd: string[] | Record<string, unknown>,
      opts?: Record<string, unknown>,
    ): any;
    spawnSync(cmd: string[], opts?: Record<string, unknown>): any;
    serve(opts: Record<string, unknown>): any;
    stdin: any;
    $(strings: TemplateStringsArray | string, ...values: unknown[]): any;
    Glob: any;
    TOML: { parse(text: string): any; stringify(obj: any): string };
    YAML: { parse(text: string): any; stringify(obj: any, opts?: any): string };
    JSONC: { parse(text: string): any };
    JSON5: {
      parse(text: string): any;
      stringify(obj: any, replacer?: any, space?: any): string;
    };
    JSONL: {
      parse(input: Uint8Array | string): any[];
      parseChunk(input: Uint8Array | string, start?: number, end?: number): any;
    };
    hash: { xxHash64(input: Uint8Array | string): bigint };
    stringWidth(str: string, opts?: { countAnsiEscapeCodes?: boolean }): number;
    wrapAnsi(
      str: string,
      width: number,
      opts?: { wordWrap?: boolean; hard?: boolean; trim?: boolean },
    ): string;
    password: {
      hash(password: string, algorithm?: string): Promise<string>;
      verify(password: string, hash: string): Promise<boolean>;
    };
    fileURLToPath(url: string | URL): string;
    pathToFileURL(filepath: string): URL;
  }

  var Bun: BunGlobal;
}

export {};
