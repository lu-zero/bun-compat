function preprocess(text: string): string {
  let result = "";
  let i = 0;
  let inStr: boolean = false;
  let strChar = "";

  while (i < text.length) {
    const ch = text[i];

    if (inStr) {
      result += ch;
      if (ch === "\\") {
        i++;
        if (i < text.length) result += text[i];
      } else if (ch === strChar) {
        inStr = false;
      }
      i++;
      continue;
    }

    if (ch === '"' || ch === "'" || ch === "`") {
      inStr = true;
      strChar = ch;
      result += '"';
      i++;
      continue;
    }

    if (ch === "/" && i + 1 < text.length && text[i + 1] === "/") {
      while (i < text.length && text[i] !== "\n") i++;
      continue;
    }

    if (ch === "/" && i + 1 < text.length && text[i + 1] === "*") {
      i += 2;
      while (i + 1 < text.length && !(text[i] === "*" && text[i + 1] === "/")) {
        i++;
      }
      i += 2;
      continue;
    }

    result += ch;
    i++;
  }

  let cleaned = result
    .replace(/,\s*([}\]])/g, "$1")
    .replace(/([{,]\s*)([a-zA-Z_$][a-zA-Z0-9_$]*)(\s*):/g, '$1"$2":');

  return cleaned;
}

export const JSON5: {
  parse(text: string): unknown;
  stringify(obj: unknown, replacer?: unknown, space?: unknown): string;
} = {
  parse(text: string): any {
    return JSON.parse(preprocess(text));
  },
  stringify(obj: any, replacer?: any, space?: any): string {
    return JSON.stringify(obj, replacer, space);
  },
};
