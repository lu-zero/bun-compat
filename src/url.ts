export function fileURLToPath(url: string | URL): string {
  const u = typeof url === "string" ? new URL(url) : url;
  if (u.protocol !== "file:") {
    throw new TypeError(`Not a file URL: ${u.href}`);
  }
  let p = decodeURIComponent(u.pathname);
  if (typeof Deno !== "undefined" && Deno.build.os === "windows") {
    p = p.replace(/^\/([A-Za-z]:)/, "$1").replace(/\//g, "\\");
  }
  return p;
}

export function pathToFileURL(filepath: string): URL {
  if (typeof Deno !== "undefined" && Deno.build.os === "windows") {
    filepath = filepath.replace(/\\/g, "/");
    if (!filepath.startsWith("/")) {
      filepath = "/" + filepath;
    }
  }
  return new URL(`file://${filepath}`);
}
