/**
 * `@lu-zero/bun-compat` — Bun API compatibility layer for Deno.
 *
 * When imported on Deno, automatically installs the `Bun` global shim.
 * Also exports `{ isBun, isDeno }` for runtime detection.
 *
 * @example
 * ```ts
 * import { isDeno } from "@lu-zero/bun-compat";
 * if (isDeno) console.log("Running on Deno with Bun compat");
 * ```
 *
 * @module
 */
import { isBun, isDeno } from "./platform.ts";

if (!isBun && isDeno) {
  const bun = await import("./install.ts");
  (globalThis as Record<string, unknown>).Bun = bun.default;
}

export { isBun, isDeno };
export type { Runtime } from "./platform.ts";
