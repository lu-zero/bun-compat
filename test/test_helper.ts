import "../src/types.d.ts";
import { isBun } from "../src/platform.ts";

if (!isBun) {
  const bun = await import("../src/install.ts");
  globalThis.Bun = bun.default as unknown as typeof Bun;
}
