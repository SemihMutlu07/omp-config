import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { ExtensionAPI } from "@oh-my-pi/pi-coding-agent";

/**
 * Durable turn close, with a gate on who owns the next step.
 *
 * The rule in AGENTS.md makes every work turn end with three labeled lines. This
 * extension turns those lines into a record that survives the session: the newest
 * entry is written into the top of today's handoff file, which Kasa context already
 * injects at the next session start. If a work turn ends without the block, one
 * hidden continuation turn asks the agent to read its own answer and close it.
 *
 * The `Sırada` line decides who acts next. Measured over 60 days, 88% of those lines
 * handed the step back to the user and only 5% needed a human. So a line that names
 * no owner is refused once: the agent must run the step, ask through the `ask` form
 * with a preselected default, or record that the step is finished.
 */
const BEGIN = "<!-- kasa-handoff:auto:begin -->";
const END = "<!-- kasa-handoff:auto:end -->";
const ENTRY_CLIP = 240;
const INTENT_CLIP = 160;
const INTENT_KEEP = 2;
const BLOCK_BUDGET = 1000;
// Per-line byte caps: newest closing + one intent always fit the budget, even in 2-byte Turkish text.
const ENTRY_BYTES = 450;
const INTENT_BYTES = 360;
const NUDGE =
	"Kapanış bloğu eksik. Cevabını bir kez oku; en sona tam olarak şu üç satırı ekle: " +
	"`Yaptım: …`, `Kanıt: …`, `Sırada: …`. Doğrulamadığın işe bitmiş deme, yeni iş açma.";
const GATE =
	"Sırada satırı sıradaki işi kullanıcıya bırakıyor. Cevabı bir kez düzelt: " +
	"(1) kendi koşabileceğin adımı şimdi koş; (2) gerçek bir karar gerekiyorsa `ask` aracıyla form aç ve varsayılanı işaretle; " +
	"(3) Sırada satırını şu biçimlerden birine getir: `yok`, `varsayılan: …`, `Sen: …` (yalnız cihaz veya kimlik işi). " +
	"Yeni iş açma, doğrulamadığın işe bitmiş deme.";

// A next step is allowed only when it names an owner: finished, the human's device or
// identity, a decision with a default, or the agent itself. Everything else is a hand-back.
const DONE_NEXT = /^(yok|bitti|tamam|tamamland[ıi])[.!]?$/i;
const HUMAN_ONLY =
	/(telefon|tablet|tailscale|şifre|sifre|parola|token|oauth|reauth|2fa|iki faktör|kumanda|fiziksel|giri[şs] yap|oturum aç|kart bilg|hesap onay)/i;
const HAS_DEFAULT = /varsay[ıi]lan\s*[:\-]/i;
const AGENT_OWNS = /^(ben|ajan|sonraki turda|bu turda)\b/i;

export type ClosingBlock = { done: string; proof: string; next: string };
export type NextOwner = "none" | "human" | "default" | "agent" | "open";

/** Who owns the step named in `Sırada`. `open` means nobody: the turn hands work back. */
export function classifyNext(next: string): { ok: boolean; owner: NextOwner } {
	const line = next.replace(/\s+/g, " ").trim();
	if (!line || DONE_NEXT.test(line)) return { ok: true, owner: "none" };
	if (HUMAN_ONLY.test(line) && !/\?\s*$/.test(line)) return { ok: true, owner: "human" };
	if (HAS_DEFAULT.test(line)) return { ok: true, owner: "default" };
	if (AGENT_OWNS.test(line)) return { ok: true, owner: "agent" };
	return { ok: false, owner: "open" };
}

function textOf(content: unknown): string {
	if (typeof content === "string") return content;
	if (!Array.isArray(content)) return "";
	const parts: string[] = [];
	for (const part of content) {
		if (!part || typeof part !== "object") continue;
		const value = part as { type?: unknown; text?: unknown };
		if (value.type === "text" && typeof value.text === "string") parts.push(value.text);
	}
	return parts.join("\n");
}

/** Assistant text only; tool results and user rows are ignored. */
export function assistantText(message: unknown): string {
	if (!message || typeof message !== "object") return "";
	const row = message as { role?: unknown; content?: unknown };
	return row.role === "assistant" ? textOf(row.content) : "";
}

