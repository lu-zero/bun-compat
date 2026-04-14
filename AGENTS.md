# AGENTS.md

## Project

bun-compat is a Bun API polyfill for Deno. It implements the Bun global surface
using Deno native APIs so Bun code runs unmodified on Deno.

## Commands

```bash
deno task test          # run all tests
deno task check         # type check
deno task lint          # lint
deno task fmt           # auto-format
deno task fmt:check     # check formatting
```

## Structure

- `src/from-bun.ts` — re-exports every Bun API. This is what `"bun"` maps to via
  import map.
- `src/install.ts` — assembles `globalThis.Bun` shim object (used by
  `src/index.ts` auto-installer).
- `src/index.ts` — auto-installs `globalThis.Bun` on Deno (import side-effect
  entry point).
- `src/sqlite.ts` — `Database` class over `node:sqlite`'s `DatabaseSync`.
- `src/hash.ts` — xxHash32 (number), xxHash64 (bigint), wyhash (bigint via
  WASM).
- `src/wasm/` — WASM wyhash module (built from `native/wyhash/` Rust crate).
- `src/crypto-hasher.ts` — `CryptoHasher` via `node:crypto`.
- `src/strip-ansi.ts` — regex-based ANSI escape removal.
- `src/parsers/` — TOML, YAML, JSONC, JSON5, JSONL (delegated to `@std/*`).
- `src/platform.ts` — runtime detection (`isBun`, `isDeno`).
- `native/wyhash/` — Rust crate compiled to WASM via wasmbuild.
- `test/` — Deno test files, one per module group.

## Conventions

- TypeScript throughout, strict mode, no build step.
- Dependencies: `@std/*` from JSR only. No npm runtime deps. `@types/bun` is
  dev-only for type info.
- One export per file, assembled in `from-bun.ts`. When adding a new API:
  implement in its own file, add to `from-bun.ts`, add to `install.ts`, add a
  test.
- `deno.json` import map provides `"bun"` → `./src/from-bun.ts` self-reference
  for the polyfill.
- Deno 2.x target. No `node_modules` needed at runtime.

## Adding a new Bun API

1. Create `src/<api>.ts` implementing the API
2. Add `export { ... } from "./<api>.ts"` to `src/from-bun.ts`
3. Add to the `BunShim` object in `src/install.ts` if it belongs on
   `globalThis.Bun`
4. Add type to `src/types.d.ts`
5. Add tests in `test/`
6. Run `deno task test` and `deno task check`
7. Run `deno task lint` and `deno task fmt:check` — both must pass

## Rebuilding the WASM wyhash module

```bash
cd native/wyhash
deno run -A jsr:@deno/wasmbuild build
cp lib/wyhash_wasm.* ../../src/wasm/
```

Then commit the updated `src/wasm/` files.

## Known limitations (stubs and incompatibilities)

These APIs are documented with JSDoc in their source files. Do not remove the
stubs without a working replacement — they prevent runtime crashes.

- `Bun.password` — PBKDF2 only, not compatible with real Bun bcrypt/argon2
- `Bun.gc()` — no-op, Deno has no programmatic GC
- `Bun.generateHeapSnapshot()` — returns error object, not possible under Deno
- `Bun.write()` — no `ReadableStream`/`Response`/`BunFile` input support
- `Bun.Glob.scanSync()` — simplified, no `[abc]`/`{a,b}`/`!pattern` support
- `Bun.CryptoHasher` — returns `Uint8Array` not `Buffer`; `xxhash64`/`wyhash`
  algo names map to SHA
- `Database.transaction()` — manual BEGIN/COMMIT/ROLLBACK, not Bun's compiled
  transactions
- `Statement.finalize()` — no-op (`DatabaseSync` has no finalize)
- `Statement.paramsCount` — parsed from SQL source, not exposed natively
