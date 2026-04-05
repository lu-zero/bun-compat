import { assertAlmostEquals, assertEquals } from "@std/assert";
import { defineEnum, defineStruct } from "../src/ffi-structs.ts";

Deno.test("struct - simple pack/unpack", () => {
  const S = defineStruct([
    ["x", "u32"],
    ["y", "u32"],
  ]);
  assertEquals(S.size, 8);
  const buf = S.pack({ x: 10, y: 20 });
  const obj = S.unpack(buf);
  assertEquals(obj.x, 10);
  assertEquals(obj.y, 20);
});

Deno.test("struct - bool_u8 field", () => {
  const S = defineStruct([
    ["flag", "bool_u8"],
    ["val", "u32"],
  ]);
  const buf = S.pack({ flag: true, val: 42 });
  const obj = S.unpack(buf);
  assertEquals(obj.flag, true);
  assertEquals(obj.val, 42);
});

Deno.test("struct - f32 and f64 fields", () => {
  const S = defineStruct([
    ["a", "f32"],
    ["b", "f64"],
  ]);
  const buf = S.pack({ a: 1.5, b: 3.14159 });
  const obj = S.unpack(buf);
  assertAlmostEquals(obj.a as number, 1.5, 0.001);
  assertAlmostEquals(obj.b as number, 3.14159, 0.0001);
});

Deno.test("struct - u64 field", () => {
  const S = defineStruct([
    ["big", "u64"],
  ]);
  const buf = S.pack({ big: 9007199254740991n });
  const obj = S.unpack(buf);
  assertEquals(obj.big, 9007199254740991);
});

Deno.test("struct - default values", () => {
  const S = defineStruct([
    ["a", "u32"],
    ["b", "u8", { default: 99 }],
  ]);
  const buf = S.pack({ a: 1 });
  const obj = S.unpack(buf);
  assertEquals(obj.a, 1);
  assertEquals(obj.b, 99);
});

Deno.test("struct - optional pointer", () => {
  const S = defineStruct([
    ["ptr", "pointer", { optional: true }],
    ["len", "u32"],
  ]);
  const buf = S.pack({ ptr: null, len: 0 });
  const obj = S.unpack(buf);
  assertEquals(obj.ptr, 0);
});

Deno.test("struct - packList and unpackList", () => {
  const S = defineStruct([
    ["id", "u32"],
    ["score", "f32"],
  ]);
  const buf = S.packList([
    { id: 1, score: 10.0 },
    { id: 2, score: 20.0 },
    { id: 3, score: 30.0 },
  ]);
  assertEquals(buf.byteLength, S.size * 3);
  const list = S.unpackList(buf, 3);
  assertEquals(list.length, 3);
  assertEquals(list[0].id, 1);
  assertAlmostEquals(list[0].score as number, 10.0, 0.001);
  assertEquals(list[2].id, 3);
});

Deno.test("struct - alignment padding", () => {
  const S = defineStruct([
    ["a", "u8"],
    ["b", "u64"],
  ]);
  assertEquals(S.size, 16);
  assertEquals(S.layoutByName.b.offset, 8);
  const buf = S.pack({ a: 1, b: 42 });
  const obj = S.unpack(buf);
  assertEquals(obj.a, 1);
  assertEquals(obj.b, 42);
});

Deno.test("struct - mapValue transform", () => {
  const S = defineStruct([
    ["val", "u32"],
  ], {
    mapValue: (obj: unknown) => ({ val: (obj as { v: number }).v * 2 }),
  });
  const buf = S.pack({ v: 5 } as unknown as Record<string, unknown>);
  const obj = S.unpack(buf);
  assertEquals(obj.val, 10);
});

Deno.test("struct - packTransform and unpackTransform", () => {
  const S = defineStruct([
    ["color", "pointer", {
      packTransform: (v: unknown) => (v as number) * 256,
      unpackTransform: (v: unknown) => (v as number) / 256,
    }],
  ]);
  const buf = S.pack({ color: 100 });
  const obj = S.unpack(buf);
  assertEquals(obj.color, 100);
});

