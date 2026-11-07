import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { ExtensionAPI } from "@oh-my-pi/pi-coding-agent";

/**
 * Durable turn close.
 *
 * The rule in AGENTS.md makes every work turn end with three labeled lines. This
 * extension turns those lines into a record that survives the session: the newest
 * entry is written into the top of today's handoff file, which Kasa context already
 * injects at the next session start. If a work turn ends without the block, one
 * hidden continuation turn asks the agent to read its own answer and close it.
 */
const BEGIN = "<!-- kasa-handoff:auto:begin -->";
const END = "<!-- kasa-handoff:auto:end -->";
const ENTRY_CLIP = 240;
const NUDGE =
	"Kapanış bloğu eksik. Cevabını bir kez oku; en sona tam olarak şu üç satırı ekle: " +
	"`Yaptım: …`, `Kanıt: …`, `Sırada: …`. Doğrulamadığın işe bitmiş deme, yeni iş açma.";

export type ClosingBlock = { done: string; proof: string; next: string };

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

export function formatEntry(block: ClosingBlock, now: Date, agent: string): string {
	const time = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
	return `- ${time} [${agent}] Yaptım: ${block.done} | Kanıt: ${block.proof} | Sırada: ${block.next}`;
}

/**
 * Puts the entry in the marked block. The block lives after the frontmatter so the
 * fixed-size Kasa session-start excerpt can see it. An existing block is replaced;
 * an unchanged entry is left alone.
 */
export function applyEntry(fileText: string, entry: string): string {
	const blockRe = /<!-- kasa-handoff:auto:begin -->[\s\S]*?<!-- kasa-handoff:auto:end -->/;
	const fresh = `${BEGIN}\n${entry}\n${END}`;
	const existing = blockRe.exec(fileText);
	if (existing) {
		return existing[0] === fresh ? fileText : fileText.replace(blockRe, fresh);
	}
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
 * Writes one entry into today's handoff. Returns false when the vault or its
 * handoff directory is absent, so a stray session never creates a fake vault.
 */
export function writeEntry(root: string, block: ClosingBlock, now: Date, agent: string): boolean {
	const handoffDir = join(root, "handoff");
	if (!existsSync(handoffDir)) return false;
	const path = closingPath(root, now);
	const before = existsSync(path) ? readFileSync(path, "utf8") : seed(now);
	const after = applyEntry(before, formatEntry(block, now, agent));
	if (after === before) return false;
	mkdirSync(handoffDir, { recursive: true });
	const temp = `${path}.kasa-handoff-${process.pid}.tmp`;
	writeFileSync(temp, after);
	renameSync(temp, path);
	return true;
}

export default function (pi: ExtensionAPI) {
	let lastTurnHadTools = false;

	pi.on("turn_end", (event, ctx) => {
		if (ctx.agent.kind !== "main") return;
		lastTurnHadTools = event.toolResults.length > 0;
	});

	pi.on("session_stop", (event, ctx) => {
		if (ctx.agent.kind !== "main" || !event.last_assistant_message) return;
		const block = parseClosingBlock(assistantText(event.last_assistant_message));
		if (block) {
			try {
				const root = process.env.KASA_ROOT ?? join(homedir(), "Kasa");
				writeEntry(root, block, new Date(), "omp");
			} catch (error) {
				pi.logger?.warn?.(`kasa-handoff: ${String(error)}`);
			}
			return;
		}
		// One repair turn per settle chain; a changed turn must close with evidence.
		if (event.stop_hook_active || !lastTurnHadTools) return;
		return { continue: true, additionalContext: NUDGE };
	});
}
