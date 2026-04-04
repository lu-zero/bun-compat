export type Runtime = "bun" | "deno" | "unknown";

export function detect(): Runtime {
  if (typeof (globalThis as Record<string, unknown>).Bun !== "undefined") {
    return "bun";
  }
  if (typeof (globalThis as Record<string, unknown>).Deno !== "undefined") {
    return "deno";
  }
  return "unknown";
}

export const runtime: Runtime = detect();

export const isBun = runtime === "bun";
export const isDeno = runtime === "deno";
