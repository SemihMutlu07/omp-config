/**
 * Prompt Cockpit — unified management of Magic Keywords, Execution Modes (Loop), and Snippets.
 *
 * - Press alt+s or run /snippets to open the cockpit menu:
 *     - ⚡ Magic Keywords: OMP native modes (orchestrate, workflowz, ultrathink, jevify)
 *     - 🎯 Execution Modes: Loop (--until test, 3x)
 *     - 🧩 Skills: Curated skill launcher (ask-pocock, ask-matt, gauntlet-loop, ...)
 *     - ↑ Prepend Modifiers: Task planning, orientation, prompt refinement
 *     - ↓ Append Modifiers: Strict verification, scope fence, UI check, question-first
 * - Space: toggle (execution modes are mutually exclusive)
 * - Tab: preview details, command syntax, or snippet body
 * - Enter: apply selections
 * - Esc: cancel
 *
 * Active selections appear as badge pills above the editor.
 * When sent, execution commands, magic keywords, skill directives, and snippets are assembled cleanly.
 * Toggles reset to off after each message and at session start.
 */

import { existsSync, mkdirSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { homedir } from "node:os";
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

export interface SkillItem {
	type: "skill";
	id: string;
	skill: string;
	name: string;
	description: string;
	detail: string;
}

export const SKILLS: SkillItem[] = [
	{
		type: "skill",
		id: "skill:ask-pocock",
		skill: "ask-pocock",
		name: "ask-pocock",
		description: "Hangi yüklü iş akışı uygun? Yönlendirici",
		detail: "Yüklü beceri listesine bakar, göreve uyan workflow'u seçer. Eksik beceriyi kurmaz veya varsaymaz.",
	},
	{
		type: "skill",
		id: "skill:ask-matt",
		skill: "ask-matt",
		name: "ask-matt",
		description: "Fikir → spec → ticket → implement yaşam döngüsü",
		detail: "Yazılım işini ana akışa bağlar: grill, spec, ticket, implement, review. Tek oturumluk işte doğrudan implement.",
	},
	{
		type: "skill",
		id: "skill:grill-for-unknowns",
		skill: "grill-for-unknowns",
		name: "grill-for-unknowns",
		description: "Planı dokümanlara karşı sorgula, bilinmeyenleri çıkar",
		detail: "Uygulamadan önce varsayımları tek tek sınar; yanıtı doküman veya kodda olan soruyu sana sormaz.",
	},
	{
		type: "skill",
		id: "skill:clarity",
		skill: "clarity",
		name: "clarity",
		description: "Sade, format dayatmayan açıklama",
		detail: "Bir konuyu jargon ve şablon olmadan açıklar. Açıklama istendiğinde kullanılır.",
	},
	{
		type: "skill",
		id: "skill:prototype",
		skill: "prototype",
		name: "prototype",
		description: "Tek tasarım sorusunu çalışan kodla yanıtla",
		detail: "UI veya durum modeli kâğıtta çözülmüyorsa küçük, atılabilir bir programla karar verir.",
	},
	{
		type: "skill",
		id: "skill:research",
		skill: "research",
		name: "research",
		description: "Birincil kaynaklardan atıflı Markdown",
		detail: "Okuma işini arka plan ajanına verir; sonucu kaynak atıflı bir dosya olarak bırakır.",
	},
	{
		type: "skill",
		id: "skill:code-review",
		skill: "code-review",
		name: "code-review",
		description: "Branch/PR diff'ini iki eksende incele",
		detail: "Standartlar ve spec ekseninde bağımsız inceleme yapar; kriteri gevşetmeden PASS/FAIL verir.",
	},
	{
		type: "skill",
		id: "skill:gauntlet-loop",
		skill: "gauntlet-loop",
		name: "gauntlet-loop",
		description: "Spec → uygula → bağımsız review → runtime",
		detail: "Kod değişikliğinde sabit kabul kriteri, bağımsız reviewer ve gerçek yüzey doğrulamasıyla ilerler.",
	},
];

const extensionDir = dirname(fileURLToPath(import.meta.url));
const snippetsDir = join(extensionDir, "snippets");
const skillRoots = [join(homedir(), ".omp/agent/skills"), join(homedir(), ".agents/skills")];

/** Curated skills that actually exist on disk; a missing skill must not look runnable. */
export function availableSkills(): SkillItem[] {
	return SKILLS.filter((s) => skillRoots.some((root) => existsSync(join(root, s.skill, "SKILL.md"))));
}
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

	// 3. Skills
	for (const s of SKILLS) {
		if (enabled.has(s.id)) {
			pills.push(theme.fg("accent", `[🧩 ${s.name}]`));
		}
	}

	// 4. Prepend & Append Snippets
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
	| { kind: "skill"; data: SkillItem }
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
	const skills = availableSkills();

	// Build unified items list
	const items: CockpitItem[] = [
		...MAGIC_KEYWORDS.map((k) => ({ kind: "keyword" as const, data: k })),
		...EXECUTION_MODES.map((e) => ({ kind: "execution" as const, data: e })),
		...skills.map((s) => ({ kind: "skill" as const, data: s })),
		...prepends.map((s) => ({ kind: "snippet" as const, data: s })),
		...appends.map((s) => ({ kind: "snippet" as const, data: s })),
	];

	const working = new Set(initialEnabled);
	let mode: "list" | "preview" = "list";
	let cursor = 0;
	let listScroll = 0;
	let previewScroll = 0;
	const ROW_PREFIX_WIDTH = 6; // "› " pointer + "[x] " checkbox

	/** One item: name plus description wrapped with a hanging indent, never cut mid-word. */
	const itemRows = (item: CockpitItem, idx: number, width: number): string[] => {
		const isSelected = working.has(item.data.id);
		const isCursor = idx === cursor;
		const pointer = isCursor ? theme.fg("accent", "› ") : "  ";
		const checkbox = isSelected ? theme.fg("success", "[x]") : theme.fg("dim", "[ ]");
		const prefix = `${pointer}${checkbox} `;
		const indent = " ".repeat(ROW_PREFIX_WIDTH);
		const name = isCursor ? theme.bold(item.data.name) : item.data.name;
		const desc = item.data.description ? theme.fg("dim", ` — ${item.data.description}`) : "";
		const avail = Math.max(10, width - ROW_PREFIX_WIDTH);
		return wrapTextWithAnsi(`${name}${desc}`, avail).map((line, i) =>
			truncateToWidth(i === 0 ? `${prefix}${line}` : `${indent}${line}`, width),
		);
	};

	/** Section header with a right-aligned "seçili/toplam" counter. */
	const sectionHeader = (label: string, color: string, ids: string[], width: number): string => {
		const active = ids.filter((id) => working.has(id)).length;
		const left = theme.bold(theme.fg(color, label));
		const right = theme.fg("dim", `${active}/${ids.length}`);
		const gap = Math.max(1, width - visibleWidth(left) - visibleWidth(right) - 1);
		return truncateToWidth(`${left}${" ".repeat(gap)}${right}`, width);
	};

	const buildListRows = (width: number): { text: string; itemIndex: number | null }[] => {
		const rows: { text: string; itemIndex: number | null }[] = [];
		let currentIndex = 0;

		const pushItem = (item: CockpitItem): void => {
			const idx = currentIndex++;
			for (const text of itemRows(item, idx, width)) rows.push({ text, itemIndex: idx });
		};

		// 1. Magic Keywords Section
		rows.push({
			text: sectionHeader("⚡ Magic Keywords", "accent", MAGIC_KEYWORDS.map((k) => k.id), width),
			itemIndex: null,
		});
		for (const kw of MAGIC_KEYWORDS) pushItem({ kind: "keyword", data: kw });

		// 2. Execution Modes Section
		rows.push({ text: "", itemIndex: null });
		rows.push({
			text: sectionHeader("🎯 Execution Modes", "warning", EXECUTION_MODES.map((e) => e.id), width),
			itemIndex: null,
		});
		for (const ex of EXECUTION_MODES) pushItem({ kind: "execution", data: ex });

		// 3. Skills Section
		rows.push({ text: "", itemIndex: null });
		rows.push({
			text: sectionHeader("🧩 Skills", "accent", skills.map((s) => s.id), width),
			itemIndex: null,
		});
		for (const s of skills) pushItem({ kind: "skill", data: s });

		// 4. Prepend Snippets Section
		if (prepends.length > 0) {
			rows.push({ text: "", itemIndex: null });
			rows.push({
				text: sectionHeader("↑ Prepend Modifiers", "accent", prepends.map((s) => s.id), width),
				itemIndex: null,
			});
			for (const s of prepends) pushItem({ kind: "snippet", data: s });
		}

		// 5. Append Snippets Section
		if (appends.length > 0) {
			rows.push({ text: "", itemIndex: null });
			rows.push({
				text: sectionHeader("↓ Append Modifiers", "warning", appends.map((s) => s.id), width),
				itemIndex: null,
			});
			for (const s of appends) pushItem({ kind: "snippet", data: s });
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
			for (const wrapped of wrapTextWithAnsi(
				theme.fg("dim", "Etki: Bu sözcük istemin başına doğrudan eklenir ve OMP'nin özel çalışma modunu tetikler."),
				width,
			)) {
				rows.push(truncateToWidth(wrapped, width));
			}
		} else if (item.kind === "execution") {
			rows.push(truncateToWidth(theme.fg("warning", `Execution Mode · Komut Öneki: ${d.commandPrefix.trim()}`), width));
			rows.push(theme.fg("dim", "─".repeat(Math.min(width, 40))));
			rows.push(truncateToWidth(theme.bold("Açıklama:"), width));
			for (const wrapped of wrapTextWithAnsi(d.detail, width)) {
				rows.push(truncateToWidth(wrapped, width));
			}
			rows.push("");
			for (const wrapped of wrapTextWithAnsi(
				theme.fg("dim", `Sözdizimi: ${d.commandPrefix}<isteminiz>`),
				width,
			)) {
				rows.push(truncateToWidth(wrapped, width));
			}
		} else if (item.kind === "skill") {
			rows.push(truncateToWidth(theme.fg("accent", `Skill · skill://${d.skill}/SKILL.md`), width));
			rows.push(theme.fg("dim", "─".repeat(Math.min(width, 40))));
			rows.push(truncateToWidth(theme.bold("Açıklama:"), width));
			for (const wrapped of wrapTextWithAnsi(d.detail, width)) {
				rows.push(truncateToWidth(wrapped, width));
			}
			rows.push("");
			for (const wrapped of wrapTextWithAnsi(
				theme.fg("dim", "Etki: Seçilirse istemin başına bu beceriyi okuma ve uygulama direktifi eklenir."),
				width,
			)) {
				rows.push(truncateToWidth(wrapped, width));
			}
		} else if (item.kind === "snippet") {
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
		focusStart?: number,
		focusEnd?: number,
	): { out: string[]; scroll: number } => {
		const clipped = lines.length > maxView;
		const view = clipped ? Math.max(1, maxView - 2) : maxView;

		let s = Math.min(Math.max(0, scroll), Math.max(0, lines.length - view));
		if (focusStart !== undefined) {
			const end = focusEnd ?? focusStart;
			if (end - focusStart + 1 >= view) s = focusStart;
			else if (focusStart < s) s = focusStart;
			else if (end >= s + view) s = end - view + 1;
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
			const maxView = Math.max(5, termRows - 8);

			let content: string[];
			let title: string;
			let hints: string;

			if (mode === "list") {
				const rows = buildListRows(width);
				const cursorRows = rows.flatMap((r, i) => (r.itemIndex === cursor ? [i] : []));
				const v = viewport(
					rows.map((r) => r.text),
					listScroll,
					maxView,
					cursorRows[0],
					cursorRows[cursorRows.length - 1],
				);
				content = v.out;
				listScroll = v.scroll;
				const activeCount = working.size;
				title = activeCount > 0 ? `Prompt Cockpit · ${activeCount} seçili` : "Prompt Cockpit";
				hints = "↑↓ gez · 1-5 bölüm · Space seç · c temizle · Tab detay · Enter uygula · Esc çık";
			} else {
				const item = items[cursor];
				const rows = buildPreviewRows(item, width);
				const v = viewport(rows, previewScroll, maxView);
				content = v.out;
				previewScroll = v.scroll;
				const isToggled = working.has(item.data.id);
				title = `Detay · ${item.data.name}${isToggled ? " · seçili" : ""}`;
				hints = "↑↓ kaydır · Space seç · Tab/Esc geri · Enter uygula";
			}

			const activeCount = working.size;
			const stateText =
				activeCount === 0
					? "Hiçbiri seçili değil. Bu bir todo listesi değil: seçim yalnız bir sonraki mesaja eklenir."
					: `${activeCount} seçim bir sonraki mesaja eklenecek; gönderimden sonra sıfırlanır.`;

			const titleText = ` ${title} `;
			const titleLen = visibleWidth(titleText);
			const lineBefore = "──";
			const remainingDashes = Math.max(0, width - 2 - titleLen);
			const headerLine = truncateToWidth(
				theme.fg("accent", lineBefore) + theme.bold(titleText) + theme.fg("accent", "─".repeat(remainingDashes)),
				width,
			);
			const footerDivider = theme.fg("accent", "─".repeat(width));
			const footerLines = [hints, stateText].flatMap((text) =>
				wrapTextWithAnsi(theme.fg("dim", text), Math.max(10, width - 2)).map((line) =>
					truncateToWidth(` ${line}`, width),
				),
			);

			return [
				headerLine,
				...content,
				footerDivider,
				...footerLines,
			];
		},
		invalidate() {},
		handleInput(data: string) {
			if (mode === "list") {
				const kwStart = 0;
				const execStart = MAGIC_KEYWORDS.length;
				const skillStart = execStart + EXECUTION_MODES.length;
				const prepStart = skillStart + skills.length;
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
				} else if (data === "3" && skills.length > 0) {
					cursor = skillStart;
					tui.requestRender();
					return;
				} else if (data === "4" && prepends.length > 0) {
					cursor = prepStart;
					tui.requestRender();
					return;
				} else if (data === "5" && appends.length > 0) {
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

/** Resolve the selected cockpit ids into the exact text sent for one turn. */
export function assemblePrompt(working: Set<string>, snippets: Snippet[], text: string): string {
	const activeKeywords = MAGIC_KEYWORDS.filter((k) => working.has(k.id)).map((k) => k.keyword);
	const activeExecution = EXECUTION_MODES.find((e) => working.has(e.id));
	const activeSkills = availableSkills().filter((s) => working.has(s.id));
	const activeSnippets = snippets.filter((s) => working.has(s.id));
	const prependBodies = activeSnippets.filter((s) => s.placement === "prepend").map((s) => s.body);
	const appendBodies = activeSnippets.filter((s) => s.placement === "append").map((s) => s.body);

	const sections: string[] = [];
	if (activeKeywords.length > 0) sections.push(activeKeywords.join("\n"));
	if (activeSkills.length > 0) {
		sections.push(activeSkills.map((s) => `Read skill://${s.skill}/SKILL.md and follow it for this task.`).join("\n"));
	}
	sections.push(...prependBodies, text, ...appendBodies);

	const fullText = sections.join("\n\n");
	return activeExecution ? `${activeExecution.commandPrefix}${fullText}` : fullText;
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
			...SKILLS.map((s) => s.id),
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

		return {
			text: assemblePrompt(currentWorking, snippets, event.text),
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
