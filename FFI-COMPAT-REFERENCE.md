# Bun ↔ Deno FFI Compatibility Reference

## The Core Problem

Bun and Deno have fundamentally different representations for FFI pointer types.
Wide integer types (`u64`/`i64`/`usize`/`isize`) are `bigint` in **both**
runtimes and need no conversion. Pointers differ:

| Concept                       | Bun                            | Deno                                       |
| ----------------------------- | ------------------------------ | ------------------------------------------ |
| Pointer values                | `number` (branded `Pointer`)   | `PointerObject` (opaque frozen object)     |
| Null pointer                  | `null`                         | `null`                                     |
| Pointer args to FFI fn        | `number`, `TypedArray`, `null` | `PointerObject`, `null`, or `BufferSource` |
| Pointer returns from FFI fn   | `number` or `null`             | `PointerObject` or `null`                  |
| Pointer args to callback      | `number` or `null`             | `PointerObject` or `null`                  |
| Pointer returns from callback | `number` or `null`             | `PointerObject` or `null`                  |
| `u64`/`i64`/`usize`/`isize`   | `bigint` (both args & returns) | `bigint` (both args & returns)             |

## Conversion Rules

All conversion is **type-aware**: the declared FFI type of each parameter and
return value determines the conversion applied. We never guess based on `typeof`
alone — that leads to whack-a-mole fixes.

### `dlopen` — function call arguments (JS → C)

| Param type                        | Bun calling convention                             | What Deno expects                          | Conversion                                                                                                 |
| --------------------------------- | -------------------------------------------------- | ------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| `ptr` / `pointer`                 | `number`, `ArrayBuffer`, `ArrayBufferView`, `null` | `PointerObject`, `null`, or `BufferSource` | `number` → `Deno.UnsafePointer.create(BigInt(n))`; buffers → `Deno.UnsafePointer.of(buf)`; `null` → `null` |
| `usize` / `isize` / `u64` / `i64` | `number` or `bigint`                               | `bigint`                                   | `typeof n === "number" ? BigInt(n) : n`                                                                    |
| All others                        | `number` or `boolean`                              | same                                       | Pass through                                                                                               |

### `dlopen` — function return values (C → JS)

| Return type                       | What Deno returns         | What Bun code expects | Conversion                                                   |
| --------------------------------- | ------------------------- | --------------------- | ------------------------------------------------------------ |
| `ptr` / `pointer`                 | `PointerObject` or `null` | `number` or `null`    | `Number(Deno.UnsafePointer.value(obj))`; `null` → `null`     |
| `usize` / `isize` / `u64` / `i64` | `bigint`                  | `bigint`              | **Preserve as-is** — do NOT convert to number                |
| Other `bigint` returns            | `bigint`                  | `number`              | `Number(result)` (safety net — shouldn't happen in practice) |
| Non-bigint returns                | same                      | same                  | Pass through                                                 |

### `JSCallback` — native→JS callback arguments

When native code calls back into JS:

| Arg type                          | What Deno delivers        | What Bun delivers  | Conversion                                                                 |
| --------------------------------- | ------------------------- | ------------------ | -------------------------------------------------------------------------- |
| `ptr` / `pointer`                 | `PointerObject` or `null` | `number` or `null` | `PointerObject` → `Number(Deno.UnsafePointer.value(obj))`; `null` → `null` |
| `usize` / `isize` / `u64` / `i64` | `bigint`                  | `bigint`           | **Keep as `bigint`** — same in both runtimes                               |
| All others                        | same                      | same               | Pass through                                                               |

### `JSCallback` — JS→native return values

| Return type                       | What Bun code returns | What Deno expects         | Conversion                                                         |
| --------------------------------- | --------------------- | ------------------------- | ------------------------------------------------------------------ |
| `ptr` / `pointer`                 | `number` or `null`    | `PointerObject` or `null` | `number` → `Deno.UnsafePointer.create(BigInt(n))`; `null` → `null` |
| `usize` / `isize` / `u64` / `i64` | `bigint` or `number`  | `bigint`                  | `typeof n === "number" ? BigInt(n) : n`                            |
| `void`                            | `undefined`           | `undefined`               | Pass through                                                       |
| All others                        | same                  | same                      | Pass through                                                       |

### `ptr()` — get pointer value from buffer

|             | Bun                                | Deno                                                                    |
| ----------- | ---------------------------------- | ----------------------------------------------------------------------- |
| Input       | `ArrayBuffer` or `ArrayBufferView` | Same                                                                    |
| Output      | `number`                           | `Deno.UnsafePointer` → convert to `Number(Deno.UnsafePointer.value(p))` |
| Null buffer | Returns `0`                        | `Deno.UnsafePointer.of()` returns `null` → return `0`                   |

### `toArrayBuffer()` — read memory at pointer

|             | Bun           | Deno                                                       |
| ----------- | ------------- | ---------------------------------------------------------- |
| Pointer arg | `number`      | Must convert: `Deno.UnsafePointer.create(BigInt(pointer))` |
| Output      | `ArrayBuffer` | Same (`Deno.UnsafePointerView.getArrayBuffer`)             |

## Bugs We've Hit (and fixed)

1. **`dlopen` args: no BigInt conversion for `usize`** — Deno requires BigInt
   for `usize`/`isize`/`u64`/`i64` params. Calling with a JS `number` throws
   `TypeError: Cannot mix BigInt and other types`. Fixed in 0.2.3.

2. **`dlopen` returns: all BigInts converted to Number** —
   `u64`/`i64`/`usize`/`isize` returns were blindly `Number()`-ed. But calling
   code uses BigInt operations (`>> 32n`), causing
   `Cannot mix BigInt and other types`. Fixed in 0.2.4 by preserving BigInt for
   these types.

3. **`JSCallback` args: PointerObject not converted** — Deno delivers pointer
   args as `PointerObject` (opaque object), not `number`. The wrapper only
   handled `typeof a === "bigint"`, so PointerObject objects passed through
   as-is. Code expecting a `number` Pointer got an object → `toArrayBuffer`
   crashed. Fixed in 0.2.5.

4. **`JSCallback` args: bigint incorrectly converted to number** — The initial
   fix converted ALL `bigint` args to `number`, including `usize`/`u64` args
   that Bun also delivers as `bigint`. This broke code that uses BigInt
   operations on these values. Fixed in 0.2.5 by making all conversion
   type-aware.

## Checklist for New Conversions

When adding a new Bun FFI usage that runs on Deno, verify:

- [ ] Every `ptr`/`pointer` param is converted: `number` →
      `Deno.UnsafePointer.create(BigInt(n))`
- [ ] Every `usize`/`isize`/`u64`/`i64` param is converted: `number` →
      `BigInt(n)`
- [ ] Every `ptr`/`pointer` return is converted: `PointerObject` →
      `Number(Deno.UnsafePointer.value(obj))`
- [ ] Every `usize`/`isize`/`u64`/`i64` return is **preserved as BigInt** (not
      converted to number)
- [ ] Every `JSCallback` pointer arg is converted: `PointerObject` →
      `Number(Deno.UnsafePointer.value(obj))`
- [ ] Every `JSCallback` wide-integer arg (`usize`/`u64`/etc) is **kept as
      BigInt** (same as Bun)
- [ ] Every `JSCallback` pointer return is converted: `number` →
      `Deno.UnsafePointer.create(BigInt(n))`
- [ ] Every `JSCallback` wide-integer return is converted if needed: `number` →
      `BigInt(n)`
- [ ] `ptr()` returns `number`, not `PointerObject`
- [ ] `toArrayBuffer()` receives `number`, converts internally to
      `PointerObject`
