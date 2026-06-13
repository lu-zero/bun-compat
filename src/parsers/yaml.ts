import { parse as parseYaml, stringify as stringifyYaml } from "@std/yaml";

export const YAML: {
  parse(text: string): unknown;
  stringify(obj: unknown, replacer?: unknown | null, indent?: number): string;
} = {
  parse(text: string): any {
    return parseYaml(text);
  },
  stringify(obj: any, replacer?: any, indent?: any): string {
    if (typeof indent === "number") {
      return stringifyYaml(obj, { indent });
    }
    return stringifyYaml(obj, replacer);
  },
};