/**
 * Reads the closing block from the last assistant text. Labels must start a line;
 * a leading bullet or bold marker is tolerated. The last complete block wins.
 */
export function parseClosingBlock(text: string): ClosingBlock | null {
	const labels: Array<[string, keyof ClosingBlock]> = [
		["Yaptım:", "done"],
		["Kanıt:", "proof"],
		["Sırada:", "next"],
	];
	const found: Partial<ClosingBlock> = {};
	for (const raw of text.split(/\r?\n/)) {
		const line = raw.trim().replace(/^[-*]\s+/, "").replace(/\*\*/g, "");
		for (const [label, key] of labels) {
			if (line.startsWith(label)) {
				found[key] = line.slice(label.length).replace(/\s+/g, " ").trim().slice(0, ENTRY_CLIP);
			}
		}
	}
	if (!found.done || !found.proof || !found.next) return null;
	return { done: found.done, proof: found.proof, next: found.next };
}

function clock(now: Date): string {
	return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

/** Cuts a line to a UTF-8 byte cap on a character boundary, so Turkish text cannot blow the budget. */
export function clampBytes(line: string, max: number): string {
	if (Buffer.byteLength(line, "utf8") <= max) return line;
	let out = "";
	for (const char of line) {
		if (Buffer.byteLength(out + char, "utf8") > max - 3) break;
		out += char;
	}
	return `${out}…`;
}

export function formatEntry(block: ClosingBlock, now: Date, agent: string): string {
	const line = `- ${clock(now)} [${agent}] Yaptım: ${block.done} | Kanıt: ${block.proof} | Sırada: ${block.next}`;
	return clampBytes(line, ENTRY_BYTES);
}

/** The user's first prompt of a session, one line, clipped. */
export function formatIntent(text: string, now: Date, agent: string): string {
	const flat = text.replace(/\s+/g, " ").trim();
	const clipped = flat.length > INTENT_CLIP ? `${flat.slice(0, INTENT_CLIP)}…` : flat;
	return clampBytes(`- ${clock(now)} [${agent}] Niyet: "${clipped}"`, INTENT_BYTES);
}

/** Newest first. The newest line never drops; old closings drop before intents. */
function fit(lines: string[]): string[] {
	const isIntent = (line: string) => line.includes("] Niyet: ");
	let intents = 0;
	const kept = lines.filter((line) => !isIntent(line) || ++intents <= INTENT_KEEP);
	const size = () => Buffer.byteLength(kept.join("\n"), "utf8");
	while (kept.length > 1 && size() > BLOCK_BUDGET) {
		let drop = kept.length - 1;
		for (let i = kept.length - 1; i > 0; i--) {
			if (!isIntent(kept[i])) {
				drop = i;
				break;
			}
		}
		kept.splice(drop, 1);
	}
	return kept;
}

/**
 * Puts the entry at the top of the marked block and keeps the earlier lines within a
 * byte budget. The block lives after the frontmatter so the fixed-size Kasa session-start
 * excerpt can see it. An entry equal to the newest line is left alone.
 */
export function applyEntry(fileText: string, entry: string): string {
	const blockRe = /<!-- kasa-handoff:auto:begin -->[\s\S]*?<!-- kasa-handoff:auto:end -->/;
	const existing = blockRe.exec(fileText);
	const earlier = existing
		? existing[0].split("\n").filter((line) => line.startsWith("- "))
		: [];
	if (earlier[0] === entry) return fileText;
	const fresh = `${BEGIN}\n${fit([entry, ...earlier]).join("\n")}\n${END}`;
	if (existing) return fileText.replace(blockRe, () => fresh);
	const frontmatter = /^---\n[\s\S]*?\n---\n/.exec(fileText);
	if (frontmatter) {
		return `${fileText.slice(0, frontmatter[0].length)}\n${fresh}\n\n${fileText.slice(frontmatter[0].length).replace(/^\n+/, "")}`;
	}
	return fileText.length === 0 ? `${fresh}\n` : `${fresh}\n\n${fileText}`;
}

function seed(now: Date): string {
	const month = String(now.getMonth() + 1).padStart(2, "0");
	const day = String(now.getDate()).padStart(2, "0");
	const date = `${now.getFullYear()}-${month}-${day}`;
	return `---\ntitle: Devir — ${date}\ndate: ${date}\nstatus: handoff\nepistemic: measured\ntags: [handoff, omp]\n---\n`;
}

function closingPath(root: string, now: Date): string {
	const month = String(now.getMonth() + 1).padStart(2, "0");
	const day = String(now.getDate()).padStart(2, "0");
	return join(root, "handoff", `${now.getFullYear()}-${month}-${day}.md`);
}

/**
 * Writes one line into today's handoff. Returns false when the vault or its
 * handoff directory is absent, so a stray session never creates a fake vault.
 */
export function writeLine(root: string, line: string, now: Date): boolean {
	const handoffDir = join(root, "handoff");
	if (!existsSync(handoffDir)) return false;
	const release = acquireLock(join(handoffDir, ".kasa-handoff.lock"));
	try {
		const path = closingPath(root, now);
		const before = existsSync(path) ? readFileSync(path, "utf8") : seed(now);
		const after = applyEntry(before, line);
		if (after === before) return false;
		const temp = `${path}.kasa-handoff-${process.pid}.tmp`;
		writeFileSync(temp, after);
		renameSync(temp, path);
		return true;
	} finally {
		release();
	}
}

/**
 * Cross-process lock shared with scripts/claude-kasa-handoff.py. mkdir is atomic
 * on every platform, so two sessions closing a turn together cannot both read the
 * same base file. A lock older than 10 s is stale and gets broken.
 */
function acquireLock(lockDir: string): () => void {
	const deadline = Date.now() + 3000;
	for (;;) {
		try {
			mkdirSync(lockDir);
			return () => rmSync(lockDir, { recursive: true, force: true });
		} catch {
			if (Date.now() - statSync(lockDir, { throwIfNoEntry: false })?.mtimeMs! > 10_000) {
				rmSync(lockDir, { recursive: true, force: true });
			} else if (Date.now() > deadline) {
				return () => {};
			}
			Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 25);
		}
	}
}

