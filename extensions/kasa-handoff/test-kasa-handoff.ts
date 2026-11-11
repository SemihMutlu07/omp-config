import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import extension, {
	applyEntry,
	assistantText,
	classifyNext,
	formatEntry,
	formatIntent,
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

	test("accumulates earlier lines and leaves the rest intact", () => {
		const first = applyEntry("---\ntitle: D\n---\n\n# D\n", "- 20:00 [omp] Yaptım: a | Kanıt: b | Sırada: c");
		const second = applyEntry(first, "- 20:05 [omp] Yaptım: d | Kanıt: e | Sırada: yok");
		expect(second).toContain("Yaptım: a");
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
		registered.get("turn_end")?.({ toolResults: [] }, main);
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

describe("next-step gate", () => {
	const withNext = (next: string) =>
		message(["İş bitti.", "Yaptım: x", "Kanıt: y", `Sırada: ${next}`].join("\n"));
	const park = (registered: Map<string, Handler>, main: Context) => {
		const root = vault();
		process.env.KASA_ROOT = root;
		registered.get("turn_end")?.({ toolResults: [{}] }, main);
		return root;
	};

	test("finished, human-only, defaulted and agent-owned steps pass", () => {
		expect(classifyNext("yok")).toEqual({ ok: true, owner: "none" });
		expect(classifyNext("bitti.")).toEqual({ ok: true, owner: "none" });
		expect(classifyNext("Semih OMP içinde `/mcp reauth notion` çalıştırır").owner).toBe("human");
		expect(classifyNext("Telefonda Tailscale'i aç").owner).toBe("human");
		expect(classifyNext("Cloudflare'a taşıma; varsayılan: ayrı iş").owner).toBe("default");
		expect(classifyNext("Sonraki turda testi koşarım").owner).toBe("agent");
	});

	test("a hand-back is open even when it opens with yok", () => {
		expect(classifyNext("yok — K-1 satırını eklemek senin kararın").ok).toBe(false);
		expect(classifyNext("Faz 1'i benim yazmam mı, senin kurman mı — tek kelime yeter").ok).toBe(false);
		expect(classifyNext("Kasa doctor temizliği ve Grok hata analizi").ok).toBe(false);
		expect(classifyNext("Telefonda token gireyim mi?").ok).toBe(false);
		expect(classifyNext("").owner).toBe("none");
	});

	test("an open step blocks once, and agent_start does not arm it again", () => {
		const { registered, main } = handlers();
		park(registered, main);
		try {
			const blocked = registered.get("session_stop")?.(
				{ last_assistant_message: withNext("Karar sende: hangi aday skill olsun"), stop_hook_active: false },
				main,
			) as { decision?: string; reason?: string } | undefined;
			expect(blocked?.decision).toBe("block");
			expect(blocked?.reason).toContain("Sırada");
			registered.get("agent_start")?.({}, main);
			expect(
				registered.get("session_stop")?.(
					{ last_assistant_message: withNext("Karar sende: hangi aday skill olsun"), stop_hook_active: false },
					main,
				),
			).toBeUndefined();
			registered.get("input")?.({ text: "yeni istek", source: "interactive" }, main);
			registered.get("turn_end")?.({ toolResults: [{}] }, main);
			expect(
				(registered.get("session_stop")?.(
					{ last_assistant_message: withNext("Karar sende: hangi aday"), stop_hook_active: false },
					main,
				) as { decision?: string } | undefined)?.decision,
			).toBe("block");
		} finally {
			delete process.env.KASA_ROOT;
		}
	});

	test("a closed next step is recorded without a repair turn", () => {
		const { registered, main } = handlers();
		const root = park(registered, main);
		try {
			expect(
				registered.get("session_stop")?.(
					{ last_assistant_message: withNext("varsayılan: ayrı iş"), stop_hook_active: false },
					main,
				),
			).toBeUndefined();
			expect(readFileSync(join(root, "handoff", `${new Date().toISOString().slice(0, 10)}.md`), "utf8")).toContain(
				"varsayılan: ayrı iş",
			);
		} finally {
			delete process.env.KASA_ROOT;
		}
	});

	test("a final text turn still blocks when an earlier turn used a tool", () => {
		const { registered, main } = handlers();
		park(registered, main);
		try {
			registered.get("turn_end")?.({ toolResults: [] }, main);
			expect(
				(registered.get("session_stop")?.(
					{ last_assistant_message: withNext("Karar sende: hangisi"), stop_hook_active: false },
					main,
				) as { decision?: string } | undefined)?.decision,
			).toBe("block");
		} finally {
			delete process.env.KASA_ROOT;
		}
	});

	test("a chat run does not block an ownerless next step", () => {
		const { registered, main } = handlers();
		const root = vault();
		process.env.KASA_ROOT = root;
		try {
			registered.get("turn_end")?.({ toolResults: [] }, main);
			expect(
				registered.get("session_stop")?.(
					{ last_assistant_message: withNext("Karar sende: hangisi"), stop_hook_active: false },
					main,
				),
			).toBeUndefined();
		} finally {
			delete process.env.KASA_ROOT;
		}
	});
});

describe("accumulation and intent", () => {
	const stamp = new Date(2026, 10, 9, 10, 0);
	const close = (tag: string) => formatEntry({ done: tag, proof: "p", next: "n" }, stamp, "omp");

	test("earlier lines stay, newest first", () => {
		const once = applyEntry("---\ntitle: D\n---\n", close("bir"));
		const twice = applyEntry(once, close("iki"));
		expect(twice.indexOf("Yaptım: iki")).toBeLessThan(twice.indexOf("Yaptım: bir"));
	});

	test("block stays within the byte budget and keeps the newest line", () => {
		let text = "---\ntitle: D\n---\n";
		const long = "x".repeat(230);
		for (let i = 0; i < 12; i++) text = applyEntry(text, close(`${i}-${long}`));
		const block = /<!-- kasa-handoff:auto:begin -->\n([\s\S]*?)\n<!-- kasa-handoff:auto:end -->/.exec(text)?.[1] ?? "";
		expect(Buffer.byteLength(block)).toBeLessThanOrEqual(1000);
		expect(block).toContain("Yaptım: 11-");
	});

	test("only the two newest intents stay and they outlive old closings", () => {
		let text = "---\ntitle: D\n---\n";
		text = applyEntry(text, formatIntent("birinci istek", stamp, "omp"));
		text = applyEntry(text, formatIntent("ikinci istek", stamp, "omp"));
		text = applyEntry(text, formatIntent("üçüncü istek", stamp, "omp"));
		for (let i = 0; i < 12; i++) text = applyEntry(text, close(`${i}-${"y".repeat(230)}`));
		expect(text).not.toContain("birinci istek");
		expect(text).toContain("ikinci istek");
		expect(text).toContain("üçüncü istek");
	});

	test("intent clips to one line", () => {
		const line = formatIntent(`a\n\nb ${"z".repeat(500)}`, stamp, "omp");
		expect(line.includes("\n")).toBe(false);
		expect(line.length).toBeLessThan(220);
	});

	test("input handler saves only the first plain prompt of a session", () => {
		const { registered, main } = handlers();
		const root = vault();
		process.env.KASA_ROOT = root;
		try {
			const input = registered.get("input");
			input?.({ text: "/model", source: "interactive" }, main);
			input?.({ text: "ilk gerçek istek", source: "interactive" }, main);
			input?.({ text: "ikinci mesaj", source: "interactive" }, main);
			const file = readFileSync(join(root, "handoff", `${new Date().toISOString().slice(0, 10)}.md`), "utf8");
			expect(file).toContain('Niyet: "ilk gerçek istek"');
			expect(file).not.toContain("ikinci mesaj");
			registered.get("session_start")?.({}, main);
			input?.({ text: "yeni oturum istegi", source: "interactive" }, main);
			expect(readFileSync(join(root, "handoff", `${new Date().toISOString().slice(0, 10)}.md`), "utf8")).toContain("yeni oturum istegi");
		} finally {
			delete process.env.KASA_ROOT;
		}
	});

	test("subagent input is ignored", () => {
		const { registered, sub } = handlers();
		const root = vault();
		process.env.KASA_ROOT = root;
		try {
			registered.get("input")?.({ text: "alt ajan", source: "interactive" }, sub);
			expect(() => readFileSync(join(root, "handoff", `${new Date().toISOString().slice(0, 10)}.md`), "utf8")).toThrow();
		} finally {
			delete process.env.KASA_ROOT;
		}
	});

	test("worst-case Turkish text keeps the newest closing and an intent inside 1000 bytes", () => {
		const long = "ş".repeat(240);
		const closing = formatEntry({ done: long, proof: long, next: long }, stamp, "omp");
		const intent = formatIntent("ş".repeat(400), stamp, "omp");
		expect(Buffer.byteLength(closing)).toBeLessThanOrEqual(450);
		expect(Buffer.byteLength(intent)).toBeLessThanOrEqual(360);
		let text = applyEntry("---\ntitle: D\n---\n", intent);
		text = applyEntry(text, closing);
		text = applyEntry(text, intent.replace("10:00", "10:01"));
		text = applyEntry(text, closing.replace("10:00", "10:02"));
		const block = /<!-- kasa-handoff:auto:begin -->\n([\s\S]*?)\n<!-- kasa-handoff:auto:end -->/.exec(text)?.[1] ?? "";
		expect(Buffer.byteLength(block)).toBeLessThanOrEqual(1000);
		expect(block).toContain("10:02");
		expect(block).toContain("Niyet:");
	});
});

describe("concurrent writers", () => {
	test("eight processes closing a turn together keep every line", async () => {
		const root = vault();
		const script = join(roots, "writer.ts");
		await Bun.write(
			script,
			`import { writeLine } from ${JSON.stringify(join(import.meta.dir, "index.ts"))};
const [root, minute] = process.argv.slice(2);
writeLine(root, \`- 10:\${minute} [omp] Yaptım: m\${minute} | Kanıt: k | Sırada: s\`, new Date(2026, 10, 9, 10, Number(minute)));`,
		);
		const minutes = ["10", "11", "12", "13", "14", "15", "16", "17"];
		await Promise.all(minutes.map((m) => Bun.spawn(["bun", script, root, m]).exited));
		const text = readFileSync(join(root, "handoff", "2026-11-09.md"), "utf8");
		for (const m of minutes) expect(text).toContain(`Yaptım: m${m} `);
	});
});
