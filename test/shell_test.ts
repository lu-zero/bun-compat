import { assertEquals } from "@std/assert";
import "./test_helper.ts";

const $ = Bun.$;

Deno.test("$ - basic command", async () => {
  const result = await $`echo hello`;
  assertEquals(result.exitCode, 0);
  assertEquals(result.text().trim(), "hello");
});

Deno.test("$ - nothrow on failure", async () => {
  const result = await $`exit 1`.nothrow();
  assertEquals(result.exitCode, 1);
});

Deno.test("$ - quiet suppresses output", async () => {
  const result = await $`echo hidden`.quiet();
  assertEquals(result.exitCode, 0);
  assertEquals(result.stdout.length, 0);
});

Deno.test("$ - cwd option", async () => {
  const result = await $`pwd`.cwd("/");
  assertEquals(result.text().trim(), "/");
});