export function writeEntry(root: string, block: ClosingBlock, now: Date, agent: string): boolean {
	return writeLine(root, formatEntry(block, now, agent), now);
}

export default function (pi: ExtensionAPI) {
	let lastTurnHadTools = false;
	let intentSaved = false;
	// One repair per run, independent of host stop-hook bookkeeping, so a gate can never loop.
	let repaired = false;

	pi.on("session_start", () => {
		intentSaved = false;
		repaired = false;
	});

	pi.on("agent_start", () => {
		repaired = false;
	});

	// The first typed prompt of a session is the user's intent. It is saved once, so the
	// next session sees what was asked, not only how the last turn ended.
	pi.on("input", (event, ctx) => {
		if (intentSaved || (ctx?.agent?.kind && ctx.agent.kind !== "main")) return;
		if (event.source !== "interactive" && event.source !== "rpc") return;
		const text = typeof event.text === "string" ? event.text.trim() : "";
		if (!text || text.startsWith("/") || text.startsWith("!")) return;
		intentSaved = true;
		try {
			const root = process.env.KASA_ROOT ?? join(homedir(), "Kasa");
			writeLine(root, formatIntent(text, new Date(), "omp"), new Date());
		} catch (error) {
			pi.logger?.warn?.(`kasa-handoff: ${String(error)}`);
		}
	});

	pi.on("turn_end", (event, ctx) => {
		if (ctx.agent.kind !== "main") return;
		lastTurnHadTools = event.toolResults.length > 0;
	});

	pi.on("session_stop", (event, ctx) => {
		if (ctx.agent.kind !== "main" || !event.last_assistant_message) return;
		const block = parseClosingBlock(assistantText(event.last_assistant_message));
		if (!block) {
			// A changed turn must close with evidence, even when the gate never ran.
			if (event.stop_hook_active || repaired || !lastTurnHadTools) return;
			repaired = true;
			return { continue: true, additionalContext: NUDGE };
		}
		try {
			const root = process.env.KASA_ROOT ?? join(homedir(), "Kasa");
			writeEntry(root, block, new Date(), "omp");
		} catch (error) {
			pi.logger?.warn?.(`kasa-handoff: ${String(error)}`);
		}
		// A next step must name its owner on every turn, not only tool turns.
		if (event.stop_hook_active || repaired) return;
		if (classifyNext(block.next).ok) return;
		repaired = true;
		return { decision: "block" as const, reason: GATE };
	});
}
