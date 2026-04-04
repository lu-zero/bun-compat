import * as path from "@std/path";

const IS_WIN = typeof Deno !== "undefined" && Deno.build.os === "windows";

function pathext(): string[] {
  const ext = Deno.env.get("PATHEXT") ?? ".COM;.EXE;.BAT;.CMD";
  return ext.split(";").map((e) => e.toUpperCase());
}

async function tryStat(p: string): Promise<boolean> {
  try {
    const s = await Deno.stat(p);
    return s.isFile;
  } catch {
    return false;
  }
}

async function resolveOne(
  name: string,
  dirs: string[],
): Promise<string | null> {
  for (const dir of dirs) {
    if (!IS_WIN) {
      const full = path.join(dir, name);
      try {
        const s = await Deno.stat(full);
        if (s.isFile) return full;
      } catch {
        continue;
      }
    } else {
      for (const ext of pathext()) {
        const full = path.join(dir, name + ext.toLowerCase());
        try {
          const s = await Deno.stat(full);
          if (s.isFile) return full;
        } catch {
          continue;
        }
      }
    }
  }
  return null;
}

export function which(name: string): string | null {
  const p = Deno.env.get("PATH") ?? "";
  const sep = IS_WIN ? ";" : ":";
  const dirs = p.split(sep).filter(Boolean);

  let pending: Promise<string | null> | null = null;
  for (const dir of dirs) {
    if (IS_WIN) {
      for (const ext of pathext()) {
        const full = path.join(dir, name + ext.toLowerCase());
        try {
          const s = Deno.statSync(full);
          if (s.isFile) return full;
        } catch {
          continue;
        }
      }
    } else {
      const full = path.join(dir, name);
      try {
        const s = Deno.statSync(full);
        if (s.isFile) return full;
      } catch {
        continue;
      }
    }
  }

  void pending;
  return null;
}

export async function whichAsync(name: string): Promise<string | null> {
  const p = Deno.env.get("PATH") ?? "";
  const sep = IS_WIN ? ";" : ":";
  const dirs = p.split(sep).filter(Boolean);
  return resolveOne(name, dirs);
}
