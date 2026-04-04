import { expandGlob } from "@std/fs";
import * as path from "@std/path";

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

    for await (
      const entry of expandGlob(this.#pattern, {
        root,
        includeDirs: opts?.onlyFiles === true ? false : true,
      })
    ) {
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

  match(inputPath: string): boolean {
    const regex = globToRegex(this.#pattern);
    return regex.test(inputPath);
  }
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
