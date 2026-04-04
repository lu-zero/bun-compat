const _envProxy = new Proxy({} as Record<string, string>, {
  get(_target, prop: string) {
    return Deno.env.get(prop) ?? "";
  },
  set(_target, prop: string, value: string) {
    Deno.env.set(prop, value);
    return true;
  },
  deleteProperty(_target, prop: string) {
    Deno.env.delete(prop);
    return true;
  },
  ownKeys() {
    return Reflect.ownKeys(Deno.env.toObject());
  },
  getOwnPropertyDescriptor(_target, prop: string) {
    const val = Deno.env.get(prop);
    if (val === undefined) return undefined;
    return { configurable: true, enumerable: true, value: val, writable: true };
  },
  has(_target, prop: string) {
    return Deno.env.get(prop) !== undefined;
  },
});

export const env: Record<string, string> = _envProxy;
export const argv: string[] = [...Deno.args];
