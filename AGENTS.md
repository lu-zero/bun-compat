# AGENTS.md

## Project

bun-compat is a Bun API polyfill for Deno. It implements the Bun global surface
using Deno native APIs so Bun code runs unmodified on Deno.

## Commands

```bash
deno test --allow-all test/    # run all 29 tests
deno check src/index.ts        # type check
deno fmt --check               # check formatting
deno lint                      # lint
deno fmt                       # auto-format
```

## Structure

- `src/from-bun.ts` — re-exports every Bun API. This is what `"bun"` maps to via
  import map.
- `src/install.ts` — assembles `globalThis.Bun` shim object (used by
  `src/index.ts` auto-installer).
- `src/index.ts` — auto-installs `globalThis.Bun` on Deno (import side-effect
  entry point).
- `src/sqlite.ts` — `Database` class over `node:sqlite`'s `DatabaseSync`.
- `src/parsers/` — TOML, YAML, JSONC, JSON5, JSONL (delegated to `@std/*`).
- `src/platform.ts` — runtime detection (`isBun`, `isDeno`).
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
6. Run `deno test --allow-all test/` and `deno check src/index.ts`
