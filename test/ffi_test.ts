import { assertEquals } from "@std/assert";
import { dlopen, JSCallback, ptr, suffix, toArrayBuffer } from "../src/ffi.ts";

const LIBC = Deno.build.os === "darwin"
  ? "libSystem.B.dylib"
  : Deno.build.os === "windows"
  ? "ucrtbase.dll"
  : "libc.so.6";

Deno.test("ffi - suffix matches platform", () => {
  if (Deno.build.os === "darwin") assertEquals(suffix, "dylib");
  else if (Deno.build.os === "windows") assertEquals(suffix, "dll");
  else assertEquals(suffix, "so");
});

Deno.test("ffi - ptr returns non-zero for valid buffer", () => {
  const buf = new ArrayBuffer(16);
  const p = ptr(buf);
  assertEquals(typeof p, "number");
  assertEquals(p !== 0, true);
});

Deno.test("ffi - ptr of Uint8Array", () => {
  const arr = new Uint8Array([1, 2, 3, 4]);
  const p = ptr(arr);
  assertEquals(typeof p, "number");
  assertEquals(p !== 0, true);
});

Deno.test("ffi - dlopen strlen", () => {
  const lib = dlopen(LIBC, {
    strlen: { args: ["ptr"], returns: "usize" },
  });
  const str = new TextEncoder().encode("hello\0");
  const p = ptr(str);
  const len = lib.symbols.strlen(p) as bigint;
  assertEquals(len, 5n);
  lib.close();
});

Deno.test("ffi - dlopen getpid", () => {
  const lib = dlopen(LIBC, {
    getpid: { args: [], returns: "i32" },
  });
  const pid = lib.symbols.getpid() as number;
  assertEquals(typeof pid, "number");
  assertEquals(pid > 0, true);
  assertEquals(pid, Deno.pid);
  lib.close();
});

Deno.test("ffi - toArrayBuffer round-trip", () => {
  const original = new Uint8Array([10, 20, 30, 40, 50]);
  const p = ptr(original);
  const ab = toArrayBuffer(p, 0, 5);
  const view = new Uint8Array(ab);
  assertEquals(view[0], 10);
  assertEquals(view[1], 20);
  assertEquals(view[2], 30);
  assertEquals(view[3], 40);
  assertEquals(view[4], 50);
});

Deno.test("ffi - toArrayBuffer with offset", () => {
  const original = new Uint8Array([0, 0, 0, 0, 100, 200]);
  const p = ptr(original);
  const ab = toArrayBuffer(p, 4, 2);
  const view = new Uint8Array(ab);
  assertEquals(view[0], 100);
  assertEquals(view[1], 200);
});

Deno.test("ffi - JSCallback basic", () => {
  let called = false;
  const cb = new JSCallback(() => {
    called = true;
  }, { args: [], returns: "void" });
  assertEquals(typeof cb.ptr, "number");
  cb.close();
});

Deno.test("ffi - JSCallback with args", () => {
  let received = 0;
  const cb = new JSCallback((a: unknown) => {
    received = a as number;
  }, { args: ["i32"], returns: "void" });
  assertEquals(typeof cb.ptr, "number");
  cb.close();
});

Deno.test("ffi - JSCallback with return value", () => {
  const cb = new JSCallback((a: unknown, b: unknown) => {
    return ((a as number) + (b as number)) as unknown;
  }, { args: ["i32", "i32"], returns: "i32" });
  assertEquals(typeof cb.ptr, "number");
  cb.close();
});

Deno.test("ffi - dlopen close", () => {
  const lib = dlopen(LIBC, {
    getpid: { args: [], returns: "i32" },
  });
  lib.close();
});

Deno.test("ffi - FFIType constants exist", async (t) => {
  const { FFIType } = await import("../src/ffi.ts");
  await t.step("ptr", () => assertEquals(FFIType.ptr, "ptr"));
  await t.step("void", () => assertEquals(FFIType.void, "void"));
  await t.step("u8", () => assertEquals(FFIType.u8, "u8"));
  await t.step("i32", () => assertEquals(FFIType.i32, "i32"));
  await t.step("u64", () => assertEquals(FFIType.u64, "u64"));
  await t.step("f64", () => assertEquals(FFIType.f64, "f64"));
});
