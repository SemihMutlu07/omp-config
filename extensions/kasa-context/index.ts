import { execFile } from "node:child_process";
import { homedir } from "node:os";
import { join } from "node:path";
import type { ExtensionAPI } from "@oh-my-pi/pi-coding-agent";

type Reference = {
	status: "ready" | "no_match" | "unavailable";
	content?: string;
	paths: string[];
	bytes: number;
	indexed?: number;
	refreshed_at?: string;
	error?: string;
};

function retrieve(prompt: string, cwd: string, sessionStart: boolean): Promise<Reference> {
	const root = process.env.KASA_ROOT ?? join(homedir(), "Kasa");
	const { promise, resolve } = Promise.withResolvers<Reference>();
	const child = execFile("python3", ["-B", join(root, "_vault/scripts/kasa-context.py")], {
		timeout: 10_000,
		maxBuffer: 65_536,
		env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1" },
	}, (error, stdout) => {
		try {
			const result: Reference = JSON.parse(stdout);
			if (result.status === "unavailable" || (!error && typeof result.content === "string"
				&& Buffer.byteLength(result.content, "utf8") <= 9000 && Array.isArray(result.paths))) {
				resolve(result);
				return;
			}
		} catch { /* A failed helper never falls back to old excerpts. */ }
		resolve({ status: "unavailable", error: String(error?.code ?? "invalid_output"), paths: [], bytes: 0 });
	});
	child.stdin?.on("error", () => { /* Process failure is reported by execFile. */ });
	child.stdin?.end(JSON.stringify({ prompt, cwd, session_start: sessionStart }));
	return promise;
}

export default function (pi: ExtensionAPI) {
	let last: Reference | undefined;

	pi.on("session_start", (_event, ctx) => {
		last = undefined;
		if (ctx.agent.kind === "main" && ctx.ui) ctx.ui.setStatus("kasa-context", "Kasa: ilk istekte taranır");
	});

	pi.on("context", async (event, ctx) => {
		// Advisors and watchdogs do not receive Kasa context to preserve independent review.
		if (ctx.agent.kind === "sub" && ctx.agent.name === "advisor") return;
		// Delegated task assignments are agent-attributed user messages.
		// Main-session agent notifications must still not choose the lookup topic.
		const isLookupInput = (message: (typeof event.messages)[number]) =>
			message.role === "user" && (ctx.agent.kind === "sub" || message.attribution !== "agent");
		const position = event.messages.findLastIndex(isLookupInput);
		if (position < 0) return;
		const prompt = event.messages.slice(0, position + 1)
			.filter(isLookupInput)
			.slice(-3).reverse().map((message) => {
				if (message.role !== "user") return "";
				return typeof message.content === "string" ? message.content
					: message.content.filter((part) => part.type === "text").map((part) => part.text).join("\n");
			}).join("\n");
		// The block is ephemeral and rebuilt per call, so the main session gets the approved
		// decisions and latest handoff on every call; the helper keeps the 8 000 B total.
		const ref = await retrieve(prompt, ctx.cwd, ctx.agent.kind === "main");
		last = ref;
		if (ctx.agent.kind === "main" && ctx.ui) {
			const sizeKb = (ref.bytes / 1024).toFixed(1);
			ctx.ui.setStatus("kasa-context", ref.status === "ready"
				? `Kasa: ${ref.paths.length} not (${sizeKb} KB)`
				: ref.status === "no_match" ? "Kasa: eşleşme yok" : "Kasa: YÜKLENEMEDİ");
		}
		const content = ref.status === "unavailable"
			? `Kasa automatic reference lookup is unavailable (${ref.error}). No Kasa excerpts were loaded for this call; do not claim otherwise.`
			: ref.content!;
		// A no-match lookup has nothing to inject; an empty user message can be rejected by providers.
		if (!content) return;
		// Ephemeral reference data, not a system/developer message or a new user task.
		// Insert before the real user turn; never append after it or persist the excerpts.
		return { messages: [
			...event.messages.slice(0, position),
			{ role: "user" as const, attribution: "agent" as const, content, timestamp: Date.now() },
			...event.messages.slice(position),
		] };
	});

	pi.registerCommand("kasa-context", {
		description: "Show the last automatic Kasa lookup: status, source paths, freshness, and byte count",
		handler: async (_args, ctx) => {
			const { content: _content, ...metadata } = last ?? { status: "not_yet_loaded", paths: [], bytes: 0 };
			ctx.ui?.notify(JSON.stringify({ agent: ctx.agent, ...metadata }, null, 2), "info");
		},
	});
}
