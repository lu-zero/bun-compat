/**
 * Re-exports every Bun API that this package polyfills.
 *
 * Import from `"bun"` (mapped via Deno's import map) to get the full set:
 * `env`, `argv`, `file`, `spawn`, `$`, `Glob`, `dlopen`, `Database`, etc.
 *
 * @module
 */
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
export { nanoseconds } from "./time.ts";
export { Database } from "./sqlite.ts";
export { CryptoHasher } from "./crypto-hasher.ts";
/**
 * Strip ANSI escape codes from a string.
 *
 * Removes SGR (Select Graphic Rendition) sequences, OSC sequences,
 * and other common ANSI control sequences. This is a regex-based
 * implementation and may not cover every edge case.
 */
export { stripANSI } from "./strip-ansi.ts";

/**
 * Inspect a value for debugging, similar to `util.inspect` in Node.js.
 *
 * Delegates to `Deno.inspect()` with depth and color options.
 * Does not support all Bun.inspect options (e.g. `sorted`, `compact`).
 */
export function inspect(
  value: unknown,
  options?: { depth?: number; colors?: boolean },
): string {
  return Deno.inspect(value, {
    depth: options?.depth ?? 4,
    colors: options?.colors ?? false,
  });
}

/**
 * Force garbage collection.
 *
 * **Stub**: This is a no-op under Deno. Bun's `gc(true)` forces a
 * major GC cycle, but Deno does not expose a programmatic GC API.
 * Calling this function will not error, but will not trigger GC.
 */
export function gc(_major?: boolean): void {}

/**
 * Generate a V8 heap snapshot for Chrome DevTools.
 *
 * **Stub**: Not supported under Deno. Returns an object with an
 * `error` field instead of a `HeapSnapshot`. Code that depends on
 * real heap snapshot data will not work. This stub exists only to
 * prevent runtime crashes when the debug profiler is invoked.
 */
export function generateHeapSnapshot(): object {
  return { error: "not supported under Deno compat" };
}
export {
  dlopen,
  FFIType,
  JSCallback,
  ptr,
  suffix,
  toArrayBuffer,
} from "./ffi.ts";
export type { Pointer } from "./ffi.ts";
export { defineEnum, defineStruct } from "./ffi-structs.ts";

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
