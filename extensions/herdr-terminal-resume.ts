import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export function extractTitleFromSessionFile(filePath: string): string | undefined {
  if (!filePath || !fs.existsSync(filePath)) return undefined;
  try {
    const fd = fs.openSync(filePath, "r");
    const buf = Buffer.alloc(4096);
    const bytesRead = fs.readSync(fd, buf, 0, 4096, 0);
    fs.closeSync(fd);
    const content = buf.toString("utf8", 0, bytesRead);
    for (const line of content.split("\n")) {
      if (!line.trim()) continue;
      try {
        const parsed = JSON.parse(line);
        if (parsed.type === "title" && parsed.title) return String(parsed.title);
        if (parsed.type === "session" && parsed.title) return String(parsed.title);
      } catch {}
    }
  } catch {}
  return undefined;
}

function readBootId(): string | null {
  try {
    return fs.readFileSync("/proc/sys/kernel/random/boot_id", "utf8").trim() || null;
  } catch {
    return null;
  }
}

export function saveTerminalSession(
  data: {
    terminalId: string;
    sessionId: string;
    sessionFile?: string;
    cwd?: string;
    title?: string;
    pid: number;
  },
  baseDir?: string
): string {
  const stateDir = baseDir ?? path.join(os.homedir(), ".omp", "agent", "herdr-terminals");
  fs.mkdirSync(stateDir, { recursive: true });
  const targetFile = path.join(stateDir, `${data.terminalId}.json`);
  const shortId = data.sessionId.length >= 8 ? data.sessionId.slice(0, 8) : data.sessionId;
  const payload = {
    terminalId: data.terminalId,
    sessionId: data.sessionId,
    shortId,
    sessionFile: data.sessionFile || null,
    cwd: data.cwd || process.cwd(),
    title: data.title || null,
    pid: data.pid,
    bootId: readBootId(),
    updatedAt: Date.now(),
  };
  fs.writeFileSync(targetFile, JSON.stringify(payload, null, 2) + "\n", "utf8");
  return targetFile;
}

interface SessionContext {
  agent?: { kind?: string; name?: string };
  sessionManager?: {
    getSessionId?: () => string | undefined;
    getSessionFile?: () => string | undefined;
  };
  cwd?: string;
  sessionTitle?: string;
}

interface ExtensionAPI {
  on(event: string, handler: (event: unknown, ctx: SessionContext) => void): void;
}

export default function (pi: ExtensionAPI): void {
  const terminalId = process.env.HC_TERMINAL_ID;
  if (!terminalId) return;
  if (process.env.OMPCODE === "1") return;

  process.once("SIGTERM", () => {
    try {
      const dir = path.join(os.homedir(), ".omp", "agent", "herdr-terminals");
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, `${terminalId}.want-resume`), "1\n");
    } catch {}
    process.kill(process.pid, "SIGTERM");
  });

  function record(ctx: SessionContext): void {
    try {
      if (ctx?.agent?.kind && ctx.agent.kind !== "main") return;
      const sessionId = ctx?.sessionManager?.getSessionId?.();
      if (!sessionId || typeof sessionId !== "string") return;
      const sessionFile = ctx?.sessionManager?.getSessionFile?.();
      const cwd = ctx?.cwd || process.cwd();
      const title = (sessionFile ? extractTitleFromSessionFile(sessionFile) : undefined) || ctx?.sessionTitle;
      saveTerminalSession({
        terminalId,
        sessionId,
        sessionFile,
        cwd,
        title,
        pid: process.pid,
      });
    } catch {}
  }

  pi.on("session_start", (_event: unknown, ctx: SessionContext) => record(ctx));
  pi.on("session_switch", (_event: unknown, ctx: SessionContext) => record(ctx));
  pi.on("agent_start", (_event: unknown, ctx: SessionContext) => record(ctx));
  pi.on("agent_end", (_event: unknown, ctx: SessionContext) => record(ctx));
}
