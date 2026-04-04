export { argv, env } from "./env.ts";
export { $ } from "./shell.ts";
export { Glob } from "./glob.ts";
export { spawn, spawnSync } from "./spawn.ts";
export type { Subprocess } from "./spawn.ts";
export { BunFile, file } from "./file.ts";
export { write } from "./write.ts";
export { sleep } from "./sleep.ts";
export { serve } from "./serve.ts";
export { stdin } from "./stdin.ts";
export { hash } from "./hash.ts";
export { stringWidth, wrapAnsi } from "./string-width.ts";
export { password } from "./password.ts";
export { TOML } from "./parsers/toml.ts";
export { YAML } from "./parsers/yaml.ts";
export { JSONC } from "./parsers/jsonc.ts";
export { JSON5 } from "./parsers/json5.ts";
export { JSONL } from "./parsers/jsonl.ts";
export { fileURLToPath, pathToFileURL } from "./url.ts";
export { which } from "./which.ts";
export { Database } from "./sqlite.ts";

export type SystemError = {
  code?: string;
  syscall?: string;
  path?: string;
  errno?: number;
  message: string;
  name: string;
} & Error;
import type * as Semver from "@std/semver";

export const semver: {
  satisfies: Promise<typeof Semver.satisfies>;
  order: Promise<typeof Semver.compare>;
} = {
  satisfies: (async () => {
    const m = await import("@std/semver");
    return m.satisfies;
  })(),
  order: (async () => {
    const m = await import("@std/semver");
    return m.compare;
  })(),
};
