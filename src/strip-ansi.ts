// deno-lint-ignore no-control-regex
const ANSI_RE = /\x1b\[[0-9;]*[a-zA-Z]|\x1b\][^\x07]*\x07|\x1b\[[0-9;]*m/g;

export function stripANSI(text: string): string {
  return text.replace(ANSI_RE, "");
}
