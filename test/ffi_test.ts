import { assertEquals } from "@std/assert";
import {
  dlopen,
  FFIType,
  JSCallback,
  ptr,
  suffix,
  toArrayBuffer,
} from "../src/ffi.ts";

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
  await t.step("ptr", () => assertEquals(FFIType.ptr, "ptr"));
  await t.step("void", () => assertEquals(FFIType.void, "void"));
  await t.step("u8", () => assertEquals(FFIType.u8, "u8"));
  await t.step("i32", () => assertEquals(FFIType.i32, "i32"));
  await t.step("u64", () => assertEquals(FFIType.u64, "u64"));
  await t.step("f64", () => assertEquals(FFIType.f64, "f64"));
});

// --- Type-aware conversion tests ---

Deno.test("ffi - dlopen usize return preserved as bigint", () => {
  const lib = dlopen(LIBC, {
    strlen: { args: ["ptr"], returns: "usize" },
  });
  const str = new TextEncoder().encode("hello\0");
  const p = ptr(str);
  const len = lib.symbols.strlen(p);
  assertEquals(typeof len, "bigint");
  assertEquals(len, 5n);
  lib.close();
});

Deno.test("ffi - dlopen pointer arg from number", () => {
  const lib = dlopen(LIBC, {
    strlen: { args: ["ptr"], returns: "usize" },
  });
  const str = new TextEncoder().encode("hello\0");
  const p = ptr(str);
  assertEquals(typeof p, "number");
  const len = lib.symbols.strlen(p);
  assertEquals(len, 5n);
  lib.close();
});

Deno.test("ffi - dlopen pointer arg from TypedArray", () => {
  const lib = dlopen(LIBC, {
    strlen: { args: ["ptr"], returns: "usize" },
  });
  const str = new TextEncoder().encode("hello\0");
  const len = lib.symbols.strlen(str);
  assertEquals(len, 5n);
  lib.close();
});

Deno.test("ffi - dlopen pointer return converted to number", () => {
  const lib = dlopen(LIBC, {
    getenv: { args: ["ptr"], returns: "ptr" },
  });
  const name = new TextEncoder().encode("HOME\0");
  const result = lib.symbols.getenv(name);
  assertEquals(result === null || typeof result === "number", true);
  lib.close();
});

// The qsort test exercises the critical JSCallback pointer arg conversion:
// native code calls back with two PointerObject args → our layer converts to numbers
Deno.test("ffi - JSCallback ptr args arrive as numbers (qsort)", () => {
  const lib = dlopen(LIBC, {
    qsort: { args: ["ptr", "usize", "usize", "ptr"], returns: "void" },
  });

  const arr = new Uint8Array([3, 1, 2]);
  const cmpCb = new JSCallback((a: unknown, b: unknown) => {
    assertEquals(typeof a, "number", "ptr arg should be number");
    assertEquals(typeof b, "number", "ptr arg should be number");
    const va = new Uint8Array(toArrayBuffer(a as number, 0, 1))[0];
    const vb = new Uint8Array(toArrayBuffer(b as number, 0, 1))[0];
    return (va - vb) as unknown;
  }, { args: ["ptr", "ptr"], returns: "i32" });

  lib.symbols.qsort(arr, 3, 1, cmpCb.ptr);
  assertEquals(arr[0], 1);
  assertEquals(arr[1], 2);
  assertEquals(arr[2], 3);

  cmpCb.close();
  lib.close();
});

// Test that writing to stdout via write() works — exercises usize arg conversion
Deno.test("ffi - dlopen usize arg converted from number", () => {
  const lib = dlopen(LIBC, {
    write: { args: ["i32", "ptr", "usize"], returns: "isize" },
  });
  const msg = new TextEncoder().encode("x\0");
  // Pass 1 as a number for the usize param — should be auto-converted to BigInt
  const result = lib.symbols.write(1, msg, 1 as unknown as bigint);
  assertEquals(typeof result, "bigint");
  lib.close();
});
