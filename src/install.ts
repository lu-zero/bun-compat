/**
 * Full Bun global shim — aggregates every polyfilled module into a single
 * object suitable for assignment to `globalThis.Bun`.
 *
 * @module
 */
import { argv, env } from "./env.ts";
import { sleep } from "./sleep.ts";
import { nanoseconds } from "./time.ts";
import { which } from "./which.ts";
import { file } from "./file.ts";
import { write } from "./write.ts";
import { spawn, spawnSync } from "./spawn.ts";
import { serve } from "./serve.ts";
import { stdin } from "./stdin.ts";
import { $ } from "./shell.ts";
import { Glob } from "./glob.ts";
import { TOML } from "./parsers/toml.ts";
import { YAML } from "./parsers/yaml.ts";
import { JSONC } from "./parsers/jsonc.ts";
import { JSON5 } from "./parsers/json5.ts";
import { JSONL } from "./parsers/jsonl.ts";
import { hash } from "./hash.ts";
import { stringWidth, wrapAnsi } from "./string-width.ts";
import { password } from "./password.ts";
import { fileURLToPath } from "./url.ts";

const BunShim = {
  env,
  argv,
  sleep,
  nanoseconds,
  which,
  file,
  write,
  spawn,
  spawnSync,
  serve,
  stdin,
  $,
  Glob,
  TOML,
  YAML,
  JSONC,
  JSON5,
  JSONL,
  hash,
  stringWidth,
  wrapAnsi,
  password,
  fileURLToPath,
} as Record<string, unknown>;

export default BunShim;
