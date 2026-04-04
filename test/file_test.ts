import { assertEquals } from "@std/assert";
import "./test_helper.ts";
import * as path from "@std/path";

const tmp = () => Deno.makeTempDir({ prefix: "bun-compat-test-" });

Deno.test("file - text roundtrip", async () => {
  const dir = await tmp();
  const fp = path.join(dir, "test.txt");
  await Bun.write(fp, "hello world");
  const text = await Bun.file(fp).text();
  assertEquals(text, "hello world");
  await Deno.remove(dir, { recursive: true });
});

Deno.test("file - json roundtrip", async () => {
  const dir = await tmp();
  const fp = path.join(dir, "test.json");
  const data = { name: "bun-compat", version: 1 };
  await Bun.write(fp, JSON.stringify(data));
  const parsed = await Bun.file(fp).json();
  assertEquals(parsed, data);
  await Deno.remove(dir, { recursive: true });
});

Deno.test("file - exists", async () => {
  const dir = await tmp();
  const fp = path.join(dir, "exists.txt");
  assertEquals(await Bun.file(fp).exists(), false);
  await Bun.write(fp, "yes");
  assertEquals(await Bun.file(fp).exists(), true);
  await Deno.remove(dir, { recursive: true });
});

Deno.test("file - type returns mime", async () => {
  const dir = await tmp();
  const fp = path.join(dir, "test.json");
  await Bun.write(fp, "{}");
  const f = Bun.file(fp);
  assertEquals(f.type.startsWith("application/json"), true);
  await Deno.remove(dir, { recursive: true });
});

Deno.test("file - bytes roundtrip", async () => {
  const dir = await tmp();
  const fp = path.join(dir, "binary.bin");
  const data = new Uint8Array([0, 1, 2, 255]);
  await Bun.write(fp, data);
  const result = await Bun.file(fp).bytes();
  assertEquals(result, data);
  await Deno.remove(dir, { recursive: true });
});

Deno.test("write - creates parent directories", async () => {
  const dir = await tmp();
  const fp = path.join(dir, "a", "b", "c", "deep.txt");
  await Bun.write(fp, "nested");
  assertEquals(await Bun.file(fp).text(), "nested");
  await Deno.remove(dir, { recursive: true });
});
