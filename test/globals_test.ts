import { assertEquals, assertExists } from "@std/assert";
import "./test_helper.ts";

Deno.test("env - reads and writes", () => {
  const testKey = `BUN_COMPAT_TEST_${Date.now()}`;
  Bun.env[testKey] = "hello";
  assertEquals(Bun.env[testKey], "hello");
  delete Bun.env[testKey];
});

Deno.test("argv - is an array", () => {
  assertEquals(Array.isArray(Bun.argv), true);
});

Deno.test("sleep - resolves after delay", async () => {
  const start = performance.now();
  await Bun.sleep(50);
  const elapsed = performance.now() - start;
  assertEquals(elapsed >= 40, true, `sleep was too short: ${elapsed}ms`);
});

Deno.test("nanoseconds - returns bigint", () => {
  const ns = Bun.nanoseconds();
  assertEquals(typeof ns, "bigint");
  assertEquals(ns > 0n, true);
});

Deno.test("which - finds a known binary", () => {
  const result = Bun.which("ls");
  if (Deno.build.os !== "windows") {
    assertExists(result);
  }
});
