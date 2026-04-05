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
          return a;
        });
        const result = fn(...converted);
        if (typeof result === "bigint") {
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

export function ptr(buffer: ArrayBuffer | ArrayBufferView): Pointer {
  const p = Deno.UnsafePointer.of(buffer as BufferSource);
  if (p === null) return 0 as Pointer;
  return Number(Deno.UnsafePointer.value(p)) as Pointer;
}

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

export const suffix: string = Deno.build.os === "darwin"
  ? "dylib"
  : Deno.build.os === "windows"
  ? "dll"
  : "so";
