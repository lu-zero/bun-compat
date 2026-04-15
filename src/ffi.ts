/**
 * Bun FFI compatibility layer for Deno.
 *
 * Provides `dlopen`, `ptr`, `toArrayBuffer`, `JSCallback`, and `FFIType` —
 * matching the `bun:ffi` API surface so that code written for Bun can run
 * on Deno without changes.
 *
 * ## Conversion Model
 *
 * Bun and Deno differ fundamentally in how they represent pointers and
 * wide integers across FFI boundaries:
 *
 * | Concept              | Bun                    | Deno                          |
 * |----------------------|------------------------|-------------------------------|
 * | Pointer values       | `number`              | `PointerObject` (opaque obj) |
 * | u64/i64/usize/isize  | `bigint` (returns/args) | `bigint` (returns/args)     |
 * | Null pointer         | `null`                | `null`                        |
 *
 * Every conversion is **type-aware**: the declared FFI type of each
 * parameter and return value determines the conversion applied.
 * This avoids the "whack-a-mole" pattern of fixing one type mismatch
 * at a time.
 *
 * @module
 */

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

const WIDE_INT_TYPES = new Set<string>(["u64", "i64", "usize", "isize"]);
const POINTER_TYPES = new Set<string>(["ptr", "pointer"]);

function isWideInt(t: string): boolean {
  return WIDE_INT_TYPES.has(t);
}

function isPointerType(t: string): boolean {
  return POINTER_TYPES.has(t);
}

