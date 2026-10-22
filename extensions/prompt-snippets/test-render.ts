import {
	createSnippetsMenuComponent,
	formatBadges,
	loadSnippets,
	MAGIC_KEYWORDS,
	EXECUTION_MODES,
	type ThemeLike,
} from "./index.js";

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
	console.log(`Magic keywords: ${MAGIC_KEYWORDS.length}, Execution modes: ${EXECUTION_MODES.length}`);

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
	// Test quick jump keys (1: Keywords, 2: Exec, 3: Prepend, 4: Append)
	component.handleInput("1");
	if (component.cursor !== 0) throw new Error(`Key '1' did not jump to index 0, got ${component.cursor}`);
	component.handleInput("2");
	if (component.cursor !== 4) throw new Error(`Key '2' did not jump to index 4, got ${component.cursor}`);
	component.handleInput("3");
	if (component.cursor !== 6) throw new Error(`Key '3' did not jump to index 6, got ${component.cursor}`);
	component.handleInput("4");
	if (component.cursor !== 8) throw new Error(`Key '4' did not jump to index 8, got ${component.cursor}`);
	console.log("Quick jump keys '1', '2', '3', '4' passed successfully.");

	// Test 'c' key to clear all active selections
	component.handleInput("c");
	if (component.working.size !== 0) throw new Error(`Key 'c' did not clear all selections, size is ${component.working.size}`);
	console.log("Quick clear key 'c' passed successfully (working set cleared).");

	// Re-select for subsequent tests
	component.handleInput("2"); // jump to exec:loop_test
	component.handleInput(" "); // toggle exec:loop_test on

	// 4. Tab to Preview mode
	console.log("\n\x1b[1m--- 4. PREVIEW RENDERING ---\x1b[0m");
	component.handleInput("\t");
	console.log(`Mode after Tab: ${component.mode}`);
	if (component.mode !== "preview") throw new Error("Expected mode to be preview!");

	const previewLines = component.render(90);
	console.log(previewLines.join("\n"));

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
