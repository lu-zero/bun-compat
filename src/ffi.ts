/**
 * Bun FFI compatibility layer for Deno.
 *
 * Provides `dlopen`, `ptr`, `toArrayBuffer`, `JSCallback`, and `FFIType` —
 * matching the `bun:ffi` API surface so that code written for Bun can run
 * on Deno without changes. Internally wraps `Deno.dlopen` and
 * `Deno.UnsafeCallback`, converting between Bun's number-based pointer
 * model and Deno's BigInt-based one.
 *
 * @example
 * ```ts
 * import { dlopen, ptr } from "bun:ffi";
 * const lib = dlopen("./mylib.so", { add: { args: ["i32", "i32"], returns: "i32" } });
 * console.log(lib.symbols.add(1, 2));
 * lib.close();
 * ```
 *
 * @module
 */

/** Pointer type — a plain `number` on Bun, backed by BigInt on Deno. */
export type Pointer = number;

type BunFFIType =
  | "ptr"
  | "void"
  | "bool"
  | "u8"
  | "i8"
  | "u16"
  | "i16"
  | "u32"
  | "i32"
  | "u64"
  | "i64"
  | "usize"
  | "isize"
  | "f32"
  | "f64";

type DenoNativeType =
  | "pointer"
  | "void"
  | "bool"
  | "u8"
  | "i8"
  | "u16"
  | "i16"
  | "u32"
  | "i32"
  | "u64"
  | "i64"
  | "usize"
  | "isize"
  | "f32"
  | "f64";

const typeMap: Record<string, DenoNativeType> = {
  ptr: "pointer",
  void: "void",
  bool: "bool",
  u8: "u8",
  i8: "i8",
  u16: "u16",
  i16: "i16",
  u32: "u32",
  i32: "i32",
  u64: "u64",
  i64: "i64",
  usize: "usize",
  isize: "isize",
  f32: "f32",
  f64: "f64",
};

function convertType(t: string): DenoNativeType {
  return typeMap[t] ?? (t as DenoNativeType);
}

function isFFITypeEnum(v: unknown): v is FFITypeEnumValue {
  return typeof v === "string" && v in typeMap;
}

interface FFITypeEnumValue {
  readonly name: string;
}

const FFITypeValues = {
  ptr: "ptr" as const,
  void: "void" as const,
  bool: "bool" as const,
  u8: "u8" as const,
  i8: "i8" as const,
  u16: "u16" as const,
  i16: "i16" as const,
  u32: "u32" as const,
  i32: "i32" as const,
  u64: "u64" as const,
  i64: "i64" as const,
  usize: "usize" as const,
  isize: "isize" as const,
  f32: "f32" as const,
  f64: "f64" as const,
};

/** FFI type constants matching Bun's `FFIType` enum values. */
export const FFIType = FFITypeValues;

function convertArg(
  t: string | typeof FFITypeValues[keyof typeof FFITypeValues],
): DenoNativeType {
  return convertType(typeof t === "string" ? t : t);
}

interface BunSymbolDef {
  args?: (string | typeof FFITypeValues[keyof typeof FFITypeValues])[];
  returns?: string | typeof FFITypeValues[keyof typeof FFITypeValues];
}

type BunSymbols = Record<string, BunSymbolDef>;

function convertSymbols(symbols: BunSymbols) {
  const denoSymbols: Record<
    string,
    { parameters: DenoNativeType[]; result: DenoNativeType }
  > = {};
  for (const [name, def] of Object.entries(symbols)) {
    denoSymbols[name] = {
      parameters: (def.args ?? []).map((a) => convertArg(a)),
      result: convertType(
        def.returns
          ? (typeof def.returns === "string" ? def.returns : def.returns)
          : "void",
      ),
    };
  }
  return denoSymbols;
}

interface DlopenResult {
  symbols: Record<string, (...args: unknown[]) => unknown>;
  close(): void;
}

/**
 * Open a shared library and return its symbols as callable functions.
 *
 * Wraps `Deno.dlopen` with automatic argument and return-value conversion
 * between Bun's number-based pointer model and Deno's BigInt-based one.
 * Pointer arguments accept `number`, `ArrayBuffer`, or `ArrayBufferView`.
 * 64-bit integer arguments (`usize`, `isize`, `u64`, `i64`) accept JS
 * `number` and are converted to `BigInt` automatically. Return values of
 * those types are preserved as `BigInt`; other `bigint` returns become
 * `number`.
 *
 * @param path Absolute path to the shared library.
 * @param symbols Map of symbol names to `{ args?, returns? }` definitions
 *   using Bun FFI type strings.
 */
