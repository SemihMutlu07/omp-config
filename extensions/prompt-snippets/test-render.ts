import {
	assemblePrompt,
	availableSkills,
	availableStacks,
	createSnippetsMenuComponent,
	formatBadges,
	loadSnippets,
	MAGIC_KEYWORDS,
	EXECUTION_MODES,
	SKILLS,
	skillExists,
	STACKS,
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
		`Magic keywords: ${MAGIC_KEYWORDS.length}, Execution modes: ${EXECUTION_MODES.length}, Stacks: ${STACKS.length}, Skills: ${SKILLS.length}`,
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
	// Test quick jump keys (1: Keywords, 2: Exec, 3: Prepend, 4: Append, 5: Stacks, 6: Skills)
	const installedSkills = availableSkills();
	const installedStacks = availableStacks();
	const prepStart = MAGIC_KEYWORDS.length + EXECUTION_MODES.length;
	const appStart = prepStart + snippets.filter((s) => s.placement === "prepend").length;
	const stackStart = appStart + snippets.filter((s) => s.placement === "append").length;
	const skillStart = stackStart + installedStacks.length;
	const jumps: [string, number][] = [
		["1", 0],
		["2", MAGIC_KEYWORDS.length],
		["3", prepStart],
		["4", appStart],
		...(installedStacks.length > 0 ? ([["5", stackStart]] as [string, number][]) : []),
		...(installedSkills.length > 0 ? ([["6", skillStart]] as [string, number][]) : []),
	];
	for (const [key, expected] of jumps) {
		component.handleInput(key);
		if (component.cursor !== expected) {
			throw new Error(`Key '${key}' did not jump to index ${expected}, got ${component.cursor}`);
		}
	}
	if (installedSkills.length === 0) {
		component.handleInput("1");
		component.handleInput("6");
		if (component.cursor !== 0) throw new Error("Key '6' moved the cursor with no installed skills");
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

	// 3c. Stacks expand to their members and never emit a duplicate read directive.
	if (installedStacks.length === 0) throw new Error("No runnable stack; a member skill is missing on disk");
	// A stack that silently vanishes is a bug: name every unlinked member instead.
	if (installedStacks.length !== STACKS.length) {
		const broken = STACKS.filter((s) => !installedStacks.includes(s))
			.map((s) => `${s.name} (${s.skills.filter((m) => !skillExists(m)).join(", ")})`)
			.join("; ");
		throw new Error(`Stack hidden by a missing member: ${broken}`);
	}
	for (const stack of installedStacks) {
		for (const member of stack.skills) {
			if (!skillExists(member)) {
				throw new Error(`Stack "${stack.name}" lists an uninstalled skill: ${member}`);
			}
		}
	}
	const pair = installedStacks
		.flatMap((st) => st.skills.map((member) => ({ stack: st, member })))
		.find(({ member }) => installedSkills.some((s) => s.skill === member));
	if (!pair) throw new Error("No stack member is also a selectable single skill");
	const stackPrompt = assemblePrompt(new Set([pair.stack.id]), snippets, "görevi yap");
	for (const member of pair.stack.skills) {
		if (!stackPrompt.includes(`Read skill://${member}/SKILL.md`)) {
			throw new Error(`Stack "${pair.stack.name}" did not expand member ${member}`);
		}
	}
	if (stackPrompt.indexOf("Read skill://") > stackPrompt.indexOf("görevi yap")) {
		throw new Error("Stack directives were appended after the user text");
	}
	const repeated = assemblePrompt(new Set([pair.stack.id, `skill:${pair.member}`]), snippets, "görevi yap");
	const occurrences = repeated.split(`Read skill://${pair.member}/SKILL.md`).length - 1;
	if (occurrences !== 1) {
		throw new Error(`Stack plus its own member emitted ${occurrences} directives for ${pair.member}`);
	}
	const stackBadge = formatBadges(snippets, new Set([pair.stack.id]), testTheme);
	if (!stackBadge[0]?.includes(`${pair.stack.name} ×${pair.stack.skills.length}`)) {
		throw new Error("Stack badge is missing");
	}
	console.log(`Stacks expand once: ${installedStacks.length} runnable, ${pair.stack.name} → ${pair.stack.skills.join(" + ")}.`);

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

	// 7. Stack preview lists every member and never truncates a skill path.
	const stackPreview = createSnippetsMenuComponent({
		snippets,
		initialEnabled: new Set(),
		tui: { terminal: { rows: 40 }, requestRender: () => {} },
		theme: testTheme,
		done: () => {},
	});
	stackPreview.handleInput("5");
	const focusedStack = installedStacks[0];
	stackPreview.handleInput("\t");
	if (stackPreview.mode !== "preview") throw new Error("Stack preview did not open");
	const stackPreviewFlat = stackPreview
		.render(90)
		.join(" ")
		.replace(/\x1b\[[0-9;]*m/g, "")
		.replace(/\s+/g, " ");
	if (!stackPreviewFlat.includes("Üyeler:") || !stackPreviewFlat.includes(`Stack · ${focusedStack.skills.length} skill`)) {
		throw new Error("Stack preview is missing its member heading");
	}
	for (const member of focusedStack.skills) {
		if (!stackPreviewFlat.includes(`skill://${member}/SKILL.md`)) {
			throw new Error(`Stack preview hides member ${member}`);
		}
	}
	console.log(`Stack preview verified: ${focusedStack.name} (${focusedStack.skills.length} members).`);

	console.log("\n\x1b[32m✔ ALL COCKPIT TUI & KEYBOARD NAVIGATION TESTS PASSED SUCCESSFULLY!\x1b[0m\n");
}

runTests();
