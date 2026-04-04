import { assertEquals } from "@std/assert";
import "./test_helper.ts";

Deno.test("spawn - captures stdout", async () => {
  const proc = Bun.spawn(["echo", "hello from spawn"], { stdout: "pipe" });
  const exitCode = await proc.exited;
  assertEquals(exitCode, 0);
  const chunks: Uint8Array[] = [];
  const reader = proc.stdout.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  reader.releaseLock();
  proc.stdout.cancel();
  const total = chunks.reduce((s, c) => s + c.length, 0);
  const buf = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    buf.set(c, offset);
    offset += c.length;
  }
  await proc.exited;
  assertEquals(new TextDecoder().decode(buf).trim(), "hello from spawn");
});

Deno.test("spawn - exit code reflects failure", async () => {
  const proc = Bun.spawn(["sh", "-c", "exit 42"], {
    stdout: "ignore",
    stderr: "ignore",
  });
  const exitCode = await proc.exited;
  assertEquals(exitCode, 42);
});

Deno.test("spawnSync - captures output", () => {
  const result = Bun.spawnSync(["echo", "sync hello"]);
  assertEquals(result.exitCode, 0);
  assertEquals(new TextDecoder().decode(result.stdout).trim(), "sync hello");
});
