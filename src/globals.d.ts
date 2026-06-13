/**
 * Global type augmentations for Deno to match Bun's API surface.
 *
 * Include this file in `compilerOptions.types` so the interface mergers
 * below are picked up. Only `interface` merging works — Deno's built-in
 * `declare var` / `declare function` types cannot be overridden from
 * external `.d.ts` files, so timer handles (which are `number` in Deno)
 * get `unref()` via `interface Number` merging instead.
 */

// Bun adds ref/unref/refresh to timer handles (which are numbers in Deno)
interface Number {
  ref(): Number;
  unref(): Number;
  hasRef(): boolean;
  refresh(): Number;
}

// Bun's WebSocket has a ping() method
interface WebSocket {
  ping(data?: string | ArrayBufferLike | ArrayBufferView): void;
}

// Bun-compatible ReadOnlyDict (Bun global type)
interface ReadOnlyDict<T> {
  readonly [key: string]: T | undefined;
}
