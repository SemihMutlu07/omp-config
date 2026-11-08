/**
 * Prompt Cockpit
 *
 * `alt+s` (or `/snippets` / `/cockpit`) opens a selector for prompt modifiers and skills,
 * mirroring the Pi cockpit: ↑ prepend snippets, ↓ append snippets, 🧩 skills.
 * Enter assembles the selections around whatever is already in the editor and
 * sends it. Selections reset after sending, except snippets marked `sticky`
 * in their frontmatter (`sticky: true`).
 *
 * Snippet files live in ./snippets/*.md (or ~/.pi/agent/snippets/*.md).
 * Frontmatter: name, description, placement (prepend|append), order, sticky.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { matchesKey, truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";

const defaultSnippetDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "snippets");
export const SNIPPET_DIR = fs.existsSync(defaultSnippetDir)
	? defaultSnippetDir
	: path.join(os.homedir(), ".pi", "agent", "snippets");
export const SKILL_ROOT = path.join(os.homedir(), ".agents", "skills");
export const BADGE_WIDGET = "snippets-badges";

export type Snippet = {
	id: string;
	name: string;
	description: string;
	placement: "prepend" | "append";
	order: number;
	sticky: boolean;
	body: string;
};

export type Item = {
	id: string;
	label: string;
	hint: string;
	body: string;
	skills?: string[];
	sticky: boolean;
};

export type Section = {
	title: string;
	color: "accent" | "warning" | "success";
	items: Item[];
};

export type CuratedSkill = {
	name: string;
	label: string;
	description: string;
	also?: string[];
};

/** Curated skills, mirrors the cockpit list. Each name must exist on disk. */
export const CURATED_SKILLS: CuratedSkill[] = [
	{ name: "ask-pocock", label: "ask-pocock", description: "Uygun yüklü iş akışını seç" },
	{
		name: "ask-pocock",
		label: "plan → kur → kanıtla",
		description: "ask-pocock + grill-for-unknowns + gauntlet-loop",
		also: ["grill-for-unknowns", "gauntlet-loop"],
	},
	{
		name: "research-before-build",
		label: "research-before-build",
		description: "Önce mevcut örnekleri araştır, seçenek göster",
	},
	{ name: "gauntlet-loop", label: "gauntlet-loop", description: "Spec → uygula → review → runtime" },
];