export function dlopen(path: string, symbols: BunSymbols): DlopenResult {
  const denoSymbols = convertSymbols(symbols);
  const lib = Deno.dlopen(
    path,
    denoSymbols as Parameters<typeof Deno.dlopen>[1],
  );
  const wrapped: Record<string, (...args: unknown[]) => unknown> = {};
  for (const name of Object.keys(symbols)) {
    const fn = lib.symbols[name] as (...args: unknown[]) => unknown;
    const paramTypes = denoSymbols[name].parameters;
    if (typeof fn === "function") {
      wrapped[name] = (...args: unknown[]): unknown => {
        const converted = args.map((a, i) => {
          if (paramTypes[i] === "pointer") {
            if (typeof a === "number") {
              return Deno.UnsafePointer.create(BigInt(a));
            }
            if (a instanceof ArrayBuffer || ArrayBuffer.isView(a)) {
              const p = Deno.UnsafePointer.of(a as BufferSource);
              if (p === null) return null;
              return p;
            }
            if (a === null || a === undefined) return a;
          }
          if (
            (paramTypes[i] === "usize" || paramTypes[i] === "isize" ||
              paramTypes[i] === "u64" || paramTypes[i] === "i64") &&
            typeof a === "number"
          ) {
            return BigInt(a);
          }
          return a;
        });
        const result = fn(...converted);
        const resultType = denoSymbols[name].result;
        if (typeof result === "bigint") {
          if (
            resultType === "u64" || resultType === "i64" ||
            resultType === "usize" || resultType === "isize"
          ) {
            return result;
          }
          return Number(result);
        }
        if (
          typeof result === "object" && result !== null &&
          denoSymbols[name].result === "pointer"
        ) {
          return Number(
            Deno.UnsafePointer.value(
              result as Parameters<typeof Deno.UnsafePointer.value>[0],
            ),
          );
        }
        return result;
      };
    }
  }
  return { symbols: wrapped, close: () => lib.close() };
}

/**
 * Get a pointer value (`number`) for an `ArrayBuffer` or `ArrayBufferView`.
 *
 * Equivalent to Bun's `ptr()` — returns `0` for null pointers.
 */
export function ptr(buffer: ArrayBuffer | ArrayBufferView): Pointer {
  const p = Deno.UnsafePointer.of(buffer as BufferSource);
  if (p === null) return 0 as Pointer;
  return Number(Deno.UnsafePointer.value(p)) as Pointer;
}

/**
 * Read an `ArrayBuffer` from a raw pointer address.
 *
 * @param pointer The pointer address (as a `number`).
 * @param byteOffset Byte offset into the memory region.
 * @param length Number of bytes to read.
 */
export function toArrayBuffer(
  pointer: Pointer,
  byteOffset: number,
  length: number,
): ArrayBuffer {
  const ptrObj = Deno.UnsafePointer.create(BigInt(pointer));
  // @ts-expect-error create may return null for address 0
  const view = new Deno.UnsafePointerView(ptrObj);
  return view.getArrayBuffer(length, byteOffset);
}

interface JSCallbackOptions {
  args: (string | typeof FFITypeValues[keyof typeof FFITypeValues])[];
  returns?: string | typeof FFITypeValues[keyof typeof FFITypeValues];
}

/**
 * Wraps a JavaScript function as a native FFI callback, matching Bun's
 * `JSCallback` API. Converts `BigInt` arguments to `number` before
 * invoking the wrapped function.
 *
 * @example
 * ```ts
 * const cb = new JSCallback((x) => x * 2, { args: ["i32"], returns: "i32" });
 * // pass cb.ptr to native code expecting a function pointer
 * cb.close(); // free when done
 * ```
 */
export class JSCallback {
  private _callback: Deno.UnsafeCallback;
  private _ptr: Pointer;

  constructor(fn: (...args: unknown[]) => void, options: JSCallbackOptions) {
    const parameters = options.args.map((a) =>
      convertArg(a)
    ) as DenoNativeType[];
    const result = convertType(
      options.returns
        ? (typeof options.returns === "string"
          ? options.returns
          : options.returns)
        : "void",
    ) as DenoNativeType;

    const wrappedFn = (...args: unknown[]): unknown => {
      const converted = args.map((a, i) => {
        if (typeof a === "bigint") return Number(a);
        return a;
      });
      return fn(...converted);
    };

    // @ts-expect-error Dynamic construction doesn't match strict Deno types
    this._callback = new Deno.UnsafeCallback({ parameters, result }, wrappedFn);
    const pointerObj = this._callback.pointer;
    this._ptr =
      (pointerObj === null
        ? 0
        : Number(Deno.UnsafePointer.value(pointerObj))) as Pointer;
  }

  get ptr(): Pointer {
    return this._ptr;
  }

  close() {
    this._callback.close();
  }
}

/** Platform-appropriate shared library suffix (`"dylib"`, `"so"`, or `"dll"`). */
export const suffix: string = Deno.build.os === "darwin"
  ? "dylib"
  : Deno.build.os === "windows"
  ? "dll"
  : "so";
