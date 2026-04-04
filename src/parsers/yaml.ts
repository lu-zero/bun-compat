import { parse as parseYaml, stringify as stringifyYaml } from "@std/yaml";

export const YAML: {
  parse(text: string): unknown;
  stringify(obj: unknown, opts?: unknown): string;
} = {
  parse(text: string): any {
    return parseYaml(text);
  },
  stringify(obj: any, opts?: any): string {
    return stringifyYaml(obj, opts);
  },
};
