# bun-compat

Bun API polyfill for Deno. Implements the Bun global surface using Deno native
APIs so that code written for Bun can run on Deno without modification.

> **Warning**: This codebase was largely AI-generated (slop-coded) and has not
> yet been thoroughly audited. It may contain bugs, incomplete API coverage, or
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

| API                                                                            | Notes                                                                                         |
| ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| `Bun.env`                                                                      | Proxy to `Deno.env`                                                                           |
| `Bun.argv`                                                                     | `Deno.args` with executable prepended                                                         |
| `Bun.serve()`                                                                  | Wraps `Deno.serve()`                                                                          |
| `Bun.spawn()` / `Bun.spawnSync()`                                              | Via `Deno.Command`                                                                            |
| `Bun.$`                                                                        | Shell template tag via subprocess                                                             |
| `Bun.file()` / `Bun.write()`                                                   | `Deno.open` / `Deno.writeFile` wrappers                                                       |
| `Bun.sleep()`                                                                  | `setTimeout` wrapper                                                                          |
| `Bun.stdin`                                                                    | `Deno.stdin` wrapper with `.text()`                                                           |
| `Bun.hash()`                                                                   | xxHash64 / wyhash (pure JS)                                                                   |
| `Bun.Glob`                                                                     | Via `@std/fs expandGlob`                                                                      |
| `Bun.password()`                                                               | PBKDF2 via `crypto.subtle`                                                                    |
| `Bun.stringWidth()` / `Bun.wrapAnsi()`                                         | String width measurement + wrapping                                                           |
| `Bun.which()`                                                                  | PATH lookup via `@std/cli`                                                                    |
| `Bun.TOML` / `Bun.YAML` / `Bun.JSONC` / `Bun.JSON5` / `Bun.JSONL`              | Parsers via `@std/*`                                                                          |
| `Bun.fileURLToPath()` / `Bun.pathToFileURL()`                                  | URL ↔ path conversion                                                                         |
| `Database`                                                                     | Bun SQLite API over `node:sqlite` (`DatabaseSync`)                                            |
| `dlopen()` / `ptr()` / `toArrayBuffer()` / `JSCallback` / `FFIType` / `suffix` | Bun FFI over `Deno.dlopen`                                                                    |
| `defineStruct()` / `defineEnum()`                                              | Bun FFI structs with `lengthOf`, `mapValue`, `reduceValue`, `packTransform`/`unpackTransform` |

## Test

```bash
deno task test
```

58 tests, all passing.

## License

MIT
