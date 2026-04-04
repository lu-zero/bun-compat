import { parse as parseJsonc } from "@std/jsonc";

export const JSONC: {
  parse(text: string): unknown;
} = {
  parse(text: string): any {
    return parseJsonc(text);
  },
};
