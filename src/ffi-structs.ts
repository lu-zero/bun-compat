import { ptr, toArrayBuffer } from "./ffi.ts";
import type { Pointer } from "./ffi.ts";

type StructFieldType =
  | "u8"
  | "bool_u8"
  | "bool_u32"
  | "u16"
  | "i16"
  | "u32"
  | "i32"
  | "u64"
  | "i64"
  | "f32"
  | "f64"
  | "pointer"
  | "char*"
  | "cstring"
  | [string]
  | EnumDef;

interface StructFieldOptions {
  default?: unknown;
  lengthOf?: string;
  optional?: boolean;
  packTransform?: (val: unknown) => unknown;
  unpackTransform?: (val: unknown) => unknown;
}

type StructFieldDefinition = [string, StructFieldType] | [
  string,
  StructFieldType,
  StructFieldOptions,
];

interface StructOptions {
  mapValue?: (val: unknown) => unknown;
}

interface EnumDef {
  __type: "enum";
  type: string;
  to: (val: string | number) => number;
  from: (val: number) => string;
  enum: Record<string, number>;
}

const typeSizes: Record<string, number> = {
  u8: 1,
  bool_u8: 1,
  bool_u32: 4,
  u16: 2,
  i16: 2,
  u32: 4,
  i32: 4,
  u64: 8,
  i64: 8,
  f32: 4,
  f64: 8,
  pointer: 8,
  "char*": 8,
  cstring: 8,
};

const PTR_SIZE = 8;

function getFieldSize(t: StructFieldType): number {
  if (Array.isArray(t)) return PTR_SIZE + 4;
  if (typeof t === "object" && "__type" in t) return typeSizes[t.type] ?? 4;
  return typeSizes[t as string] ?? 8;
}

function getFieldAlign(t: StructFieldType): number {
  if (Array.isArray(t)) return PTR_SIZE;
  if (typeof t === "object" && "__type" in t) return typeSizes[t.type] ?? 4;
  return typeSizes[t as string] ?? 8;
}

function alignTo(off: number, a: number): number {
  return (off + a - 1) & ~(a - 1);
}

function writePrim(dv: DataView, off: number, t: string, v: unknown) {
  switch (t) {
    case "u8":
      dv.setUint8(off, v as number);
      break;
    case "bool_u8":
      dv.setUint8(off, v ? 1 : 0);
      break;
    case "u16":
      dv.setUint16(off, v as number, true);
      break;
    case "i16":
      dv.setInt16(off, v as number, true);
      break;
    case "bool_u32":
      dv.setUint32(off, v ? 1 : 0, true);
      break;
    case "u32":
      dv.setUint32(off, v as number, true);
      break;
    case "i32":
      dv.setInt32(off, v as number, true);
      break;
    case "f32":
      dv.setFloat32(off, v as number, true);
      break;
    case "f64":
      dv.setFloat64(off, v as number, true);
      break;
    case "u64":
    case "i64":
      dv.setBigUint64(
        off,
        typeof v === "bigint" ? v : BigInt(v as number),
        true,
      );
      break;
    case "pointer":
      dv.setBigUint64(
        off,
        typeof v === "bigint" ? v : BigInt(v as number),
        true,
      );
      break;
  }
}

function readPrim(dv: DataView, off: number, t: string): unknown {
  switch (t) {
    case "u8":
      return dv.getUint8(off);
    case "bool_u8":
      return dv.getUint8(off) !== 0;
    case "u16":
      return dv.getUint16(off, true);
    case "i16":
      return dv.getInt16(off, true);
    case "bool_u32":
      return dv.getUint32(off, true) !== 0;
    case "u32":
      return dv.getUint32(off, true);
    case "i32":
      return dv.getInt32(off, true);
    case "f32":
      return dv.getFloat32(off, true);
    case "f64":
      return dv.getFloat64(off, true);
    case "u64":
      return Number(dv.getBigUint64(off, true));
    case "i64":
      return Number(dv.getBigInt64(off, true));
    case "pointer":
      return Number(dv.getBigUint64(off, true));
    default:
      return 0;
  }
}

interface FieldLayout {
  offset: number;
  type: StructFieldType;
  opts: StructFieldOptions;
}

