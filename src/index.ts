import { isBun, isDeno } from "./platform.ts";

if (!isBun && isDeno) {
  const bun = await import("./install.ts");
  (globalThis as Record<string, unknown>).Bun = bun.default;
}

export { isBun, isDeno };
export type { Runtime } from "./platform.ts";