export function parseSnippet(file: string, raw: string): Snippet | null {
	const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
	if (!match) return null;

	const meta: Record<string, string> = {};
	for (const line of match[1].split(/\r?\n/)) {
		const kv = line.match(/^([A-Za-z][\w-]*)\s*:\s*(.*)$/);
		if (kv) meta[kv[1].toLowerCase()] = kv[2].trim().replace(/^["']|["']$/g, "");
	}

	const body = match[2].trim();
	if (!body) return null;

	const order = Number.parseInt(meta.order ?? "", 10);
	return {
		id: file,
		name: meta.name || file.replace(/\.md$/i, ""),
		description: meta.description ?? "",
		placement: meta.placement === "prepend" ? "prepend" : "append",
		order: Number.isFinite(order) ? order : 9999,
		sticky: meta.sticky === "true",
		body,
	};
}

export function loadSnippets(customDir: string = SNIPPET_DIR): Snippet[] {
	if (!fs.existsSync(customDir)) return [];
	const snippets: Snippet[] = [];
	for (const file of fs.readdirSync(customDir)) {
		if (!file.endsWith(".md")) continue;
		try {
			const parsed = parseSnippet(file, fs.readFileSync(path.join(customDir, file), "utf8"));
			if (parsed) snippets.push(parsed);
		} catch {
			// an unreadable snippet is skipped, not fatal
		}
	}
	return snippets.sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
}

export function skillPath(name: string): string {
	return path.join(SKILL_ROOT, name, "SKILL.md");
}

export function loadSkills(): Item[] {
	return CURATED_SKILLS.filter((skill) =>
		[skill.name, ...(skill.also ?? [])].every((name) => fs.existsSync(skillPath(name))),
	).map((skill) => ({
		id: `skill:${skill.label}`,
		label: skill.label,
		hint: skill.description,
		body: [skill.name, ...(skill.also ?? [])].map((name) => skillPath(name)).join("\n"),
		skills: [skill.name, ...(skill.also ?? [])],
		sticky: false,
	}));
}

export function buildSections(snippets: Snippet[] = loadSnippets()): Section[] {
	const toItem = (s: Snippet): Item => ({
		id: `snippet:${s.id}`,
		label: s.name,
		hint: s.description,
		body: s.body,
		sticky: s.sticky,
	});

	const prepend = snippets.filter((s) => s.placement === "prepend").map(toItem);
	const append = snippets.filter((s) => s.placement === "append").map(toItem);

	const sections: Section[] = [];
	if (prepend.length > 0) sections.push({ title: "↑ Prepend Modifiers", color: "accent", items: prepend });
	if (append.length > 0) sections.push({ title: "↓ Append Modifiers", color: "warning", items: append });
	const skills = loadSkills();
	if (skills.length > 0) sections.push({ title: "🧩 Skills", color: "success", items: skills });
	return sections;
}

export interface ThemeLike {
	fg(color: string, text: string): string;
	bold(text: string): string;
}

export function formatBadges(
	sections: Section[],
	isActive: (item: Item) => boolean,
	theme: ThemeLike,
): string[] {
	const items = sections.flatMap((s) => s.items).filter(isActive);
	if (items.length === 0) return [];
	return [items.map((item) => theme.fg("accent", `[${item.label}]`)).join(" ")];
}

export function assemblePrompt(
	sections: Section[],
	isActive: (item: Item) => boolean,
	editorText: string,
): string {
	const items = sections.flatMap((s) => s.items).filter(isActive);
	const prependSection = sections.find((s) => s.title.startsWith("↑"));
	const isPrepend = (id: string) => prependSection?.items.some((item) => item.id === id) ?? false;

	const skillLines: string[] = [];
	for (const item of items) {
		for (const name of item.skills ?? []) {
			skillLines.push(`Read ${skillPath(name)} and follow it for this task.`);
		}
	}

	const snippetItems = items.filter((item) => !item.skills);
	const prepend = snippetItems.filter((item) => isPrepend(item.id)).map((item) => item.body);
	const append = snippetItems.filter((item) => !isPrepend(item.id)).map((item) => item.body);

	return [...skillLines, ...prepend, editorText.trim(), ...append].filter(Boolean).join("\n\n");
}

export function stickyTail(
	snippets: Snippet[] = loadSnippets(),
	disabled: Set<string> = new Set(),
): { head: string[]; tail: string[] } {
	const sticky = snippets.filter((s) => s.sticky && !disabled.has(`snippet:${s.id}`));
	return {
		head: sticky.filter((s) => s.placement === "prepend").map((s) => s.body),
		tail: sticky.filter((s) => s.placement === "append").map((s) => s.body),
	};
}

export interface CockpitComponent {
	cursor: number;
	detail: boolean;
	working: { enabled: Set<string>; disabled: Set<string> };
	items: Item[];
	render: (width: number) => string[];
	handleInput: (data: string) => void;
	isActive: (item: Item) => boolean;
}

export function createCockpitComponent(options: {
	sections: Section[];
	initialEnabled?: Set<string>;
	initialDisabled?: Set<string>;
	theme: ThemeLike;
	tui?: { requestRender: () => void; terminal?: { rows?: number; cols?: number } };
	done: (result: { confirmed: boolean; enabled: Set<string>; disabled: Set<string> } | null) => void;
}): CockpitComponent {
	const { sections, theme, tui, done } = options;
	const items = sections.flatMap((s) => s.items);
	const enabled = new Set<string>(options.initialEnabled ?? []);
	const disabled = new Set<string>(options.initialDisabled ?? []);

	let cursor = 0;
	let detail = false;

	function isActive(item: Item): boolean {
		if (disabled.has(item.id)) return false;
		return item.sticky || enabled.has(item.id);
	}

	function render(width: number): string[] {
		const lines: string[] = [];
		const on = items.filter(isActive);

		const title = `${theme.fg("accent", "── Prompt Cockpit ")}${theme.fg("dim", "─".repeat(Math.max(1, width - 18)))}`;
		lines.push(truncateToWidth(title, width));

		let index = 0;
		for (const section of sections) {
			const sectionOn = section.items.filter(isActive).length;
			const gap = Math.max(1, width - visibleWidth(section.title) - visibleWidth(`${sectionOn}/${section.items.length}`) - 1);
			lines.push(
				truncateToWidth(
					`${theme.fg(section.color, section.title)}${" ".repeat(gap)}${theme.fg("dim", `${sectionOn}/${section.items.length}`)}`,
					width,
				),
			);

			for (const item of section.items) {
				const here = index === cursor;
				const mark = isActive(item) ? "[x]" : "[ ]";
				const pointer = here ? theme.fg("accent", "› ") : "  ";
				const label = here ? theme.bold(item.label) : item.label;
				const hint = item.hint ? ` ${theme.fg("dim", `— ${item.hint}`)}` : "";
				lines.push(truncateToWidth(`${pointer}${mark} ${label}${hint}`, width));
				index += 1;
			}
		}

		if (detail) {
			const current = items[cursor];
			lines.push(truncateToWidth(theme.fg("dim", "─".repeat(width)), width));
			for (const line of (current?.body ?? "").split("\n").slice(0, 10)) {
				lines.push(truncateToWidth(theme.fg("dim", line), width));
			}
		}

		lines.push(truncateToWidth(theme.fg("dim", "─".repeat(width)), width));
		const footer = "↑↓ gez · 1-3 bölüm · Space seç · c temizle · Tab detay · Enter gönder · Esc iptal";
		const counter = `${on.length}/${items.length}`;
		const pad = Math.max(1, width - visibleWidth(footer) - visibleWidth(counter));
		lines.push(truncateToWidth(theme.fg("dim", footer) + " ".repeat(pad) + theme.fg("dim", counter), width));
		return lines;
	}

	function handleInput(data: string): void {
		if (matchesKey(data, "escape")) {
			done(null);
			return;
		}
		if (matchesKey(data, "return")) {
			done({ confirmed: true, enabled, disabled });
			return;
		}
		if (matchesKey(data, "up")) {
			cursor = (cursor - 1 + items.length) % items.length;
			tui?.requestRender();
			return;
		}
		if (matchesKey(data, "down")) {
			cursor = (cursor + 1) % items.length;
			tui?.requestRender();
			return;
		}
		if (matchesKey(data, "tab")) {
			detail = !detail;
			tui?.requestRender();
			return;
		}
		if (data === " ") {
			const item = items[cursor];
			if (item) {
				if (isActive(item)) {
					if (item.sticky) disabled.add(item.id);
					enabled.delete(item.id);
				} else {
					disabled.delete(item.id);
					enabled.add(item.id);
				}
			}
			tui?.requestRender();
			return;
		}
		if (data === "c" || data === "C") {
			const onCount = items.filter(isActive).length;
			if (onCount > 0) {
				enabled.clear();
				for (const item of items) {
					if (item.sticky) disabled.add(item.id);
				}
			} else {
				enabled.clear();
				disabled.clear();
			}
			tui?.requestRender();
			return;
		}
		if (/^[1-9]$/.test(data)) {
			const section = sections[Number(data) - 1];
			const first = section?.items[0];
			if (first) cursor = items.findIndex((item) => item.id === first.id);
			tui?.requestRender();
		}
	}

	return {
		get cursor() {
			return cursor;
		},
		set cursor(val: number) {
			cursor = val;
		},
		get detail() {
			return detail;
		},
		working: { enabled, disabled },
		items,
		render,
		handleInput,
		isActive,
	};
}

export default function (pi: ExtensionAPI): void {
	let enabled = new Set<string>(); // explicitly turned on
	let disabled = new Set<string>(); // sticky items explicitly turned off

	function isActive(item: Item): boolean {
		if (disabled.has(item.id)) return false;
		return item.sticky || enabled.has(item.id);
	}

	function activeItems(sections: Section[]): Item[] {
		return sections.flatMap((s) => s.items).filter(isActive);
	}

	function reset(): void {
		enabled = new Set();
	}

	function badges(ctx: ExtensionContext): void {
		const sections = buildSections();
		const items = activeItems(sections);
		if (items.length === 0) {
			ctx.ui.setWidget(BADGE_WIDGET, undefined);
			return;
		}
		const theme = ctx.ui.theme;
		ctx.ui.setWidget(BADGE_WIDGET, [items.map((item) => theme.fg("accent", `[${item.label}]`)).join(" ")]);
	}

	async function open(ctx: ExtensionContext): Promise<void> {
		const sections = buildSections();
		if (sections.length === 0) {
			ctx.ui.notify("No snippets or skills found", "warning");
			return;
		}

		const result = await ctx.ui.custom<{ confirmed: boolean; enabled: Set<string>; disabled: Set<string> } | null>(
			(tui, theme, _keybindings, done) => {
				const comp = createCockpitComponent({
					sections,
					initialEnabled: enabled,
					initialDisabled: disabled,
					theme,
					tui,
					done,
				});
				return {
					render: (width) => comp.render(width),
					handleInput: (data) => comp.handleInput(data),
					invalidate: () => {},
				};
			},
		);

		if (!result || !result.confirmed) {
			badges(ctx);
			return;
		}

		enabled = result.enabled;
		disabled = result.disabled;

		const message = assemblePrompt(sections, isActive, ctx.ui.getEditorText());
		if (!message) {
			ctx.ui.notify("Nothing selected and the editor is empty", "warning");
			return;
		}

		const sent = activeItems(sections).map((item) => item.label);
		ctx.ui.setEditorText("");
		reset();
		badges(ctx);
		pi.sendUserMessage(
			message,
			ctx.isIdle() ? { expandPromptTemplates: false } : { deliverAs: "followUp", expandPromptTemplates: false },
		);
		ctx.ui.notify(`${ctx.isIdle() ? "Sent" : "Queued"} · ${sent.join(", ")}`, "info");
	}

	pi.registerShortcut("alt+s", {
		description: "Open the prompt cockpit (snippets, skills)",
		handler: async (ctx) => {
			await open(ctx);
		},
	});

	pi.registerCommand("snippets", {
		description: "Open the prompt cockpit (snippets, skills)",
		handler: async (_args, ctx) => {
			await open(ctx);
		},
	});

	pi.registerCommand("cockpit", {
		description: "Open the prompt cockpit (snippets, skills)",
		handler: async (_args, ctx) => {
			await open(ctx);
		},
	});

	// Sticky snippets must reach every typed message, not only cockpit sends.
	pi.on("input", async (event) => {
		if (event.source === "extension") return { action: "continue" as const };
		const text = event.text ?? "";
		if (!text.trim() || text.startsWith("/") || text.startsWith("!")) return { action: "continue" as const };
		const { head, tail } = stickyTail(loadSnippets(), disabled);
		if (head.length === 0 && tail.length === 0) return { action: "continue" as const };
		const next = [...head, text, ...tail].filter(Boolean).join("\n\n");
		return { action: "transform" as const, text: next };
	});

	pi.on("session_start", async (_event, ctx) => {
		enabled = new Set();
		disabled = new Set();
		badges(ctx);
	});
}
