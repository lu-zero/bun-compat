/**
 * Global type overrides for Deno to match Bun's API surface.
 *
 * Include this file in `compilerOptions.types` to override Deno's built-in
 * timer and fetch types with Bun-compatible declarations.
 *
 * Deno's built-in `setTimeout` returns `number`, but Bun returns a `Timer`
 * object with `ref()` / `unref()` / `hasRef()` / `refresh()` methods. Code
 * that calls `.unref()` on timer handles will type-check correctly when this
 * file is included.
 *
 * Similarly, Bun's `fetch` has a `.preconnect()` method that Deno's does not.
 */

// Bun-compatible timer type
interface BunTimer extends number {
  ref(): BunTimer;
  unref(): BunTimer;
  hasRef(): boolean;
  refresh(): BunTimer;
}

declare var setTimeout: {
  <T extends (...args: any[]) => void>(
    callback: T,
    ms?: number,
    ...args: Parameters<T>
  ): BunTimer;
  (ms?: number): Promise<void>;
};

declare var setInterval: {
  <T extends (...args: any[]) => void>(
    callback: T,
    ms?: number,
    ...args: Parameters<T>
  ): BunTimer;
};

declare var clearTimeout: (id: BunTimer | number | undefined) => void;
declare var clearInterval: (id: BunTimer | number | undefined) => void;

// Bun-compatible fetch with preconnect
interface FetchWithPreconnect {
  (input: URL | RequestInfo, init?: RequestInit): Promise<Response>;
  preconnect(url: string | URL): void;
}

declare var fetch: FetchWithPreconnect;

// Bun-compatible ReadOnlyDict (Bun global type)
interface ReadOnlyDict<T> {
  readonly [key: string]: T | undefined;
}

export {};
