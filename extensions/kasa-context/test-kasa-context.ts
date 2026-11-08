import { afterAll, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import extension from "./index.js";

type Message = { role: "user"; attribution?: "agent"; content: string; timestamp: number };
type Context = {
  agent: { kind: "main" | "sub"; id: string; name: string; depth: number };
  cwd: string;
};
type Handler = (event: { messages: Message[] }, ctx: Context) => Promise<unknown>;

const unavailableRoot = mkdtempSync(join(tmpdir(), "kasa-missing-helper-"));
afterAll(() => rmSync(unavailableRoot, { recursive: true, force: true }));

function contextHandler(): Handler {
  let handler: Handler | undefined;
  // The in-process stub implements only registration methods used by this factory.
  const api = {
    on(event: string, callback: Handler) {
      if (event === "context") handler = callback;
    },
    registerCommand() {},
  } as unknown as Parameters<typeof extension>[0];
  extension(api);
  if (!handler) throw new Error("Missing context handler");
  return handler;
}

async function withUnavailableHelper(action: () => Promise<void>) {
  const original = process.env.KASA_ROOT;
  process.env.KASA_ROOT = unavailableRoot;
  try {
    await action();
  } finally {
    if (original === undefined) delete process.env.KASA_ROOT;
    else process.env.KASA_ROOT = original;
  }
}

const message: Message = { role: "user", content: "Kasa retrieval acceptance", timestamp: 1 };

test("real advisor identity receives no automatic vault data or failure companion", async () => {
  await withUnavailableHelper(async () => {
    const result = await contextHandler()({ messages: [message] }, {
      agent: { kind: "sub", id: "advisor", name: "advisor", depth: 0 },
      cwd: unavailableRoot,
    });
    expect(result).toBeUndefined();
  });
});

test("agent-attributed task assignment reports helper failure before work without UI or stale excerpts", async () => {
  await withUnavailableHelper(async () => {
    const delegated: Message = { ...message, attribution: "agent" };
    const event = { messages: [delegated] };
    const result = await contextHandler()(event, {
      agent: { kind: "sub", id: "Worker", name: "task", depth: 1 },
      cwd: unavailableRoot,
    });
    expect(result).toEqual({ messages: [
      {
        role: "user",
        attribution: "agent",
        content: expect.stringContaining("No Kasa excerpts were loaded for this call"),
        timestamp: expect.any(Number),
      },
      delegated,
    ] });
    expect(event.messages).toEqual([delegated]);
  });
});

test("main session does not use an agent notification as a lookup topic", async () => {
  await withUnavailableHelper(async () => {
    const result = await contextHandler()({ messages: [{ ...message, attribution: "agent" }] }, {
      agent: { kind: "main", id: "Main", name: "main", depth: 0 },
      cwd: unavailableRoot,
    });
    expect(result).toBeUndefined();
  });
});

test("a no-match lookup injects nothing instead of an empty user message", async () => {
  const root = mkdtempSync(join(tmpdir(), "kasa-nomatch-helper-"));
  mkdirSync(join(root, "_vault/scripts"), { recursive: true });
  writeFileSync(join(root, "_vault/scripts/kasa-context.py"),
    "import json,sys\nsys.stdin.read()\n"
    + "print(json.dumps({'status':'no_match','content':'','paths':[],'bytes':0}))\n");
  const original = process.env.KASA_ROOT;
  process.env.KASA_ROOT = root;
  try {
    const result = await contextHandler()({ messages: [message] }, {
      agent: { kind: "sub", id: "A", name: "task", depth: 1 },
      cwd: root,
    });
    expect(result).toBeUndefined();
  } finally {
    if (original === undefined) delete process.env.KASA_ROOT;
    else process.env.KASA_ROOT = original;
    rmSync(root, { recursive: true, force: true });
  }
});
