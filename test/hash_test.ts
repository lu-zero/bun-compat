import { assertEquals } from "@std/assert";
import "./test_helper.ts";
import { hash } from "../src/hash.ts";

Deno.test("hash - xxHash64 known empty", () => {
  const result = hash.xxHash64("");
  assertEquals(typeof result, "bigint");
  assertEquals(result, 0xef46db3751d8e999n);
});

Deno.test("hash - xxHash64 known string", () => {
  const result = hash.xxHash64("hello");
  assertEquals(typeof result, "bigint");
});

Deno.test("hash - xxHash64 with seed", () => {
  const a = hash.xxHash64("test", 0);
  const b = hash.xxHash64("test", 1);
  assertEquals(a !== b, true);
});

Deno.test("hash - wyhash returns bigint", () => {
  const result = hash.wyhash("abc");
  assertEquals(typeof result, "bigint");
  assertEquals(result > 0n, true);
});

Deno.test("hash - xxHash64 Uint8Array", () => {
  const data = new TextEncoder().encode("hello");
  assertEquals(hash.xxHash64(data), hash.xxHash64("hello"));
});
