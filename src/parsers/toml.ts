import { parse as parseToml, stringify as stringifyToml } from "@std/toml";

export const TOML: {
  parse(text: string): Record<string, unknown>;
  stringify(obj: unknown): string;
} = {
  parse(text: string): Record<string, unknown> {
    return parseToml(text) as Record<string, unknown>;
  },
  stringify(obj: unknown): string {
    return stringifyToml(obj as Record<string, unknown>);
  },
};
