export interface SpawnOptions {
  cmd: string[];
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
  stdout?: "pipe" | "inherit" | "ignore" | "null" | File;
  stderr?: "pipe" | "inherit" | "ignore" | "null" | File;
  stdin?:
    | "pipe"
    | "inherit"
    | "ignore"
    | "null"
    | Uint8Array
    | Blob
    | ReadableStream
    | File;
  onExit?: (proc: Subprocess) => void;
}

export interface SpawnSyncResult {
  stdout: Uint8Array;
  stderr: Uint8Array;
  exitCode: number;
  success: boolean;
}

type StdioMode = "piped" | "inherit" | "null";

function mapStdio(
  v: string | File | Uint8Array | Blob | ReadableStream | undefined,
): StdioMode {
  if (v === undefined) return "inherit";
  if (v === "inherit") return "inherit";
  if (v === "pipe") return "piped";
  if (v === "ignore" || v === "null") return "null";
  return "piped";
}

export class Subprocess<
  In = "pipe" | "inherit" | "ignore",
  Out = "pipe" | "inherit" | "ignore",
  Err = "pipe" | "inherit" | "ignore",
> {
  #child: Deno.ChildProcess;
  #exitCode: number | null = null;
  #exitPromise: Promise<number>;

  constructor(child: Deno.ChildProcess) {
    this.#child = child;
    this.#exitPromise = this.#child.status.then(async (s) => {
      this.#exitCode = s.code;
      try {
        child.stdin?.close();
      } catch {}
      try {
        if (child.stderr) await child.stderr.cancel();
      } catch {}
      return s.code;
    });
  }

  get pid(): number {
    return this.#child.pid;
  }

  get stdin(): WritableStream<Uint8Array> {
    return this.#child.stdin!;
  }

  get stdout(): ReadableStream<Uint8Array> {
    return this.#child.stdout!;
  }

  get stderr(): ReadableStream<Uint8Array> {
    return this.#child.stderr!;
  }

  get exited(): Promise<number> {
    return this.#exitPromise;
  }

  get exitCode(): number | null {
    return this.#exitCode;
  }

  kill(signal?: string): void {
    if (signal === "SIGKILL") {
      this.#child.kill("SIGKILL");
    } else {
      this.#child.kill((signal as Deno.Signal) || "SIGTERM");
    }
  }

  [Symbol.dispose](): void {
    try {
      this.#child.kill("SIGTERM");
    } catch {
      // already exited
    }
  }
}

export function spawn(opts: SpawnOptions): Subprocess;
export function spawn(cmd: string[], opts?: Partial<SpawnOptions>): Subprocess;
export function spawn(
  cmdOrOpts: string[] | SpawnOptions,
  opts?: Partial<SpawnOptions>,
): Subprocess {
  let cmd: string[];
  let spawnOpts: Partial<SpawnOptions> = {};

  if (Array.isArray(cmdOrOpts)) {
    cmd = cmdOrOpts;
    spawnOpts = opts ?? {};
  } else {
    spawnOpts = cmdOrOpts;
    cmd = (cmdOrOpts as SpawnOptions).cmd ?? [];
  }

  const denoOpts: Deno.CommandOptions = {
    args: cmd.slice(1),
    cwd: spawnOpts.cwd,
    stdout: mapStdio(spawnOpts.stdout as string) as
      | "piped"
      | "inherit"
      | "null",
    stderr: mapStdio(spawnOpts.stderr as string) as
      | "piped"
      | "inherit"
      | "null",
    stdin: mapStdio(spawnOpts.stdin as string) as "piped" | "inherit" | "null",
  };

  if (spawnOpts.env) {
    denoOpts.env = spawnOpts.env;
  }

  const command = new Deno.Command(cmd[0], denoOpts);
  const child = command.spawn();

  return new Subprocess(child);
}

export function spawnSync(
  cmd: string[],
  opts?: Partial<SpawnOptions>,
): SpawnSyncResult {
  const denoOpts: Deno.CommandOptions = {
    args: cmd.slice(1),
    cwd: opts?.cwd,
    stdout:
      (mapStdio(opts?.stdout as string) as "piped" | "inherit" | "null") ===
          "inherit"
        ? "piped"
        : mapStdio(opts?.stdout as string) as "piped" | "inherit" | "null",
    stderr:
      (mapStdio(opts?.stderr as string) as "piped" | "inherit" | "null") ===
          "inherit"
        ? "piped"
        : mapStdio(opts?.stderr as string) as "piped" | "inherit" | "null",
  };

  if (opts?.env) {
    denoOpts.env = opts.env;
  }

  const command = new Deno.Command(cmd[0], denoOpts);
  const output = command.outputSync();

  return {
    stdout: output.stdout,
    stderr: output.stderr,
    exitCode: output.code,
    success: output.success,
  };
}