function convertType(t: string): DenoNativeType {
  return typeMap[t] ?? (t as DenoNativeType);
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

export const FFIType = FFITypeValues;

type FFITypeValue = (typeof FFITypeValues)[keyof typeof FFITypeValues];

function resolveType(t: string | FFITypeValue): string {
  return typeof t === "string" ? t : t;
}

interface BunSymbolDef {
  args?: (string | FFITypeValue)[];
  returns?: string | FFITypeValue;
}

type BunSymbols = Record<string, BunSymbolDef>;

interface ResolvedSymbol {
  parameters: DenoNativeType[];
  result: DenoNativeType;
  bunParamTypes: string[];
  bunResultType: string;
}

function resolveSymbols(symbols: BunSymbols): {
  denoSymbols: Record<
    string,
    { parameters: DenoNativeType[]; result: DenoNativeType }
  >;
  resolved: Record<string, ResolvedSymbol>;
} {
  const denoSymbols: Record<
    string,
    { parameters: DenoNativeType[]; result: DenoNativeType }
  > = {};
  const resolved: Record<string, ResolvedSymbol> = {};

  for (const [name, def] of Object.entries(symbols)) {
    const bunParamTypes = (def.args ?? []).map((a) => resolveType(a));
    const bunResultType = def.returns ? resolveType(def.returns) : "void";
    const parameters = bunParamTypes.map((t) => convertType(t));
    const result = convertType(bunResultType);

    denoSymbols[name] = { parameters, result };
    resolved[name] = { parameters, result, bunParamTypes, bunResultType };
  }

  return { denoSymbols, resolved };
}

// --- Type-aware argument conversion (JS → Deno FFI) ---

function convertArgToDeno(value: unknown, bunType: string): unknown {
  if (isPointerType(bunType)) {
    if (value === null || value === undefined) return null;
    if (typeof value === "number") {
      return Deno.UnsafePointer.create(BigInt(value));
    }
    if (value instanceof ArrayBuffer || ArrayBuffer.isView(value)) {
      const p = Deno.UnsafePointer.of(value as BufferSource);
      return p === null ? null : p;
    }
    return value;
  }
  if (isWideInt(bunType)) {
    if (typeof value === "number") return BigInt(value);
    return value;
  }
  return value;
}

// --- Type-aware return conversion (Deno FFI → JS / Bun convention) ---

function convertReturnFromDeno(value: unknown, bunType: string): unknown {
  if (isPointerType(bunType)) {
    if (value === null) return null;
    if (typeof value === "object" && value !== null) {
      return Number(
        Deno.UnsafePointer.value(
          value as Parameters<typeof Deno.UnsafePointer.value>[0],
        ),
      );
    }
    if (typeof value === "bigint") return Number(value);
    return value;
  }
  if (isWideInt(bunType)) {
    return value;
  }
  if (typeof value === "bigint") {
    return Number(value);
  }
  return value;
}

// --- Type-aware callback argument conversion (Deno → JS / Bun convention) ---

function convertCallbackArgFromDeno(value: unknown, bunType: string): unknown {
  if (isPointerType(bunType)) {
    if (value === null) return null;
    if (typeof value === "object" && value !== null) {
      try {
        return Number(
          Deno.UnsafePointer.value(
            value as Parameters<typeof Deno.UnsafePointer.value>[0],
          ),
        );
      } catch {
        return value;
      }
    }
    if (typeof value === "bigint") return Number(value);
    if (typeof value === "number") return value;
    return value;
  }
  // u64/i64/usize/isize: both Bun and Deno deliver as bigint → keep as-is
  return value;
}

// --- Type-aware callback return conversion (JS / Bun convention → Deno FFI) ---

function convertCallbackReturnToDeno(value: unknown, bunType: string): unknown {
  if (isPointerType(bunType)) {
    if (value === null) return null;
    if (typeof value === "number") {
      return Deno.UnsafePointer.create(BigInt(value));
    }
    return value;
  }
  if (isWideInt(bunType)) {
    if (typeof value === "number") return BigInt(value);
    return value;
  }
  return value;
}

// --- dlopen ---

interface DlopenResult {
  symbols: Record<string, (...args: unknown[]) => unknown>;
  close(): void;
}

export function dlopen(path: string, symbols: BunSymbols): DlopenResult {
  const { denoSymbols, resolved } = resolveSymbols(symbols);
  const lib = Deno.dlopen(
    path,
    denoSymbols as Parameters<typeof Deno.dlopen>[1],
  );
  const wrapped: Record<string, (...args: unknown[]) => unknown> = {};

  for (const name of Object.keys(symbols)) {
    const fn = lib.symbols[name] as (...args: unknown[]) => unknown;
    const sym = resolved[name];

    if (typeof fn === "function") {
      wrapped[name] = (...args: unknown[]): unknown => {
        const converted = args.map((a, i) =>
          convertArgToDeno(a, sym.bunParamTypes[i])
        );
        const result = fn(...converted);
        return convertReturnFromDeno(result, sym.bunResultType);
      };
    }
  }

  return { symbols: wrapped, close: () => lib.close() };
}

// --- ptr ---

export function ptr(buffer: ArrayBuffer | ArrayBufferView): Pointer {
  const p = Deno.UnsafePointer.of(buffer as BufferSource);
  if (p === null) return 0 as Pointer;
  return Number(Deno.UnsafePointer.value(p)) as Pointer;
}

// --- toArrayBuffer ---

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

// --- JSCallback ---

interface JSCallbackOptions {
  args: (string | FFITypeValue)[];
  returns?: string | FFITypeValue;
}

export class JSCallback {
  private _callback: Deno.UnsafeCallback;
  private _ptr: Pointer;

  constructor(fn: (...args: unknown[]) => unknown, options: JSCallbackOptions) {
    const bunParamTypes = options.args.map((a) => resolveType(a));
    const bunResultType = options.returns
      ? resolveType(options.returns)
      : "void";
    const parameters = bunParamTypes.map((t) =>
      convertType(t)
    ) as DenoNativeType[];
    const result = convertType(bunResultType) as DenoNativeType;

    const wrappedFn = (...args: unknown[]): unknown => {
      const converted = args.map((a, i) =>
        convertCallbackArgFromDeno(a, bunParamTypes[i])
      );
      const returnValue = fn(...converted);
      return convertCallbackReturnToDeno(returnValue, bunResultType);
    };

    // @ts-expect-error Dynamic construction doesn't match strict Deno types
    this._callback = new Deno.UnsafeCallback({ parameters, result }, wrappedFn);
    const pointerObj = this._callback.pointer;
    this._ptr = (
      pointerObj === null ? 0 : Number(Deno.UnsafePointer.value(pointerObj))
    ) as Pointer;
  }

  get ptr(): Pointer {
    return this._ptr;
  }

  close() {
    this._callback.close();
  }
}

export const suffix: string = Deno.build.os === "darwin"
  ? "dylib"
  : Deno.build.os === "windows"
  ? "dll"
  : "so";

export class CString {
  #data: Uint8Array;
  constructor(data: Uint8Array) {
    this.#data = data;
  }
  toString(): string {
    let end = this.#data.indexOf(0);
    if (end === -1) end = this.#data.length;
    return new TextDecoder().decode(this.#data.subarray(0, end));
  }
  get byteLength(): number {
    return this.#data.byteLength;
  }
  get ptr(): Pointer {
    const p = Deno.UnsafePointer.of(this.#data as unknown as BufferSource);
    if (p === null) return 0 as Pointer;
    return Number(Deno.UnsafePointer.value(p)) as Pointer;
  }
}
