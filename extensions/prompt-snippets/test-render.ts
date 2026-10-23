import {
	assemblePrompt,
	availableSkills,
	createSnippetsMenuComponent,
	formatBadges,
	loadSnippets,
	MAGIC_KEYWORDS,
	EXECUTION_MODES,
	SKILLS,
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

	const snippets = loadSnippets();
	if (snippets.length === 0) {
		throw new Error("No snippets loaded from snippets directory!");
	}
	console.log(`Loaded ${snippets.length} curated snippets successfully.`);
	console.log(
		`Magic keywords: ${MAGIC_KEYWORDS.length}, Execution modes: ${EXECUTION_MODES.length}, Skills: ${SKILLS.length}`,
	);

	// 1. Test badges formatting
	console.log("\n\x1b[1m--- 1. BADGES (Above Editor Widget) ---\x1b[0m");
	const sampleEnabled = new Set([
		"kw:orchestrate",
		"exec:loop_test",
		"resume-orient.md",
		"strict-verify.md",
	]);
	const badges = formatBadges(snippets, sampleEnabled, testTheme);
	console.log("Empty badges:", formatBadges(snippets, new Set(), testTheme));
	console.log("Sample badges:", badges[0]);
	if (
		!badges[0].includes("orchestrate") ||
		!badges[0].includes("Loop: until test") ||
		!badges[0].includes("Resume & Orient") ||
		!badges[0].includes("Strict Verification")
	) {
		throw new Error("Badge pills do not contain expected items!");
	}
	const skillBadges = formatBadges(snippets, new Set(["skill:ask-pocock"]), testTheme);
	if (!skillBadges[0]?.includes("ask-pocock")) throw new Error("Skill badge is missing");

	let renderRequests = 0;
	let finishResult: { confirmed: boolean; working: Set<string> } | null = null;

	const mockTui = {
		terminal: { rows: 30, cols: 90 },
		requestRender: () => {
			renderRequests++;
		},
	};

	const component = createSnippetsMenuComponent({
		snippets,
		initialEnabled: sampleEnabled,
		tui: mockTui,
		theme: testTheme,
		done: (confirmed, result) => {
			finishResult = { confirmed, working: result };
		},
	});

	// 2. Render List at 90 cols
	console.log("\n\x1b[1m--- 2. COCKPIT LIST RENDERING (90 columns) ---\x1b[0m");
	const lines90 = component.render(90);
	console.log(lines90.join("\n"));

	// 2b. Layout invariants: no line overflows, descriptions survive narrow widths.
	console.log("\n\x1b[1m--- 2b. LAYOUT INVARIANTS (60 / 90 / 120 columns) ---\x1b[0m");
	for (const width of [60, 90, 120]) {
		const tall = createSnippetsMenuComponent({
			snippets,
			initialEnabled: sampleEnabled,
			tui: { terminal: { rows: 60 }, requestRender: () => {} },
			theme: testTheme,
			done: () => {},
		});
		const lines = tall.render(width);
		for (const line of lines) {
			const w = visibleWidth(line);
			if (w > width) throw new Error(`Line overflows at width ${width} (${w}): ${line.replace(/\x1b\[[0-9;]*m/g, "")}`);
		}
		const flat = lines.join(" ").replace(/\x1b\[[0-9;]*m/g, "").replace(/\s+/g, " ");
		for (const needle of ["En küçük çürütücü komutu koş", "Daha derin istem", "Üç satır", "iki viewport"]) {
			if (!flat.includes(needle)) {
				throw new Error(`Description text lost at width ${width}: "${needle}"`);
			}
		}
	}
	const flat90 = lines90.join(" ").replace(/\x1b\[[0-9;]*m/g, "").replace(/\s+/g, " ");
	const emptyComponent = createSnippetsMenuComponent({
		snippets,
		initialEnabled: new Set(),
		tui: mockTui,
		theme: testTheme,
		done: () => {},
	});
	const emptyFlat = emptyComponent.render(90).join(" ").replace(/\x1b\[[0-9;]*m/g, "").replace(/\s+/g, " ");
	if (!emptyFlat.includes("Bu bir todo listesi değil")) {
		throw new Error("Empty-selection state line is missing or truncated");
	}
	if (!flat90.includes("4 seçim bir sonraki mesaja")) {
		throw new Error("Selection count line is missing or wrong");
	}
	if (!flat90.includes("1/4") || !flat90.includes("1/2")) {
		throw new Error("Section counters are missing");
	}
	console.log("No overflow at 60/90/120; descriptions and counters intact.");

	// 2c. Narrow viewport: the last item's wrapped continuation rows stay visible.
	const narrowComponent = createSnippetsMenuComponent({
		snippets,
		initialEnabled: new Set(),
		tui: { terminal: { rows: 24 }, requestRender: () => {} },
		theme: testTheme,
		done: () => {},
	});
	narrowComponent.handleInput("4");
	narrowComponent.handleInput("\x1b[B");
	const narrowFlat = narrowComponent
		.render(60)
		.join(" ")
		.replace(/\x1b\[[0-9;]*m/g, "")
		.replace(/\s+/g, " ");
	if (!narrowFlat.includes("Check Real UI") || !narrowFlat.includes("iki viewport")) {
		throw new Error("Narrow viewport hides the last item's wrapped description");
	}
	console.log("Narrow 60x24 viewport keeps the last wrapped item fully visible.");

	// 3. Test Key Navigation & Mutually Exclusive Execution Mode
	console.log("\n\x1b[1m--- 3. KEYBOARD NAVIGATION & MUTUAL EXCLUSIVITY ---\x1b[0m");
	console.log(`Initial cursor: ${component.cursor}, active count: ${component.working.size}`);

	// Toggle item 0 (kw:orchestrate) off
	component.handleInput(" ");
	console.log(`After Space on kw:orchestrate: active kw:orchestrate = ${component.working.has("kw:orchestrate")}`);
	if (component.working.has("kw:orchestrate")) throw new Error("Expected kw:orchestrate to be toggled off!");

	// Move down to execution mode section (index 4 is exec:loop_test, index 5 is exec:loop_3x)
	for (let i = 0; i < 5; i++) component.handleInput("\x1b[B");
	console.log(`Cursor moved to index ${component.cursor} (exec:loop_3x)`);

	// exec:loop_test was active in initialEnabled. Now toggle exec:loop_3x:
	component.handleInput(" ");
	console.log(`After Space on exec:loop_3x:`);
	console.log(`  exec:loop_test = ${component.working.has("exec:loop_test")}`);
	console.log(`  exec:loop_3x = ${component.working.has("exec:loop_3x")}`);

	if (component.working.has("exec:loop_test")) {
		throw new Error("exec:loop_test was not cleared when exec:loop_3x was selected!");
	}
	if (!component.working.has("exec:loop_3x")) {
		throw new Error("exec:loop_3x was not selected!");
	}
	// Test quick jump keys (1: Keywords, 2: Exec, 3: Skills, 4: Prepend, 5: Append)
	const installedSkills = availableSkills();
	const prepStart = MAGIC_KEYWORDS.length + EXECUTION_MODES.length;
	const appStart = prepStart + snippets.filter((s) => s.placement === "prepend").length;
	const skillStart = appStart + snippets.filter((s) => s.placement === "append").length;
	const jumps: [string, number][] = [
		["1", 0],
		["2", MAGIC_KEYWORDS.length],
		["3", prepStart],
		["4", appStart],
		...(installedSkills.length > 0 ? ([["5", skillStart]] as [string, number][]) : []),
	];
	for (const [key, expected] of jumps) {
		component.handleInput(key);
		if (component.cursor !== expected) {
			throw new Error(`Key '${key}' did not jump to index ${expected}, got ${component.cursor}`);
		}
	}
	if (installedSkills.length === 0) {
		component.handleInput("1");
		component.handleInput("5");
		if (component.cursor !== 0) throw new Error("Key '5' moved the cursor with no installed skills");
	}
	console.log("Quick jump keys verified against installed skills.");

	// Test 'c' key to clear all active selections
	component.handleInput("c");
	if (component.working.size !== 0) throw new Error(`Key 'c' did not clear all selections, size is ${component.working.size}`);
	console.log("Quick clear key 'c' passed successfully (working set cleared).");

	// Re-select for subsequent tests
	component.handleInput("2"); // jump to exec:loop_test
	component.handleInput(" "); // toggle exec:loop_test on

	// 3b. Prompt assembly: skill directive goes before the user text.
	const assembled = assemblePrompt(
		new Set(["exec:loop_test", "kw:ultrathink", "skill:ask-pocock", "resume-orient.md", "strict-verify.md"]),
		snippets,
		"görevi yap",
	);
	const pocockInstalled = installedSkills.some((s) => s.id === "skill:ask-pocock");
	const order = [
		"/loop --until",
		"ultrathink",
		...(pocockInstalled ? ["Read skill://ask-pocock/SKILL.md and follow it for this task."] : []),
		"Answer in three lines",
		"görevi yap",
		"smallest command",
	];
	if (!pocockInstalled && assembled.includes("skill://ask-pocock")) {
		throw new Error("Assembly injected a directive for a missing skill");
	}
	let cursorAt = -1;
	for (const needle of order) {
		const at = assembled.indexOf(needle);
		if (at < 0) throw new Error(`Assembled prompt is missing: ${needle}`);
		if (at < cursorAt) throw new Error(`Assembled prompt order is wrong at: ${needle}`);
		cursorAt = at;
	}
	console.log("Skill directive and section order verified.");

	// 4. Tab to Preview mode
	console.log("\n\x1b[1m--- 4. PREVIEW RENDERING ---\x1b[0m");
	component.handleInput("\t");
	console.log(`Mode after Tab: ${component.mode}`);
	if (component.mode !== "preview") throw new Error("Expected mode to be preview!");

	const previewLines = component.render(90);
	console.log(previewLines.join("\n"));
	for (const width of [60, 90]) {
		for (const line of component.render(width)) {
			if (line.replace(/\x1b\[[0-9;]*m/g, "").includes("…")) {
				throw new Error(`Preview truncated with ellipsis at width ${width}: ${line}`);
			}
		}
	}

	// Tab back to list
	component.handleInput("\t");
	console.log(`Mode after Tab back: ${component.mode}`);
	if (component.mode !== "list") throw new Error("Expected mode to be list!");

	// 5. Enter to apply
	component.handleInput("\r");
	if (!finishResult || !finishResult.confirmed) {
		throw new Error("Enter key did not confirm done(true)!");
	}
	console.log("\nEnter key confirmed successfully:", finishResult);

	// 6. Test Esc key to cancel
	let cancelResult: { confirmed: boolean; working: Set<string> } | null = null;
	const cancelComponent = createSnippetsMenuComponent({
		snippets,
		initialEnabled: new Set(),
		tui: mockTui,
		theme: testTheme,
		done: (confirmed, result) => {
			cancelResult = { confirmed, working: result };
		},
	});
	cancelComponent.handleInput("\x1b");
	if (!cancelResult || cancelResult.confirmed) {
		throw new Error("Escape key did not cancel done(false)!");
	}
	console.log("Escape key cancelled successfully:", cancelResult);

	console.log("\n\x1b[32m✔ ALL COCKPIT TUI & KEYBOARD NAVIGATION TESTS PASSED SUCCESSFULLY!\x1b[0m\n");
}

runTests();
