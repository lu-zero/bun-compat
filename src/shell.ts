export interface ShellResult {
  readonly stdout: Uint8Array;
  readonly stderr: Uint8Array;
  readonly exitCode: number;
  readonly success: boolean;
  text(): string;
  json(): any;
  lines(): string[];
}

class ShellResultImpl implements ShellResult {
  constructor(
    public readonly stdout: Uint8Array,
    public readonly stderr: Uint8Array,
    public readonly exitCode: number,
    public readonly success: boolean,
  ) {}

  text(): string {
    return new TextDecoder().decode(this.stdout);
  }

  json(): any {
    return JSON.parse(this.text());
  }

  lines(): string[] {
    return this.text().split("\n");
  }
}

interface ShellConfig {
  cwd?: string;
  env?: Record<string, string>;
  quiet: boolean;
  nothrow: boolean;
  input?: string | Uint8Array;
}

async function runShell(
  commandStr: string,
  config: ShellConfig,
): Promise<ShellResult> {
  const isWin = Deno.build.os === "windows";
  const shell = isWin ? "cmd.exe" : "/bin/sh";
  const shellArgs = isWin ? ["/c", commandStr] : ["-c", commandStr];

  const cmdOpts: Deno.CommandOptions = {
    args: shellArgs,
    cwd: config.cwd,
    env: config.env,
    stdout: config.quiet ? "null" : "piped",
    stderr: config.quiet ? "null" : "piped",
    stdin: config.input !== undefined ? "piped" : "inherit",
  };

  const command = new Deno.Command(shell, cmdOpts);

  if (config.input !== undefined) {
    const child = command.spawn();
    if (child.stdin) {
      const data = typeof config.input === "string"
        ? new TextEncoder().encode(config.input)
        : config.input;
      const writer = child.stdin.getWriter();
      await writer.write(data);
      writer.releaseLock();
      child.stdin.close();
    }
    const status = await child.status;
    const stdout = new Uint8Array(0);
    const stderr = new Uint8Array(0);
    const result = new ShellResultImpl(
      stdout,
      stderr,
      status.code,
      status.code === 0,
    );
    if (!config.nothrow && status.code !== 0) {
      throw new Error(
        `Shell command failed (exit code ${status.code}): ${commandStr}`,
      );
    }
    return result;
  }

  const output = await command.output();
  const stdout = config.quiet ? new Uint8Array(0) : output.stdout;
  const stderr = config.quiet ? new Uint8Array(0) : output.stderr;
  const result = new ShellResultImpl(
    stdout,
    stderr,
    output.code,
    output.success,
  );

  if (!config.nothrow && output.code !== 0) {
    const errText = new TextDecoder().decode(output.stderr);
    throw new Error(
      `Shell command failed (exit code ${output.code}): ${commandStr}\n${errText}`,
    );
  }

  return result;
}

class ShellPromise {
  #commandStr: string;
  #config: ShellConfig;
  #promise: Promise<ShellResult> | null = null;

  constructor(commandStr: string, config: ShellConfig) {
    this.#commandStr = commandStr;
    this.#config = config;
  }

  #run(): Promise<ShellResult> {
    if (!this.#promise) {
      this.#promise = runShell(this.#commandStr, this.#config);
    }
    return this.#promise;
  }

  quiet(): ShellPromise {
    return new ShellPromise(this.#commandStr, { ...this.#config, quiet: true });
  }

  nothrow(): ShellPromise {
    return new ShellPromise(this.#commandStr, {
      ...this.#config,
      nothrow: true,
    });
  }

  cwd(dir: string): ShellPromise {
    return new ShellPromise(this.#commandStr, { ...this.#config, cwd: dir });
  }

  env(env: Record<string, string>): ShellPromise {
    return new ShellPromise(this.#commandStr, { ...this.#config, env });
  }

  input(data: string | Uint8Array): ShellPromise {
    return new ShellPromise(this.#commandStr, { ...this.#config, input: data });
  }

  then<TResult1, TResult2>(
    onfulfilled?:
      | ((value: ShellResult) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return this.#run().then(onfulfilled, onrejected);
  }

  catch<TResult>(
    onrejected?: ((reason: unknown) => TResult | PromiseLike<TResult>) | null,
  ): Promise<ShellResult | TResult> {
    return this.#run().catch(onrejected);
  }

  get [Symbol.toStringTag](): string {
    return "ShellPromise";
  }
}

export function $(
  strings: TemplateStringsArray,
  ...values: unknown[]
): ShellPromise;
export function $(strings: string): ShellPromise;
export function $(
  strings: TemplateStringsArray | string,
  ...values: unknown[]
): ShellPromise {
  let commandStr: string;

  if (typeof strings === "string") {
    commandStr = strings;
  } else if (Array.isArray(strings) && "raw" in strings) {
    commandStr = strings.reduce((acc, str, i) => {
      const val = values[i] !== undefined ? String(values[i]) : "";
      return acc + str + val;
    }, "");
  } else {
    commandStr = String(strings);
  }

  return new ShellPromise(commandStr, { quiet: false, nothrow: false });
}
