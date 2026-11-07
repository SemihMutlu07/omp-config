import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import extension, {
	applyEntry,
	assistantText,
	formatEntry,
	parseClosingBlock,
	writeEntry,
} from "./index.js";

const roots = mkdtempSync(join(tmpdir(), "kasa-handoff-"));
afterAll(() => rmSync(roots, { recursive: true, force: true }));

function vault(): string {
	const root = mkdtempSync(join(roots, "vault-"));
	mkdirSync(join(root, "handoff"));
	return root;
}

type Context = {
	agent: { kind: "main" | "sub"; id: string; name: string; depth: number };
	cwd: string;
};
type Handler = (event: unknown, ctx: Context) => unknown;

function handlers() {
	const registered = new Map<string, Handler>();
	const api = {
		on(event: string, callback: Handler) {
			registered.set(event, callback);
		},
	} as unknown as Parameters<typeof extension>[0];
	extension(api);
	const main = { agent: { kind: "main", id: "main", name: "main", depth: 0 }, cwd: roots };
	const sub = { agent: { kind: "sub", id: "task", name: "task", depth: 1 }, cwd: roots };
	return { registered, main, sub };
}

const blockText = [
	"İş bitti.",
	"Yaptım: kasa-handoff eklentisi yazıldı",
	"Kanıt: bun test exit 0",
	"Sırada: yok",
].join("\n");

function message(text: string) {
	return { role: "assistant", content: [{ type: "text", text }] };
}

describe("closing block parsing", () => {
	test("reads labeled lines with bullets and bold", () => {
		const text = "- **Yaptım:** dosya yazıldı\n- **Kanıt:** test geçti\n- **Sırada:** yok";
		expect(parseClosingBlock(text)).toEqual({
			done: "dosya yazıldı",
			proof: "test geçti",
			next: "yok",
		});
	});

	test("last complete block wins", () => {
		const text = "Yaptım: eski\nKanıt: eski\nSırada: eski\n\nYaptım: yeni\nKanıt: yeni\nSırada: yok";
		expect(parseClosingBlock(text)?.done).toBe("yeni");
	});

	test("an incomplete block is not a closing block", () => {
		expect(parseClosingBlock("Yaptım: yarım\nKanıt: var")).toBeNull();
		expect(parseClosingBlock("Yaptım: \nKanıt: var\nSırada: yok")).toBeNull();
	});

	test("assistant text ignores non-assistant rows", () => {
		expect(assistantText({ role: "user", content: "Yaptım: x" })).toBe("");
		expect(assistantText(message(blockText))).toContain("Yaptım:");
	});
});

describe("handoff write", () => {
	test("inserts the block after the frontmatter", () => {
		const file = "---\ntitle: Devir\ndate: 2026-11-07\n---\n\n# Devir\n\nGövde.\n";
		const next = applyEntry(file, "- 20:34 [omp] Yaptım: a | Kanıt: b | Sırada: c");
		expect(next).toContain("date: 2026-11-07\n---\n\n<!-- kasa-handoff:auto:begin -->");
		expect(next).toContain("# Devir\n\nGövde.");
	});

	test("replaces the block and leaves the rest intact", () => {
		const first = applyEntry("---\ntitle: D\n---\n\n# D\n", "- 20:00 [omp] Yaptım: a | Kanıt: b | Sırada: c");
		const second = applyEntry(first, "- 20:05 [omp] Yaptım: d | Kanıt: e | Sırada: yok");
		expect(second).not.toContain("Yaptım: a");
		expect(second).toContain("Yaptım: d");
		expect(second).toContain("# D");
	});

	test("an unchanged entry is a no-op", () => {
		const entry = formatEntry({ done: "a", proof: "b", next: "c" }, new Date(2026, 10, 7, 8, 3), "omp");
		const once = applyEntry("# D\n", entry);
		expect(applyEntry(once, entry)).toBe(once);
	});

	test("writes today's file under the vault and refuses a missing vault", () => {
		const root = vault();
		const now = new Date(2026, 10, 7, 20, 34);
		expect(writeEntry(root, { done: "a", proof: "b", next: "yok" }, now, "omp")).toBe(true);
		const path = join(root, "handoff", "2026-11-07.md");
		const text = readFileSync(path, "utf8");
		expect(text.startsWith("---\ntitle: Devir — 2026-11-07\n")).toBe(true);
		expect(text).toContain("[omp] Yaptım: a | Kanıt: b | Sırada: yok");
		expect(writeEntry(join(root, "missing"), { done: "a", proof: "b", next: "c" }, now, "omp")).toBe(false);
	});
});

describe("session stop handler", () => {
	test("writes a complete block for the main agent", () => {
		const { registered, main } = handlers();
		const root = vault();
		process.env.KASA_ROOT = root;
		try {
			registered.get("session_stop")?.({ last_assistant_message: message(blockText), stop_hook_active: false }, main);
			const files = readFileSync(join(root, "handoff", `${new Date().toISOString().slice(0, 10)}.md`), "utf8");
			expect(files).toContain("Yaptım: kasa-handoff eklentisi yazıldı");
		} finally {
			delete process.env.KASA_ROOT;
		}
	});

	test("a tool turn without the block asks for one repair turn", () => {
		const { registered, main } = handlers();
		registered.get("turn_end")?.({ toolResults: [{}] }, main);
		const result = registered.get("session_stop")?.(
			{ last_assistant_message: message("Sadece düz yazı."), stop_hook_active: false },
			main,
		) as { continue?: boolean; additionalContext?: string } | undefined;
		expect(result?.continue).toBe(true);
		expect(result?.additionalContext).toContain("Kapanış bloğu eksik");
	});

	test("no repair turn when a stop hook is already active", () => {
		const { registered, main } = handlers();
		registered.get("turn_end")?.({ toolResults: [{}] }, main);
		expect(
			registered.get("session_stop")?.({ last_assistant_message: message("Düz yazı."), stop_hook_active: true }, main),
		).toBeUndefined();
	});

	test("subagents never write or continue", () => {
		const { registered, sub } = handlers();
		registered.get("turn_end")?.({ toolResults: [{}] }, sub);
		expect(registered.get("session_stop")?.({ last_assistant_message: message(blockText), stop_hook_active: false }, sub))
			.toBeUndefined();
	});
});