Deno.test("enum - to and from", () => {
  const E = defineEnum({ foo: 0, bar: 1, baz: 2 }, "u8");
  assertEquals(E.to("foo"), 0);
  assertEquals(E.to("bar"), 1);
  assertEquals(E.to(2), 2);
  assertEquals(E.from(0), "foo");
  assertEquals(E.from(2), "baz");
});

Deno.test("struct - reduceValue in unpack", () => {
  const S = defineStruct([
    ["ptr", "pointer"],
    ["len", "u32"],
    ["reserved", "u32", { default: 0 }],
  ], {
    reduceValue: (value: unknown) => {
      const v = value as { ptr: number; len: number };
      return { ptr: v.ptr, len: v.len };
    },
  });
  const buf = S.pack({ ptr: 0x1000, len: 42 });
  const obj = S.unpack(buf);
  assertEquals(Object.keys(obj).length, 2);
  assertEquals(obj.ptr, 0x1000);
  assertEquals(obj.len, 42);
});

Deno.test("struct - reduceValue in unpackList", () => {
  const S = defineStruct([
    ["ptr", "pointer"],
    ["len", "u32"],
    ["reserved", "u32", { default: 0 }],
  ], {
    reduceValue: (value: unknown) => {
      const v = value as { ptr: number; len: number };
      return { ptr: v.ptr, len: v.len };
    },
  });
  const buf = S.packList([
    { ptr: 0x100, len: 10 },
    { ptr: 0x200, len: 20 },
  ]);
  const list = S.unpackList(buf, 2);
  assertEquals(list.length, 2);
  assertEquals(Object.keys(list[0]).length, 2);
  assertEquals(list[0].ptr, 0x100);
  assertEquals(list[0].len, 10);
  assertEquals(list[1].ptr, 0x200);
  assertEquals(list[1].len, 20);
});

Deno.test("struct - with enum field", () => {
  const Kind = defineEnum({ a: 0, b: 1, c: 2 }, "u8");
  const S = defineStruct([
    ["kind", Kind],
    ["value", "u32"],
  ]);
  const buf = S.pack({ kind: "b", value: 42 });
  const obj = S.unpack(buf);
  assertEquals(obj.kind, "b");
  assertEquals(obj.value, 42);
});

Deno.test("struct - lengthOf auto-writes byte length for char*", () => {
  const S = defineStruct([
    ["data", "char*"],
    ["data_len", "u64", { lengthOf: "data" }],
  ]);
  const buf = S.pack({ data: "hello" });
  const dv = new DataView(buf);
  const lenOffset = S.layoutByName.data_len.offset;
  assertEquals(dv.getBigUint64(lenOffset, true), 5n);
});

Deno.test("struct - lengthOf auto-writes count for array field", () => {
  const S = defineStruct([
    ["items", ["u32"]],
    ["items_count", "u32", { lengthOf: "items" }],
  ]);
  const buf = S.pack({ items: [10, 20, 30] });
  const dv = new DataView(buf);
  const countOffset = S.layoutByName.items_count.offset;
  assertEquals(dv.getUint32(countOffset, true), 3);
});

Deno.test("struct - lengthOf in packList", () => {
  const S = defineStruct([
    ["text", "char*"],
    ["text_len", "u64", { lengthOf: "text" }],
    ["link", "char*", { default: "" }],
    ["link_len", "u64", { lengthOf: "link" }],
  ]);
  const buf = S.packList([
    { text: "abc", link: "http://x" },
    { text: "hello world", link: "" },
  ]);
  const dv = new DataView(buf);
  const textLenOff = S.layoutByName.text_len.offset;
  const linkLenOff = S.layoutByName.link_len.offset;
  assertEquals(dv.getBigUint64(textLenOff, true), 3n);
  assertEquals(dv.getBigUint64(linkLenOff, true), 8n);
  assertEquals(dv.getBigUint64(textLenOff + S.size, true), 11n);
  assertEquals(dv.getBigUint64(linkLenOff + S.size, true), 0n);
});
