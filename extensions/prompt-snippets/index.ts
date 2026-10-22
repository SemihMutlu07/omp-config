/**
 * Prompt Cockpit — unified management of Magic Keywords, Execution Modes (Loop), and Snippets.
 *
 * - Press alt+s or run /snippets to open the cockpit menu:
 *     - ⚡ Magic Keywords: OMP native modes (orchestrate, workflowz, ultrathink, jevify)
 *     - 🎯 Execution Modes: Loop (--until test, 3x)
 *     - ↑ Prepend Modifiers: Task planning, orientation, prompt refinement
 *     - ↓ Append Modifiers: Strict verification, scope fence, UI check, question-first
 * - Space: toggle (execution modes are mutually exclusive)
 * - Tab: preview details, command syntax, or snippet body
 * - Enter: apply selections
 * - Esc: cancel
 *
 * Active selections appear as badge pills above the editor.
 * When sent, execution commands, magic keywords, and snippets are assembled cleanly.
 * Toggles reset to off after each message and at session start.
 */

import { existsSync, mkdirSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { Key, matchesKey, truncateToWidth, visibleWidth, wrapTextWithAnsi } from "@earendil-works/pi-tui";

export interface Snippet {
	/** Filename, e.g. "plan-outline.md" */
	id: string;
	name: string;
	description: string;
	placement: "prepend" | "append";
	order: number;
	body: string;
}

export interface MagicKeywordItem {
	type: "keyword";
	id: string;
	keyword: string;
	name: string;
	description: string;
	detail: string;
}

export interface ExecutionModeItem {
	type: "execution";
	id: string;
	name: string;
	badge: string;
	description: string;
	commandPrefix: string;
	detail: string;
}

export const MAGIC_KEYWORDS: MagicKeywordItem[] = [
	{
		type: "keyword",
		id: "kw:orchestrate",
		keyword: "orchestrate",
		name: "orchestrate",
		description: "Çoklu alt-ajan dağıtımı ve orkestrasyon sözleşmesi",
		detail: "OMP'nin yerleşik orchestrator sözleşmesini etkinleştirir. Görevleri alt-ajanlara böler, paralel dağıtır ve doğrular.",
	},
	{
		type: "keyword",
		id: "kw:workflowz",
		keyword: "workflowz",
		name: "workflowz",
		description: "Rol haritası ve workpool tabanlı uzman ajan yönlendirmesi",
		detail: "OMP'nin yerleşik workflowz motorunu devreye sokar. workpool('scout') ve reviewer gibi uzman rolleri kullanır.",
	},
	{
		type: "keyword",
		id: "kw:ultrathink",
		keyword: "ultrathink",
		name: "ultrathink",
		description: "Maksimum akıl yürütme (thinking) bütçesi",
		detail: "Modele izin verilen en derin akıl yürütme (reasoning/thinking) kotasını atar.",
	},
	{
		type: "keyword",
		id: "kw:jevify",
		keyword: "jevify",
		name: "jevify",
		description: "judge_batch ile eval ortamında toplu sınıflandırma",
		detail: "Dondurulmuş rubrik ile eval kernelinde toplu verileri (diff, dosya, log) paralel sınıflandırır.",
	},
];

export const EXECUTION_MODES: ExecutionModeItem[] = [
	{
		type: "execution",
		id: "exec:loop_test",
		name: "Loop: Test geçene kadar (--until)",
		badge: "Loop: until test",
		description: "Komut 0 dönene kadar istemi yineler (/loop --until 'npm test')",
		commandPrefix: "/loop --until 'npm test' ",
		detail: "Her yanıtın ardından arka planda test komutunu çalıştırır. Test başarılı olunca (exit 0) döngüyü durdurur. TDD için idealdir.",
	},
	{
		type: "execution",
		id: "exec:loop_3x",
		name: "Loop: 3 iterasyon tekrarla",
		badge: "Loop: 3x",
		description: "İstemi 3 tur boyunca otomatik yineler (/loop 3)",
		commandPrefix: "/loop 3 ",
		detail: "İstemi 3 kez peş peşe çalıştırır. Adım adım refactoring veya iteratif iyileştirme işlemlerinde kullanılır.",
	},
];

const extensionDir = dirname(fileURLToPath(import.meta.url));
const snippetsDir = join(extensionDir, "snippets");
const WIDGET_ID = "prompt-snippets";

export function parseSnippet(filename: string, raw: string): Snippet | null {
	const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
	if (!match) return null;

	const meta: Record<string, string> = {};
	for (const line of match[1].split(/\r?\n/)) {
		const kv = line.match(/^([A-Za-z][\w-]*)\s*:\s*(.*)$/);
		if (kv) meta[kv[1].toLowerCase()] = kv[2].trim().replace(/^["']|["']$/g, "");
	}

	const body = match[2].trim();
	if (!body) return null;

	const parsedOrder = Number.parseInt(meta.order ?? "", 10);
	return {
		id: filename,
		name: meta.name || filename.replace(/\.md$/i, ""),
		description: meta.description ?? "",
		placement: meta.placement === "prepend" ? "prepend" : "append",
		order: Number.isFinite(parsedOrder) ? parsedOrder : 9999,
		body,
	};
}

/** Load all snippets, sorted: prepend group first, append group last, each by (order, name). */
export function loadSnippets(customDir: string = snippetsDir): Snippet[] {
	if (!existsSync(customDir)) return [];
	const snippets: Snippet[] = [];
	for (const file of readdirSync(customDir)) {
		if (!file.toLowerCase().endsWith(".md")) continue;
		try {
			const snippet = parseSnippet(file, readFileSync(join(customDir, file), "utf8"));
			if (snippet) snippets.push(snippet);
		} catch {
			// Skip unreadable files
		}
	}
	const byOrder = (a: Snippet, b: Snippet) => a.order - b.order || a.name.localeCompare(b.name);
	return [
		...snippets.filter((s) => s.placement === "prepend").sort(byOrder),
		...snippets.filter((s) => s.placement === "append").sort(byOrder),
	];
}

export interface ThemeLike {
	fg: (color: string, text: string) => string;
	bold: (text: string) => string;
}

/** Build compact tag pills for the editor widget */
export function formatBadges(snippets: Snippet[], enabled: Set<string>, theme: ThemeLike): string[] {
	const pills: string[] = [];

	// 1. Magic Keywords
	for (const kw of MAGIC_KEYWORDS) {
		if (enabled.has(kw.id)) {
			pills.push(theme.fg("accent", `[⚡ ${kw.name}]`));
		}
	}

	// 2. Execution Modes
	for (const ex of EXECUTION_MODES) {
		if (enabled.has(ex.id)) {
			pills.push(theme.fg("warning", `[🎯 ${ex.badge}]`));
		}
	}

	// 3. Prepend & Append Snippets
	const activeSnippets = snippets.filter((s) => enabled.has(s.id));
	const prepends = activeSnippets.filter((s) => s.placement === "prepend");
	const appends = activeSnippets.filter((s) => s.placement === "append");

	for (const s of prepends) {
		pills.push(theme.fg("accent", `[↑ ${s.name}]`));
	}
	for (const s of appends) {
		pills.push(theme.fg("warning", `[↓ ${s.name}]`));
	}

	if (pills.length === 0) return [];
	return [pills.join(" ")];
}

export type CockpitItem =
	| { kind: "keyword"; data: MagicKeywordItem }
	| { kind: "execution"; data: ExecutionModeItem }
	| { kind: "snippet"; data: Snippet };

export interface SnippetsMenuOptions {
	snippets: Snippet[];
	initialEnabled: Set<string>;
	tui: {
		terminal?: { rows?: number };
		requestRender: () => void;
	};
	theme: ThemeLike;
	done: (applied: boolean, result: Set<string>) => void;
}

export interface SnippetsMenuComponent {
	render(width: number): string[];
	handleInput(data: string): void;
	invalidate(): void;
	readonly mode: "list" | "preview";
	readonly cursor: number;
	readonly working: Set<string>;
}

/** Create the TUI menu component for the unified prompt cockpit. */
export function createSnippetsMenuComponent(options: SnippetsMenuOptions): SnippetsMenuComponent {
	const { snippets, initialEnabled, tui, theme, done } = options;

	const prepends = snippets.filter((s) => s.placement === "prepend");
	const appends = snippets.filter((s) => s.placement === "append");

	// Build unified items list
	const items: CockpitItem[] = [
		...MAGIC_KEYWORDS.map((k) => ({ kind: "keyword" as const, data: k })),
		...EXECUTION_MODES.map((e) => ({ kind: "execution" as const, data: e })),
		...prepends.map((s) => ({ kind: "snippet" as const, data: s })),
		...appends.map((s) => ({ kind: "snippet" as const, data: s })),
	];

	const working = new Set(initialEnabled);
	let mode: "list" | "preview" = "list";
	let cursor = 0;
	let listScroll = 0;
	let previewScroll = 0;
	const itemRow = (item: CockpitItem, idx: number, width: number): string => {
		const isSelected = working.has(item.data.id);
		const isCursor = idx === cursor;
		const pointer = isCursor ? theme.fg("accent", "› ") : "  ";
		const checkbox = isSelected ? theme.fg("success", "[x]") : theme.fg("dim", "[ ]");
		const name = isCursor ? theme.bold(item.data.name) : item.data.name;
		const desc = item.data.description ? theme.fg("dim", ` — ${item.data.description}`) : "";
		return truncateToWidth(`${pointer}${checkbox} ${name}${desc}`, width);
	};

	const buildListRows = (width: number): { text: string; itemIndex: number | null }[] => {
		const rows: { text: string; itemIndex: number | null }[] = [];
		let currentIndex = 0;

		// 1. Magic Keywords Section
		rows.push({
			text: truncateToWidth(
				theme.bold(theme.fg("accent", "⚡ MAGIC KEYWORDS")) + theme.fg("dim", " (OMP yerleşik sözleşmeler)"),
				width,
			),
			itemIndex: null,
		});
		for (const kw of MAGIC_KEYWORDS) {
			const idx = currentIndex++;
			rows.push({ text: itemRow({ kind: "keyword", data: kw }, idx, width), itemIndex: idx });
		}

		// 2. Execution Modes Section
		rows.push({ text: "", itemIndex: null });
		rows.push({
			text: truncateToWidth(
				theme.bold(theme.fg("warning", "🎯 EXECUTION MODES")) + theme.fg("dim", " (Döngü kontrolü)"),
				width,
			),
			itemIndex: null,
		});
		for (const ex of EXECUTION_MODES) {
			const idx = currentIndex++;
			rows.push({ text: itemRow({ kind: "execution", data: ex }, idx, width), itemIndex: idx });
		}

		// 3. Prepend Snippets Section
		if (prepends.length > 0) {
			rows.push({ text: "", itemIndex: null });
			rows.push({
				text: truncateToWidth(
					theme.bold(theme.fg("accent", "↑ PREPEND MODIFIERS")) + theme.fg("dim", " (İstem öncesi niyet)"),
					width,
				),
				itemIndex: null,
			});
			for (const s of prepends) {
				const idx = currentIndex++;
				rows.push({ text: itemRow({ kind: "snippet", data: s }, idx, width), itemIndex: idx });
			}
		}

		// 4. Append Snippets Section
		if (appends.length > 0) {
			rows.push({ text: "", itemIndex: null });
			rows.push({
				text: truncateToWidth(
					theme.bold(theme.fg("warning", "↓ APPEND MODIFIERS")) + theme.fg("dim", " (İstem sonrası sınır ve test)"),
					width,
				),
				itemIndex: null,
			});
			for (const s of appends) {
				const idx = currentIndex++;
				rows.push({ text: itemRow({ kind: "snippet", data: s }, idx, width), itemIndex: idx });
			}
		}

		return rows;
	};

	const buildPreviewRows = (item: CockpitItem, width: number): string[] => {
		const rows: string[] = [];
		const d = item.data;
		rows.push(truncateToWidth(theme.bold(d.name), width));

		if (item.kind === "keyword") {
			rows.push(truncateToWidth(theme.fg("accent", `Magic Keyword · OMP yerleşik · ${d.keyword}`), width));
			rows.push(theme.fg("dim", "─".repeat(Math.min(width, 40))));
			rows.push(truncateToWidth(theme.bold("Açıklama:"), width));
			for (const wrapped of wrapTextWithAnsi(d.detail, width)) {
				rows.push(truncateToWidth(wrapped, width));
			}
			rows.push("");
			rows.push(truncateToWidth(theme.fg("dim", "Etki: Bu sözcük istemin başına doğrudan eklenir ve OMP'nin özel çalışma modunu tetikler."), width));
		} else if (item.kind === "execution") {
			rows.push(truncateToWidth(theme.fg("warning", `Execution Mode · Komut Öneki: ${d.commandPrefix.trim()}`), width));
			rows.push(theme.fg("dim", "─".repeat(Math.min(width, 40))));
			rows.push(truncateToWidth(theme.bold("Açıklama:"), width));
			for (const wrapped of wrapTextWithAnsi(d.detail, width)) {
				rows.push(truncateToWidth(wrapped, width));
			}
			rows.push("");
			rows.push(truncateToWidth(theme.fg("dim", `Sözdizimi: ${d.commandPrefix}<isteminiz>`), width));
		} else {
			const s = d as Snippet;
			rows.push(truncateToWidth(theme.fg("dim", `${s.placement} · order ${s.order} · ${s.id}`), width));
			rows.push(theme.fg("dim", "─".repeat(Math.min(width, 40))));
			for (const line of s.body.split("\n")) {
				for (const wrapped of wrapTextWithAnsi(line, width)) {
					rows.push(truncateToWidth(wrapped, width));
				}
			}
		}

		return rows;
	};

	const viewport = (
		lines: string[],
		scroll: number,
		maxView: number,
		focusRow?: number,
	): { out: string[]; scroll: number } => {
		const clipped = lines.length > maxView;
		const view = clipped ? Math.max(1, maxView - 2) : maxView;

		let s = Math.min(Math.max(0, scroll), Math.max(0, lines.length - view));
		if (focusRow !== undefined) {
			if (focusRow < s) s = focusRow;
			else if (focusRow >= s + view) s = focusRow - view + 1;
		}

		const visible = lines.slice(s, s + view);
		if (!clipped) return { out: visible, scroll: s };

		const above = s;
		const below = lines.length - (s + view);
		return {
			out: [
				above > 0 ? theme.fg("dim", `  ↑ ${above} daha fazla`) : "",
				...visible,
				below > 0 ? theme.fg("dim", `  ↓ ${below} daha fazla`) : "",
			],
			scroll: s,
		};
	};

	return {
		render(width: number): string[] {
			const termRows = tui.terminal?.rows ?? 24;
			const maxView = Math.max(5, termRows - 5);

			let content: string[];
			let title: string;
			let hints: string;

			if (mode === "list") {
				const rows = buildListRows(width);
				const cursorRow = rows.findIndex((r) => r.itemIndex === cursor);
				const v = viewport(rows.map((r) => r.text), listScroll, maxView, cursorRow);
				content = v.out;
				listScroll = v.scroll;
				const activeCount = working.size;
				const activeStr = activeCount > 0 ? ` (${activeCount} seçili)` : "";
				title = `Prompt Cockpit${activeStr}`;
				hints = "↑↓/1-4 gez • Space seç/kaldır • c temizle • Tab detay • Enter uygula • Esc vazgeç";
			} else {
				const item = items[cursor];
				const rows = buildPreviewRows(item, width);
				const v = viewport(rows, previewScroll, maxView);
				content = v.out;
				previewScroll = v.scroll;
				const isToggled = working.has(item.data.id);
				title = `Detay: ${item.data.name} [${isToggled ? "x" : " "}]`;
				hints = "↑↓ kaydır • Space seç/kaldır • Tab/Esc geri • Enter uygula";
			}

			const titleText = ` ${title} `;
			const titleLen = visibleWidth(titleText);
			const lineBefore = "──";
			const remainingDashes = Math.max(0, width - 2 - titleLen);
			const headerLine = truncateToWidth(
				theme.fg("accent", lineBefore) + theme.bold(titleText) + theme.fg("accent", "─".repeat(remainingDashes)),
				width,
			);
			const footerDivider = theme.fg("accent", "─".repeat(width));
			const hintLine = truncateToWidth(theme.fg("dim", ` ${hints}`), width);

			return [
				headerLine,
				...content,
				footerDivider,
				hintLine,
			];
		},
		invalidate() {},
		handleInput(data: string) {
			if (mode === "list") {
				const kwStart = 0;
				const execStart = MAGIC_KEYWORDS.length;
				const prepStart = execStart + EXECUTION_MODES.length;
				const appStart = prepStart + prepends.length;

				if (data === "c" || data === "C") {
					working.clear();
					tui.requestRender();
					return;
				} else if (data === "1") {
					cursor = kwStart;
					tui.requestRender();
					return;
				} else if (data === "2" && EXECUTION_MODES.length > 0) {
					cursor = execStart;
					tui.requestRender();
					return;
				} else if (data === "3" && prepends.length > 0) {
					cursor = prepStart;
					tui.requestRender();
					return;
				} else if (data === "4" && appends.length > 0) {
					cursor = appStart;
					tui.requestRender();
					return;
				}

				if (matchesKey(data, Key.up)) {
					cursor = (cursor - 1 + items.length) % items.length;
					tui.requestRender();
				} else if (matchesKey(data, Key.down)) {
					cursor = (cursor + 1) % items.length;
					tui.requestRender();
				} else if (matchesKey(data, Key.space)) {
					const currentItem = items[cursor];
					const id = currentItem.data.id;
					if (working.has(id)) {
						working.delete(id);
					} else {
						// Execution mode is mutually exclusive: toggle off other execution modes
						if (currentItem.kind === "execution") {
							for (const ex of EXECUTION_MODES) {
								working.delete(ex.id);
							}
						}
						working.add(id);
					}
					tui.requestRender();
				} else if (matchesKey(data, Key.tab)) {
					mode = "preview";
					previewScroll = 0;
					tui.requestRender();
				} else if (matchesKey(data, Key.enter)) {
					done(true, working);
				} else if (matchesKey(data, Key.escape)) {
					done(false, working);
				}
			} else {
				if (matchesKey(data, Key.up)) {
					previewScroll = Math.max(0, previewScroll - 1);
					tui.requestRender();
				} else if (matchesKey(data, Key.down)) {
					previewScroll++;
					tui.requestRender();
				} else if (matchesKey(data, Key.space)) {
					const currentItem = items[cursor];
					const id = currentItem.data.id;
					if (working.has(id)) {
						working.delete(id);
					} else {
						if (currentItem.kind === "execution") {
							for (const ex of EXECUTION_MODES) {
								working.delete(ex.id);
							}
						}
						working.add(id);
					}
					tui.requestRender();
				} else if (matchesKey(data, Key.tab) || matchesKey(data, Key.escape)) {
					mode = "list";
					tui.requestRender();
				} else if (matchesKey(data, Key.enter)) {
					done(true, working);
				}
			}
		},
		get mode() {
			return mode;
		},
		get cursor() {
			return cursor;
		},
		get working() {
			return working;
		},
	};
}

export default function (pi: ExtensionAPI) {
	let snippets: Snippet[] = [];
	let enabled = new Set<string>();

	function updateWidget(ctx: ExtensionContext) {
		if (!ctx.hasUI || ctx.mode !== "tui") return;
		const badges = formatBadges(snippets, enabled, ctx.ui.theme);
		if (badges.length === 0) {
			ctx.ui.setWidget(WIDGET_ID, undefined);
		} else {
			ctx.ui.setWidget(WIDGET_ID, badges);
		}
	}

	async function openMenu(ctx: ExtensionContext) {
		if (ctx.mode !== "tui") {
			ctx.ui.notify("Cockpit menu requires interactive mode", "warning");
			return;
		}

		snippets = loadSnippets();

		// Keep only valid IDs (keywords, execution modes, or existing snippets on disk)
		const validIds = new Set([
			...MAGIC_KEYWORDS.map((k) => k.id),
			...EXECUTION_MODES.map((e) => e.id),
			...snippets.map((s) => s.id),
		]);
		enabled = new Set([...enabled].filter((id) => validIds.has(id)));

		const result = await ctx.ui.custom<{ confirmed: boolean; enabled: Set<string> }>((tui, theme, _keybindings, done) => {
			return createSnippetsMenuComponent({
				snippets,
				initialEnabled: enabled,
				tui,
				theme,
				done: (confirmed, finalWorking) => done({ confirmed, enabled: finalWorking }),
			});
		});

		if (result?.confirmed) {
			enabled = result.enabled;
		}
		updateWidget(ctx);
	}

	pi.on("session_start", (_event, ctx) => {
		enabled = new Set();
		snippets = loadSnippets();
		if (!existsSync(snippetsDir)) mkdirSync(snippetsDir, { recursive: true });
		updateWidget(ctx);
	});

	pi.on("input", async (event, ctx) => {
		if (enabled.size === 0) return; // continue unchanged

		snippets = loadSnippets();
		const currentWorking = new Set(enabled);
		enabled = new Set();
		updateWidget(ctx);

		// 1. Resolve Magic Keywords
		const activeKeywords = MAGIC_KEYWORDS.filter((k) => currentWorking.has(k.id)).map((k) => k.keyword);

		// 2. Resolve Execution Mode (at most one)
		const activeExecution = EXECUTION_MODES.find((e) => currentWorking.has(e.id));

		// 3. Resolve Snippets
		const activeSnippets = snippets.filter((s) => currentWorking.has(s.id));
		const prependBodies = activeSnippets.filter((s) => s.placement === "prepend").map((s) => s.body);
		const appendBodies = activeSnippets.filter((s) => s.placement === "append").map((s) => s.body);

		// Build prompt payload
		const promptSections: string[] = [];
		if (activeKeywords.length > 0) {
			promptSections.push(activeKeywords.join("\n"));
		}
		if (prependBodies.length > 0) {
			promptSections.push(...prependBodies);
		}
		promptSections.push(event.text);
		if (appendBodies.length > 0) {
			promptSections.push(...appendBodies);
		}

		let fullText = promptSections.join("\n\n");

		// If execution mode is armed, prefix the entire payload with its command prefix
		if (activeExecution) {
			fullText = `${activeExecution.commandPrefix}${fullText}`;
		}

		return {
			text: fullText,
		};
	});

	pi.registerShortcut("alt+s", {
		description: "Toggle prompt cockpit (Keywords, Loops, Snippets)",
		handler: async (ctx) => {
			await openMenu(ctx);
		},
	});

	pi.registerCommand("snippets", {
		description: "Open the prompt cockpit toggle menu",
		handler: async (_args, ctx) => {
			await openMenu(ctx);
		},
	});

	pi.registerCommand("cockpit", {
		description: "Open the prompt cockpit toggle menu",
		handler: async (_args, ctx) => {
			await openMenu(ctx);
		},
	});
}
