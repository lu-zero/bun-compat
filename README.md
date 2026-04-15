# @lu-zero/bun-compat

[![JSR](https://jsr.io/badges/@lu-zero/bun-compat)](https://jsr.io/@lu-zero/bun-compat)
[![CI](https://github.com/lu-zero/bun-compat/actions/workflows/ci.yml/badge.svg)](https://github.com/lu-zero/bun-compat/actions/workflows/ci.yml)

Bun API polyfill for Deno. Implements the Bun global surface using Deno native
APIs so that code written for Bun can run on Deno without modification.

> **Warning**: This codebase was largely AI-generated and has not yet been
> thoroughly audited. It may contain bugs, incomplete API coverage, or
> surprising edge-case behaviour. Use at your own risk and please report issues.

This project was developed primarily using
[glm-5.1](https://docs.z.ai/guides/llm/glm-5.1) from Zhipu AI and
[devstral-2](https://mistral.ai/) from Mistral AI.

## Usage

### Auto-install (import side effect)

```ts
import "bun-compat"; // installs globalThis.Bun on Deno, no-op on Bun
```

### Import map (manual)

```json
{
  "imports": {
    "bun": "path/to/bun-compat/src/from-bun.ts"
  }
}
```

Then `import { serve, spawn, $ } from "bun"` works as expected.

### globalThis.Bun installer

```ts
import BunShim from "bun-compat/src/install.ts";
globalThis.Bun = BunShim;
```

## Implemented APIs

| API                                                                            | Implementation                 | Notes                                                                                                         |
| ------------------------------------------------------------------------------ | ------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| `Bun.env`                                                                      | Proxy                          | Delegates to `Deno.env`                                                                                       |
| `Bun.argv`                                                                     | Direct                         | `Deno.args` with executable prepended                                                                         |
| `Bun.serve()`                                                                  | Wrapper                        | Wraps `Deno.serve()`                                                                                          |
| `Bun.spawn()` / `Bun.spawnSync()`                                              | Wrapper                        | Via `Deno.Command`                                                                                            |
| `Bun.$`                                                                        | Subprocess                     | Shell template tag; stdout/stderr have `.toString()` returning UTF-8                                          |
| `Bun.file()`                                                                   | Wrapper                        | `Deno.open` / `Deno.FsFile` wrapper. `writer()` returns `FileSink`                                            |
| `FileSink`                                                                     | Wrapper                        | `Deno.FsFile` with synchronous `write()`/`flush()`/`end()`                                                    |
| `Bun.write()`                                                                  | Wrapper                        | Auto-creates parent dirs. See limitations below                                                               |
| `Bun.sleep()`                                                                  | Direct                         | `setTimeout` wrapper                                                                                          |
| `Bun.stdin`                                                                    | Wrapper                        | `Deno.stdin` with `.text()`                                                                                   |
| `Bun.hash()`                                                                   | Pure JS + WASM                 | Callable returns `number` (xxHash32). See hash details below                                                  |
| `Bun.hash.xxHash64()`                                                          | Pure JS                        | Returns `bigint`. Pure TypeScript implementation                                                              |
| `Bun.hash.xxHash32()`                                                          | Pure JS                        | Returns `number`. Pure TypeScript implementation                                                              |
| `Bun.hash.wyhash()`                                                            | WASM                           | Returns `bigint`. Compiled from `wyhash` Rust crate via wasmbuild. Falls back to xxHash64 if WASM unavailable |
| `Bun.CryptoHasher`                                                             | `node:crypto`                  | Synchronous via `node:crypto.createHash`. See limitations below                                               |
| `Bun.Glob`                                                                     | `@std/fs` + `node:fs`          | `scan()` via `expandGlob`; `scanSync()` via `readdirSync`. See limitations below                              |
| `Bun.password`                                                                 | PBKDF2                         | **Incompatible with real Bun**. See limitations below                                                         |
| `Bun.stringWidth()` / `Bun.wrapAnsi()`                                         | Pure JS                        | ANSI-aware width and wrapping                                                                                 |
| `Bun.stripANSI()`                                                              | Regex                          | Strips SGR, OSC, and common ANSI sequences                                                                    |
| `Bun.inspect()`                                                                | `Deno.inspect`                 | Delegates to `Deno.inspect()` with depth/colors options                                                       |
| `Bun.which()`                                                                  | PATH lookup                    | Via `@std/cli`                                                                                                |
| `Bun.color()`                                                                  | Manual                         | ANSI-16m, ANSI-256, hex, CSS output from hex or integer input                                                 |
| `Bun.listen()` / `Bun.connect()`                                               | `Deno.listen` / `Deno.connect` | TCP and Unix socket support for DAP-style protocols                                                           |
| `Bun.nanoseconds()`                                                            | `Deno.nanoseconds`             | Returns `bigint` (matches real Bun)                                                                           |
| `Bun.gc()`                                                                     | Stub                           | **No-op**. Deno has no programmatic GC API                                                                    |
| `Bun.generateHeapSnapshot()`                                                   | Stub                           | Returns `{ error: "not supported" }`. Not possible under Deno                                                 |
| `Bun.TOML` / `Bun.YAML` / `Bun.JSONC` / `Bun.JSON5` / `Bun.JSONL`              | `@std/*`                       | Parsers via Deno standard library                                                                             |
| `Bun.fileURLToPath()` / `Bun.pathToFileURL()`                                  | Direct                         | URL ↔ path conversion                                                                                         |
| `Bun.Archive`                                                                  | Manual                         | Tar/gzip read and write. See limitations below                                                                |
| `Database` / `Statement`                                                       | `node:sqlite`                  | Bun SQLite API over `DatabaseSync` with typed `prepare()`. See limitations below                              |
| `dlopen()` / `ptr()` / `toArrayBuffer()` / `JSCallback` / `FFIType` / `suffix` | `Deno.dlopen`                  | Bun FFI over Deno FFI                                                                                         |
| `CString`                                                                      | Manual                         | Null-terminated C string interop via `Deno.UnsafePointer`                                                     |
| `defineStruct()` / `defineEnum()`                                              | Manual                         | Binary pack/unpack with alignment, pointer support                                                            |

## Limitations

### `Bun.write()`

Only supports `string`, `Uint8Array`, `ArrayBuffer`, and `Blob` inputs. Bun's
`Bun.write()` also accepts `ReadableStream`, `Response`, and `BunFile` — these
are not yet implemented.

### `Bun.password`

All algorithms (`bcrypt`, `argon2id`, `argon2d`, `argon2i`) are implemented
using **PBKDF2-SHA256**. Hashes produced here are **NOT compatible** with real
Bun's bcrypt or argon2 output. They use a custom `$algorithm$salt$hash` format
that only this shim can verify. Do not use for interoperability with Bun-native
hashed passwords.

### `Bun.CryptoHasher`

Uses `node:crypto.createHash()` under the hood. Supports SHA-1, MD5, SHA-256,
SHA-384, SHA-512. Algorithms `xxhash64` and `wyhash` are accepted but mapped to
Node.js equivalents (not real xxHash/wyhash). `digest()` without arguments
returns `Uint8Array` instead of Bun's `Buffer`.

### `Bun.Glob.scanSync()`

Simplified implementation using `node:fs.readdirSync`. Handles `*`, `?`, and
`**` patterns but may not match Bun's exact behavior for character classes
(`[abc]`), brace expansion (`{a,b}`), or negation (`!pattern`). For full glob
semantics, use the async `scan()` method which delegates to
`@std/fs expandGlob`.

### `Bun.gc()` / `Bun.generateHeapSnapshot()`

No-op stubs. Deno does not expose programmatic GC or heap snapshot APIs. Code
that depends on real heap snapshot data (e.g. Chrome DevTools profiling) will
not work. These stubs exist only to prevent runtime crashes.

### `Bun.hash()` — callable form

`Bun.hash(input, seed?)` returns a `number` (via xxHash32). This matches Bun's
behavior where the callable form returns a non-cryptographic number. The named
methods `xxHash64()` and `wyhash()` return `bigint`.

Note: some Bun code uses `Bun.nanoseconds()` (bigint) in arithmetic with number
literals (e.g. `(now - prev) / 1e6`). Bun's runtime handles this implicitly, but
standard JS engines throw "Cannot mix BigInt and other types". Downstream compat
layers should override `Bun.nanoseconds` to return `number` if needed.

### `Database` (SQLite)

Wraps `node:sqlite` `DatabaseSync`. `Statement.columnNames` is derived from
`columns().map(c => c.name)`. `Statement.paramsCount` parses the SQL source (it
is not exposed by `DatabaseSync`). `Statement.finalize()` is a no-op
(`DatabaseSync` has no `finalize`). `Database.transaction()` uses manual
`BEGIN`/`COMMIT`/`ROLLBACK` instead of Bun's optimized compiled transaction.

### `Bun.listen()` / `Bun.connect()`

Implements the socket handler pattern (`open`, `data`, `close`, `error`) used by
the DAP debug adapter protocol. Not a complete Bun.Socket implementation.

### `Bun.Archive`

Reads tar and tar+gzip archives. `Archive.write()` produces tar with optional
gzip compression. Does not support other compression formats (bzip2, xz, zstd).
Write mode does not preserve file permissions, ownership, or symlinks — all
entries are written as regular files with zeroed metadata.

## WASM Native Modules

The `wyhash` hash function is compiled to WASM from the `wyhash` Rust crate
using [wasmbuild](https://jsr.io/@deno/wasmbuild). The build outputs live in
`src/wasm/` and are loaded dynamically with a fallback to xxHash64.

To rebuild the WASM module:

```bash
cd native/wyhash
deno run -A jsr:@deno/wasmbuild build
cp lib/wyhash_wasm.* ../../src/wasm/
```

## Test

```bash
deno task test
```

## License

MIT