export interface StructDef {
  __type: "struct";
  size: number;
  align: number;
  layoutByName: Record<string, FieldLayout>;
  arrayFields: string[];
  pack(obj: Record<string, unknown>): ArrayBuffer;
  packInto(obj: Record<string, unknown>, buf: ArrayBuffer, base?: number): void;
  unpack(buf: ArrayBuffer, base?: number): Record<string, unknown>;
  packList(objs: Record<string, unknown>[]): ArrayBuffer;
  unpackList(buf: ArrayBuffer, count: number): Record<string, unknown>[];
}

export function defineStruct(
  fields: StructFieldDefinition[],
  options?: StructOptions & { reduceValue?: (val: unknown) => unknown },
): StructDef {
  const layout: Record<string, FieldLayout> = {};
  const arrayFields: string[] = [];
  let off = 0;
  let structAlign = 1;

  for (const def of fields) {
    const [name, type, opts] = def;
    const a = getFieldAlign(type);
    structAlign = Math.max(structAlign, a);
    off = alignTo(off, a);
    layout[name] = { offset: off, type, opts: opts ?? {} };
    off += getFieldSize(type);
    if (Array.isArray(type)) arrayFields.push(name);
  }

  const totalSize = alignTo(off, structAlign);

  const lengthOfReverse: Record<string, string> = {};
  for (const [name, { opts }] of Object.entries(layout)) {
    if (opts.lengthOf) {
      lengthOfReverse[opts.lengthOf] = name;
    }
  }

  function writeField(dv: DataView, field: string, val: unknown) {
    const { offset, type, opts } = layout[field];

    if (val === undefined || val === null) {
      if (opts.default !== undefined) val = opts.default;
      else if (opts.optional) {
        if (type === "pointer" || type === "char*" || type === "cstring") {
          dv.setBigUint64(offset, 0n, true);
        }
        return;
      }
    }

    if (opts.packTransform) val = opts.packTransform(val);

    if (Array.isArray(type)) {
      let count = 0;
      if (Array.isArray(val)) {
        const elemType = type[0];
        const elemSize = typeSizes[elemType] ?? 4;
        const buf = new ArrayBuffer(val.length * elemSize);
        const inner = new DataView(buf);
        for (let i = 0; i < val.length; i++) {
          writePrim(inner, i * elemSize, elemType, val[i]);
        }
        count = val.length;
        dv.setBigUint64(offset, BigInt(ptr(buf)), true);
      } else if (val instanceof ArrayBuffer || ArrayBuffer.isView(val)) {
        const elemType = type[0];
        const elemSize = typeSizes[elemType] ?? 4;
        count = Math.floor(
          (val instanceof ArrayBuffer ? val.byteLength : val.byteLength) /
            elemSize,
        );
        dv.setBigUint64(offset, BigInt(ptr(val as ArrayBuffer)), true);
      } else {
        dv.setBigUint64(offset, 0n, true);
      }
      if (lengthOfReverse[field]) {
        const lenLayout = layout[lengthOfReverse[field]];
        writePrim(dv, lenLayout.offset, lenLayout.type as string, count);
      }
      return;
    }

    if (typeof type === "object" && "__type" in type) {
      const numVal = typeof val === "string" ? type.to(val) : val;
      writePrim(dv, offset, type.type, numVal);
      return;
    }

    if (type === "char*" || type === "cstring") {
      let byteLen = 0;
      if (typeof val === "string") {
        const encoded = new TextEncoder().encode(val);
        byteLen = encoded.byteLength;
        dv.setBigUint64(offset, BigInt(ptr(encoded.buffer)), true);
      } else if (val instanceof ArrayBuffer || ArrayBuffer.isView(val)) {
        byteLen = (val instanceof ArrayBuffer ? val : val.buffer).byteLength;
        dv.setBigUint64(offset, BigInt(ptr(val as ArrayBuffer)), true);
      } else {
        dv.setBigUint64(offset, 0n, true);
      }
      if (lengthOfReverse[field]) {
        const lenLayout = layout[lengthOfReverse[field]];
        writePrim(dv, lenLayout.offset, lenLayout.type as string, byteLen);
      }
      return;
    }

    if (type === "pointer") {
      if (typeof val === "number") dv.setBigUint64(offset, BigInt(val), true);
      else if (typeof val === "bigint") dv.setBigUint64(offset, val, true);
      else if (val instanceof ArrayBuffer || ArrayBuffer.isView(val)) {
        dv.setBigUint64(offset, BigInt(ptr(val as ArrayBuffer)), true);
      }
      return;
    }

    writePrim(dv, offset, type as string, val);
  }

  function readField(dv: DataView, field: string): unknown {
    const { offset, type, opts } = layout[field];
    let val: unknown;

    if (typeof type === "object" && "__type" in type) {
      val = type.from(readPrim(dv, offset, type.type) as number);
    } else if (type === "char*" || type === "cstring") {
      const ptrAddr = Number(dv.getBigUint64(offset, true));
      if (ptrAddr === 0) {
        val = "";
      } else {
        const lenField = Object.entries(layout).find(([, f]) =>
          f.opts.lengthOf === field
        );
        if (lenField) {
          const len = readPrim(dv, layout[lenField[0]].offset, "u64") as number;
          val = len > 0
            ? new TextDecoder().decode(
              toArrayBuffer(ptrAddr as Pointer, 0, len),
            )
            : "";
        } else {
          val = new Deno.UnsafePointerView(
            BigInt(ptrAddr) as unknown as Deno.PointerObject,
          ).getCString();
        }
      }
    } else if (type === "pointer") {
      val = Number(dv.getBigUint64(offset, true));
    } else {
      val = readPrim(dv, offset, type as string);
    }

    if (opts.unpackTransform) val = opts.unpackTransform(val);
    return val;
  }

  return {
    __type: "struct",
    size: totalSize,
    align: structAlign,
    layoutByName: layout,
    arrayFields,
    pack(obj: Record<string, unknown>): ArrayBuffer {
      let mapped = obj;
      if (options?.mapValue) {
        mapped = options.mapValue(obj) as Record<string, unknown>;
      }
      const buf = new ArrayBuffer(totalSize);
      const dv = new DataView(buf);
      for (const field of Object.keys(layout)) {
        if (field in mapped || layout[field].opts.default !== undefined) {
          writeField(dv, field, mapped[field]);
        }
      }
      return buf;
    },
    packInto(obj: Record<string, unknown>, buf: ArrayBuffer, base = 0) {
      let mapped = obj;
      if (options?.mapValue) {
        mapped = options.mapValue(obj) as Record<string, unknown>;
      }
      const dv = new DataView(buf, base, totalSize);
      for (const field of Object.keys(layout)) {
        if (field in mapped || layout[field].opts.default !== undefined) {
          writeField(dv, field, mapped[field]);
        }
      }
    },
    unpack(buf: ArrayBuffer, base = 0): Record<string, unknown> {
      const dv = new DataView(buf, base, totalSize);
      const result: Record<string, unknown> = {};
      for (const field of Object.keys(layout)) {
        result[field] = readField(dv, field);
      }
      if (options?.reduceValue) {
        return options.reduceValue(result) as Record<string, unknown>;
      }
      return result;
    },
    packList(objs: Record<string, unknown>[]): ArrayBuffer {
      const buf = new ArrayBuffer(totalSize * objs.length);
      for (let i = 0; i < objs.length; i++) {
        const dv = new DataView(buf, i * totalSize, totalSize);
        let mapped = objs[i];
        if (options?.mapValue) {
          mapped = options.mapValue(objs[i]) as Record<string, unknown>;
        }
        for (const field of Object.keys(layout)) {
          if (field in mapped || layout[field].opts.default !== undefined) {
            writeField(dv, field, mapped[field]);
          }
        }
      }
      return buf;
    },
    unpackList(buf: ArrayBuffer, count: number): Record<string, unknown>[] {
      const results: Record<string, unknown>[] = [];
      for (let i = 0; i < count; i++) {
        const dv = new DataView(buf, i * totalSize, totalSize);
        const obj: Record<string, unknown> = {};
        for (const field of Object.keys(layout)) {
          obj[field] = readField(dv, field);
        }
        results.push(
          options?.reduceValue
            ? options.reduceValue(obj) as Record<string, unknown>
            : obj,
        );
      }
      return results;
    },
  };
}

export function defineEnum(
  mapping: Record<string, number>,
  base = "u32",
): EnumDef {
  const reverse = Object.fromEntries(
    Object.entries(mapping).map(([k, v]) => [v, k]),
  );
  return {
    __type: "enum",
    type: base,
    to(val: string | number): number {
      return typeof val === "number" ? val : (mapping[val] ?? 0);
    },
    from(val: number): string {
      return reverse[val] ?? String(val);
    },
    enum: mapping,
  };
}
