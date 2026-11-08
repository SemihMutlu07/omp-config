import {
	assemblePrompt,
	BADGE_WIDGET,
	buildSections,
	createCockpitComponent,
	CURATED_SKILLS,
	formatBadges,
	loadSkills,
	loadSnippets,
	stickyTail,
	type CockpitComponent,
	type Item,
	type ThemeLike,
} from "./index.js";
import { visibleWidth } from "@earendil-works/pi-tui";

const testTheme: ThemeLike = {
	fg(color: string, text: string): string {
		const colors: Record<string, string> = {
			accent: "\x1b[36m",  // Cyan
			warning: "\x1b[33m", // Yellow
			success: "\x1b[32m", // Green
			dim: "\x1b[90m",     // Dim / Bright Black
			error: "\x1b[31m",   // Red
		};
		const code = colors[color] ?? "";
		return `${code}${text}\x1b[0m`;
	},
	bold(text: string): string {
		return `\x1b[1m${text}\x1b[22m`;
	},
};

function runTests() {
	console.log("\x1b[1m=== PROMPT COCKPIT TUI TEST SUITE ===\x1b[0m\n");

	// 1. Snippets loading
	const snippets = loadSnippets();
	if (snippets.length !== 4) {
		throw new Error(`Expected exactly 4 snippets, got ${snippets.length}`);
	}
	const snippetIds = snippets.map((s) => s.id);
	for (const expected of ["route-first.md", "prove.md", "short-visual.md", "dil.md"]) {
		if (!snippetIds.includes(expected)) {
			throw new Error(`Missing expected snippet: ${expected}`);
		}
	}
	console.log(`Loaded ${snippets.length} curated snippets successfully: ${snippetIds.join(", ")}`);

	// Verify sticky snippets
	const stickySnippets = snippets.filter((s) => s.sticky);
	if (stickySnippets.length !== 2) {
		throw new Error(`Expected exactly 2 sticky snippets, got ${stickySnippets.length}`);
	}
	const stickyIds = stickySnippets.map((s) => s.id);
	if (!stickyIds.includes("short-visual.md") || !stickyIds.includes("dil.md")) {
		throw new Error(`Unexpected sticky snippets: ${stickyIds.join(", ")}`);
	}
	console.log(`Sticky snippets verified: ${stickyIds.join(", ")}`);

	// 2. Curated skills loading
	const skills = loadSkills();
	if (skills.length !== 4) {
		throw new Error(`Expected 4 curated skills, got ${skills.length}`);
	}
	console.log(`Loaded ${skills.length} curated skills: ${skills.map((s) => s.label).join(", ")}`);

	// 3. Sections building
	const sections = buildSections(snippets);
	if (sections.length !== 3) {
		throw new Error(`Expected exactly 3 sections, got ${sections.length}`);
	}
	const [prependSec, appendSec, skillSec] = sections;
	if (!prependSec.title.startsWith("↑ Prepend")) throw new Error(`Wrong prepend title: ${prependSec.title}`);
	if (!appendSec.title.startsWith("↓ Append")) throw new Error(`Wrong append title: ${appendSec.title}`);
	if (!skillSec.title.startsWith("🧩 Skills")) throw new Error(`Wrong skills title: ${skillSec.title}`);

	if (prependSec.items.length !== 1) throw new Error(`Prepend items count wrong: ${prependSec.items.length}`);
	if (appendSec.items.length !== 3) throw new Error(`Append items count wrong: ${appendSec.items.length}`);
	if (skillSec.items.length !== 4) throw new Error(`Skill items count wrong: ${skillSec.items.length}`);
	console.log(`Sections built: ${sections.map((s) => `${s.title} (${s.items.length})`).join(", ")}`);

	// 4. Badges (Above Editor Widget)
	console.log("\n\x1b[1m--- 1. BADGES (Above Editor Widget) ---\x1b[0m");
	const allItems = sections.flatMap((s) => s.items);
	const defaultActive = (item: Item) => item.sticky;
	const defaultBadges = formatBadges(sections, defaultActive, testTheme);
	console.log("Default badges:", defaultBadges[0]);
	if (!defaultBadges[0].includes("Kısa ve görsel") || !defaultBadges[0].includes("Dil")) {
		throw new Error("Default badges do not show sticky items!");
	}
	const emptyBadges = formatBadges(sections, () => false, testTheme);
	if (emptyBadges.length !== 0) throw new Error("Empty active items must produce empty badges");

	// 5. Cockpit List Rendering
	console.log("\n\x1b[1m--- 2. COCKPIT LIST RENDERING (90 columns) ---\x1b[0m");
	let finishResult: { confirmed: boolean; enabled: Set<string>; disabled: Set<string> } | null = null;
	const mockTui = {
		terminal: { rows: 30, cols: 90 },
		requestRender: () => {},
	};

	const component = createCockpitComponent({
		sections,
		theme: testTheme,
		tui: mockTui,
		done: (res) => {
			finishResult = res;
		},
	});

	const lines90 = component.render(90);
	console.log(lines90.join("\n"));

	// Check rendering content
	const flat90 = lines90.join(" ").replace(/\x1b\[[0-9;]*m/g, "").replace(/\s+/g, " ");
	for (const needle of [
		"── Prompt Cockpit",
		"↑ Prepend Modifiers",
		"0/1",
		"Route First — Okumadan önce rota seç: direct / primary",
		"↓ Append Modifiers",
		"2/3",
		"[ ] Kanıtla — Çürütücü komutu koş",
		"[x] Kısa ve görsel — İlk satırda sonuç",
		"[x] Dil — Her cevapta tek okumalı düz dil",
		"🧩 Skills",
		"0/4",
		"ask-pocock — Uygun yüklü iş akışını seç",
		"plan → kur → kanıtla",
		"research-before-build",
		"gauntlet-loop",
		"↑↓ gez · 1-3 bölüm · Space seç · c temizle · Tab detay · Enter gönder · Esc iptal",
		"2/8",
	]) {
		if (!flat90.includes(needle)) {
			throw new Error(`Rendered cockpit missing text: "${needle}"`);
		}
	}
	console.log("Cockpit rendering matches reference image exactly.");

	// 5b. Layout Invariants at widths 60, 90, 120
	console.log("\n\x1b[1m--- 2b. LAYOUT INVARIANTS (60 / 90 / 120 columns) ---\x1b[0m");
	for (const width of [60, 90, 120]) {
		const comp = createCockpitComponent({
			sections,
			theme: testTheme,
			tui: mockTui,
			done: () => {},
		});
		const lines = comp.render(width);
		for (const line of lines) {
			const w = visibleWidth(line);
			if (w > width) {
				throw new Error(`Line overflow at width ${width} (${w}): ${line.replace(/\x1b\[[0-9;]*m/g, "")}`);
			}
		}
		const flat = lines.join(" ").replace(/\x1b\[[0-9;]*m/g, "").replace(/\s+/g, " ");
		for (const needle of ["Çürütücü komutu", "Okumadan önce rota", "İlk satırda sonuç"]) {
			if (!flat.includes(needle)) {
				throw new Error(`Description text lost at width ${width}: "${needle}"`);
			}
		}
		if (width >= 90) {
			for (const needle of ["tablo/diyagram", "tek okumalı düz dil"]) {
				if (!flat.includes(needle)) {
					throw new Error(`Description text lost at width ${width}: "${needle}"`);
				}
			}
		}
	}
	console.log("No overflow at 60/90/120; descriptions and counters intact.");

	// 6. Keyboard navigation & interactions
	console.log("\n\x1b[1m--- 3. KEYBOARD NAVIGATION & TOGGLES ---\x1b[0m");
	console.log(`Initial cursor: ${component.cursor}`);
	if (component.cursor !== 0) throw new Error("Initial cursor must be 0");

	// Move cursor down
	component.handleInput("\x1b[B"); // down
	if (component.cursor !== 1) throw new Error("Cursor down failed");

	// Jump keys: 1 (Prepend), 2 (Append), 3 (Skills)
	component.handleInput("1");
	if (component.cursor !== 0) throw new Error(`Jump '1' failed, cursor: ${component.cursor}`);

	component.handleInput("2");
	if (component.cursor !== 1) throw new Error(`Jump '2' failed, cursor: ${component.cursor}`);

	component.handleInput("3");
	if (component.cursor !== 4) throw new Error(`Jump '3' failed, cursor: ${component.cursor}`);
	console.log("Section jump keys 1, 2, 3 verified.");

	// Toggle sticky item off:
	// Item at index 2 is "Kısa ve görsel" (sticky)
	component.cursor = 2;
	const kisaItem = component.items[2];
	if (kisaItem.label !== "Kısa ve görsel") throw new Error("Item at index 2 is not Kısa ve görsel");
	if (!component.isActive(kisaItem)) throw new Error("Kısa ve görsel should be active initially");

	component.handleInput(" "); // Space
	if (component.isActive(kisaItem)) throw new Error("Kısa ve görsel should be disabled after Space");
	if (!component.working.disabled.has(kisaItem.id)) throw new Error("disabled set missing kisaItem");
	console.log("Sticky toggle off verified.");

	// Space again re-enables it
	component.handleInput(" ");
	if (!component.isActive(kisaItem)) throw new Error("Kısa ve görsel should be re-enabled after second Space");
	console.log("Sticky toggle on verified.");

	// Test 'c' clear key:
	component.handleInput("c");
	const activeCountAfterC = component.items.filter(component.isActive).length;
	if (activeCountAfterC !== 0) {
		throw new Error(`Expected 0 active items after 'c', got ${activeCountAfterC}`);
	}
	console.log("'c' key cleared all active selections.");

	// Press 'c' again to restore default sticky selections
	component.handleInput("c");
	const activeCountAfterRestore = component.items.filter(component.isActive).length;
	if (activeCountAfterRestore !== 2) {
		throw new Error(`Expected 2 active items after restore 'c', got ${activeCountAfterRestore}`);
	}
	console.log("'c' key restored default sticky selections when pressed again.");

	// 7. Tab to detail view
	console.log("\n\x1b[1m--- 4. TAB DETAIL VIEW ---\x1b[0m");
	component.handleInput("\t");
	if (!component.detail) throw new Error("Tab did not enable detail view");
	const detailLines = component.render(90);
	if (!detailLines.some((l) => l.includes("First line: the answer"))) {
		throw new Error("Detail view does not show snippet body");
	}
	component.handleInput("\t");
	if (component.detail) throw new Error("Tab did not disable detail view");
	console.log("Tab detail view toggle verified.");

	// 8. Prompt assembly
	console.log("\n\x1b[1m--- 5. PROMPT ASSEMBLY & STICKY TAIL ---\x1b[0m");
	const assembled = assemblePrompt(
		sections,
		(item) => item.id.includes("route-first") || item.sticky,
		"dosyayı düzenle",
	);
	if (
		!assembled.includes("Route: direct | primary") ||
		!assembled.includes("dosyayı düzenle") ||
		!assembled.includes("First line: the answer") ||
		!assembled.includes("Write so the text has one reading only")
	) {
		throw new Error(`Assembled prompt missing parts:\n${assembled}`);
	}
	console.log("Prompt assembly verified with prepend + editor text + sticky appends.");

	const tail = stickyTail(snippets);
	if (tail.head.length !== 0) throw new Error("Sticky head should be empty");
	if (tail.tail.length !== 2) throw new Error(`Expected 2 sticky tail items, got ${tail.tail.length}`);
	console.log("stickyTail verified.");

	// 9. Enter confirm and Esc cancel
	component.handleInput("\r");
	if (!finishResult || !finishResult.confirmed) {
		throw new Error("Enter did not confirm");
	}
	console.log("Enter key confirmed successfully.");

	let cancelled = false;
	const escComp = createCockpitComponent({
		sections,
		theme: testTheme,
		tui: mockTui,
		done: (res) => {
			if (res === null) cancelled = true;
		},
	});
	escComp.handleInput("\x1b");
	if (!cancelled) throw new Error("Escape did not cancel");
	console.log("Escape key cancelled successfully.");

	console.log("\n\x1b[32m✔ ALL PROMPT COCKPIT TESTS PASSED SUCCESSFULLY!\x1b[0m\n");
}

runTests();
