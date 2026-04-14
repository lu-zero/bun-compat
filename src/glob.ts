import { expandGlob } from "@std/fs";
import * as path from "@std/path";
import * as fs from "node:fs";
import * as nodePath from "node:path";

export interface GlobScanOptions {
  cwd?: string;
  dot?: boolean;
  absolute?: boolean;
  onlyFiles?: boolean;
}

export class Glob {
  #pattern: string;

  constructor(pattern: string) {
    this.#pattern = pattern;
  }

  async scan(opts?: GlobScanOptions): Promise<string[]> {
    const cwd = opts?.cwd ?? Deno.cwd();
    const root = path.resolve(cwd);
    const results: string[] = [];

    for await (const entry of expandGlob(this.#pattern, {
      root,
      includeDirs: opts?.onlyFiles === true ? false : true,
    })) {
      const relative = path.relative(root, entry.path);
      if (!opts?.dot && path.basename(entry.path).startsWith(".")) continue;
      if (opts?.absolute) {
        results.push(entry.path);
      } else {
        results.push(relative);
      }
    }

    return results;
  }

  /**
   * Synchronous glob scan.
   *
   * **Limitation**: Simplified implementation using `node:fs.readdirSync`.
   * Handles `*`, `?`, and `**` patterns but may not match Bun's exact
   * behavior for character classes (`[abc]`), brace expansion (`{a,b}`),
   * or negation (`!pattern`). For full glob semantics, use the async
   * `scan()` which delegates to `@std/fs expandGlob`.
   */
  *scanSync(opts?: GlobScanOptions): Iterable<string> {
    const cwd = opts?.cwd ?? Deno.cwd();
    const root = nodePath.resolve(cwd);
    const segments = this.#pattern.split("/");
    yield* this.#scanDir(root, segments, opts);
  }

  *#scanDir(
    dir: string,
    segments: string[],
    opts?: GlobScanOptions,
  ): Iterable<string> {
    if (segments.length === 0) return;
    const [head, ...rest] = segments;

    if (head === "**") {
      // ** matches zero or more path segments
      // Try rest against current dir (zero segments matched)
      if (rest.length > 0) {
        yield* this.#scanDir(dir, rest, opts);
      } else {
        // ** at the end — match all files in all subdirs
        yield* this.#walkAll(dir, opts);
      }
      // Also recurse into subdirectories, keeping ** active for deeper matches
      let entries: fs.Dirent[];
      try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
      } catch {
        return;
      }
      for (const entry of entries) {
        if (!opts?.dot && entry.name.startsWith(".")) continue;
        if (entry.isDirectory()) {
          const fullPath = nodePath.join(dir, entry.name);
          // In the subdir, ** can match zero again (so try rest there) or keep going
          yield* this.#scanDir(fullPath, segments, opts);
        }
      }
      return;
    }

    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }

    const isLast = rest.length === 0;

    for (const entry of entries) {
      if (!opts?.dot && entry.name.startsWith(".")) continue;

      const fullPath = nodePath.join(dir, entry.name);

      if (head === "*" || globMatches(head, entry.name)) {
        if (isLast) {
          if (opts?.onlyFiles === true && !entry.isFile()) continue;
          if (opts?.absolute) yield fullPath;
          else yield nodePath.relative(opts?.cwd ?? Deno.cwd(), fullPath);
        } else if (entry.isDirectory()) {
          yield* this.#scanDir(fullPath, rest, opts);
        }
      }
    }
  }

  *#walkAll(dir: string, opts?: GlobScanOptions): Iterable<string> {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (!opts?.dot && entry.name.startsWith(".")) continue;
      const fullPath = nodePath.join(dir, entry.name);
      if (entry.isFile()) {
        if (opts?.onlyFiles !== false || opts?.onlyFiles === undefined) {
          if (opts?.absolute) yield fullPath;
          else yield nodePath.relative(opts?.cwd ?? Deno.cwd(), fullPath);
        }
      }
      if (entry.isDirectory()) {
        yield* this.#walkAll(fullPath, opts);
      }
    }
  }

  match(inputPath: string): boolean {
    const regex = globToRegex(this.#pattern);
    return regex.test(inputPath);
  }
}

function globMatches(pattern: string, name: string): boolean {
  const regex = new RegExp(
    "^" +
      pattern
        .replace(/\./g, "\\.")
        .replace(/\*/g, "[^/]*")
        .replace(/\?/g, "[^/]") +
      "$",
  );
  return regex.test(name);
}

function globToRegex(pattern: string): RegExp {
  let re = "";
  for (let i = 0; i < pattern.length; i++) {
    const ch = pattern[i];
    if (ch === "*") {
      if (i + 1 < pattern.length && pattern[i + 1] === "*") {
        re += ".*";
        i++;
        if (i + 1 < pattern.length && pattern[i + 1] === "/") {
          re += "/?";
          i++;
        }
      } else {
        re += "[^/]*";
      }
    } else if (ch === "?") {
      re += "[^/]";
    } else if (ch === "[") {
      re += "[";
    } else if (ch === "]") {
      re += "]";
    } else if (".+^${}()|\\".includes(ch)) {
      re += "\\" + ch;
    } else {
      re += ch;
    }
  }
  return new RegExp("^" + re + "$");
}
