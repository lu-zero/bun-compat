import { assertEquals } from "@std/assert";
import "./test_helper.ts";

Deno.test("TOML - parse", () => {
  const result = Bun.TOML.parse('[server]\nhost = "localhost"\nport = 3000\n');
  assertEquals(result.server?.host, "localhost");
  assertEquals(result.server?.port, 3000);
});

Deno.test("YAML - parse and stringify", () => {
  const text = "name: test\nitems:\n  - a\n  - b\n";
  const parsed = Bun.YAML.parse(text);
  assertEquals(parsed.name, "test");
  assertEquals(parsed.items, ["a", "b"]);
  const str = Bun.YAML.stringify({ x: 1 });
  assertEquals(str.includes("x: 1"), true);
});

Deno.test("JSONC - parse with comments", () => {
  const text = '{\n  // comment\n  "key": "value"\n}';
  const parsed = Bun.JSONC.parse(text);
  assertEquals(parsed.key, "value");
});

Deno.test("JSON5 - parse relaxed syntax", () => {
  const text = "{ a: 1, b: 2, }";
  const parsed = Bun.JSON5.parse(text);
  assertEquals(parsed.a, 1);
  assertEquals(parsed.b, 2);
});

Deno.test("JSONL - parse", () => {
  const text = '{"a":1}\n{"b":2}\n';
  const parsed = Bun.JSONL.parse(text);
  assertEquals(parsed.length, 2);
  assertEquals(parsed[0].a, 1);
  assertEquals(parsed[1].b, 2);
});

Deno.test("JSONL - parseChunk", () => {
  const text = '{"a":1}\n{"b":2}\n{"c":incom';
  const result = Bun.JSONL.parseChunk(text);
  assertEquals(result.values.length, 2);
  assertEquals(result.done, false);
  assertEquals(typeof result.error, "object");
});
