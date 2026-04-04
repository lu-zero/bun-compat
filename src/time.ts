export function nanoseconds(): bigint {
  if (typeof Deno !== "undefined" && "nanoseconds" in Deno) {
    return (Deno as any).nanoseconds() as bigint;
  }
  return BigInt(Math.floor(performance.now() * 1e6));
}
