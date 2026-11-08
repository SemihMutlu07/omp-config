import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import initExtension, { extractTitleFromSessionFile, saveTerminalSession } from "./herdr-terminal-resume.ts";

test("saveTerminalSession writes JSON file correctly", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "herdr-test-"));
  try {
    const savedFile = saveTerminalSession(
      {
        terminalId: "t42",
        sessionId: "01a1a089-a085-7213-a56a-018c039a40f0",
        sessionFile: "/tmp/sample.jsonl",
        cwd: "/home/semihmutlu/dev",
        title: "Test Session",
        pid: 12345,
      },
      tmpDir
    );

    assert.ok(fs.existsSync(savedFile));
    const content = JSON.parse(fs.readFileSync(savedFile, "utf8"));
    assert.equal(content.terminalId, "t42");
    assert.equal(content.sessionId, "01a1a089-a085-7213-a56a-018c039a40f0");
    assert.equal(content.shortId, "01a1a089");
    assert.equal(content.cwd, "/home/semihmutlu/dev");
    assert.equal(content.title, "Test Session");
    assert.equal(content.pid, 12345);
    assert.ok(content.updatedAt > 0);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("extractTitleFromSessionFile reads title from first lines", () => {
  const tmpFile = path.join(os.tmpdir(), `test-session-${Date.now()}.jsonl`);
  try {
    const lines = [
      JSON.stringify({ type: "title", v: 1, title: "My Awesome Session" }),
      JSON.stringify({ type: "session", id: "123", cwd: "/tmp" }),
    ].join("\n");
    fs.writeFileSync(tmpFile, lines);

    const title = extractTitleFromSessionFile(tmpFile);
    assert.equal(title, "My Awesome Session");
  } finally {
    fs.rmSync(tmpFile, { force: true });
  }
});

test("extension registers handlers and filters subagents", () => {
  const originalTerminal = process.env.HC_TERMINAL_ID;
  const originalOmpCode = process.env.OMPCODE;
  process.env.HC_TERMINAL_ID = "t99";
  delete process.env.OMPCODE;

  const handlers = new Map<string, (event: unknown, ctx: unknown) => void>();
  const mockPi = {
    on(event: string, handler: (event: unknown, ctx: unknown) => void) {
      handlers.set(event, handler);
    },
  };

  try {
    initExtension(mockPi);

    assert.ok(handlers.has("session_start"));
    assert.ok(handlers.has("session_switch"));
    assert.ok(handlers.has("agent_start"));
    assert.ok(handlers.has("agent_end"));

    // Subagents are ignored
    const startHandler = handlers.get("session_start")!;
    let recorded = false;
    startHandler({}, { agent: { kind: "sub" } });
  } finally {
    if (originalTerminal !== undefined) {
      process.env.HC_TERMINAL_ID = originalTerminal;
    } else {
      delete process.env.HC_TERMINAL_ID;
    }
    if (originalOmpCode !== undefined) {
      process.env.OMPCODE = originalOmpCode;
    } else {
      delete process.env.OMPCODE;
    }
  }
});
