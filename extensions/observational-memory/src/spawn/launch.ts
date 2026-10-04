/**
 * Subprocess worker launch — headless `omp --print -e <ext>` with the prompt on stdin (L2).
 *
 * NOT the subagents extension: that uses `--no-session --mode json`, which would defeat
 * decision 11's requirement that every worker be an ordinary recorded GLOBAL session. We
 * spawn a plain headless `pi` with no `--session-dir`, so the run is recorded under the
 * project path in `~/.pi/agent/sessions` and is openable in the session browser.
 */
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import type { ConfiguredModel } from "../config.js";
import { runCostPath, runResultPath } from "./runs.js";

/** Repo root = two levels up from src/spawn/. The shared agent extension lives at agent/index.ts. */
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const AGENT_EXTENSION_PATH = join(REPO_ROOT, "agent", "index.ts");

export function modelArg(model: ConfiguredModel): string {
	return `${model.provider}/${model.id}`;
}

/** Headless omp worker. OMP is a compiled binary, so do not re-exec process.argv. */
export function resolvePiBinary(): { command: string; baseArgs: string[] } {
	const fromEnv = process.env.OMP_BIN || process.env.PI_OM_BIN;
	if (fromEnv && fromEnv.trim().length > 0) return { command: fromEnv.trim(), baseArgs: [] };
	return { command: "omp", baseArgs: [] };
}

export function buildWorkerArgv(opts: {
	model: ConfiguredModel;
	sessionName: string;
	agentExtensionPath?: string;
}): string[] {
	const pi = resolvePiBinary();
	const args = [
		...pi.baseArgs,
		"--print",
		"--no-extensions",
		"--no-skills",
		"--no-rules",
		"--no-tools",
		"--no-title",
		"--auto-approve",
		"--approval-mode",
		"yolo",
		"--model",
		modelArg(opts.model),
	];
	if (opts.model.thinking) args.push("--thinking", opts.model.thinking);
	args.push("-e", opts.agentExtensionPath ?? AGENT_EXTENSION_PATH);
	// Session name is carried only as a comment in the prompt header; omp has no `-n`.
	// The kickoff prompt is NOT an argv element. Linux rejects a single argument at
	// MAX_ARG_STRLEN (128KiB, including the trailing NUL) with E2BIG before omp starts.
	// A chunk that keeps a tool call with its result routinely exceeds that. Print mode
	// reads the prompt from stdin instead (`spawnWorker` `stdin`).
	void opts.sessionName;
	return [pi.command, ...args];
}

export type WorkerExit = { code: number | null; signal: NodeJS.Signals | null; stderr: string };

/**
 * Spawn a headless worker; resolve when it exits. Workers run in their master session's
 * `.memory/<sessionId>/` root (not the project cwd) so pi keys the run into a distinct global
 * session bucket and it never clutters the project's `/resume` picker. The root is ensured to
 * exist before spawn — `spawn()` would ENOENT otherwise (the memory root is created lazily on
 * first durable write when there is no parent to seed).
 */
export function spawnWorker(opts: {
	argv: string[];
	cwd: string;
	env: NodeJS.ProcessEnv;
	signal?: AbortSignal;
	/** Print-mode user prompt. Piped, then closed. Never placed on argv. */
	stdin?: string;
}): Promise<WorkerExit> {
	const [command, ...rest] = opts.argv;
	mkdirSync(opts.cwd, { recursive: true });
	return new Promise<WorkerExit>((resolvePromise) => {
		const proc = spawn(command, rest, {
			cwd: opts.cwd,
			env: opts.env,
			stdio: [opts.stdin !== undefined ? "pipe" : "ignore", "ignore", "pipe"],
		});
		let stderr = "";
		proc.stderr?.on("data", (d: Buffer) => {
			stderr += d.toString();
		});
		proc.on("error", (err: Error) => {
			const message = err instanceof Error ? err.message : String(err);
			resolvePromise({ code: 1, signal: null, stderr: stderr || message || "spawn error" });
		});
		proc.on("close", (code, signal) => resolvePromise({ code, signal, stderr }));
		if (opts.stdin !== undefined && proc.stdin) {
			// EPIPE if the child exits before the pipe drains. Must not surface as an
			// unhandled error on the master process. Write only after exit listeners
			// are attached so a synchronous close cannot leave the promise pending.
			proc.stdin.on("error", () => {});
			proc.stdin.end(opts.stdin);
		}

		if (opts.signal) {
			const kill = () => {
				proc.kill("SIGTERM");
				setTimeout(() => {
					if (!proc.killed) proc.kill("SIGKILL");
				}, 3000).unref?.();
			};
			if (opts.signal.aborted) kill();
			else opts.signal.addEventListener("abort", kill, { once: true });
		}
	});
}

export type ObserverLaunchEnv = {
	/** Absolute `.memory/<sessionId>/` root — IPC files and the consolidator sandbox live here. */
	memoryRoot: string;
	runId: string;
};

/**
 * Build the env a worker subprocess needs to write its result file. The chunk itself is NOT
 * passed via env or argv — `spawnWorker` pipes it to stdin, and omp `--print` records that
 * text as the user message so the run stays inspectable on resume.
 */
export function buildWorkerEnv(role: "observer" | "consolidator", opts: ObserverLaunchEnv): NodeJS.ProcessEnv {
	return {
		...process.env,
		OM_WORKER: role,
		OM_RUN_ID: opts.runId,
		OM_RESULT_PATH: runResultPath(opts.memoryRoot, opts.runId),
		// Per-run cost handoff: the worker extension writes pi's built-in usage.cost.total here.
		OM_COST_PATH: runCostPath(opts.memoryRoot, opts.runId),
		// Sandbox root for the consolidator's scoped file tools (design risk 6).
		OM_MEMORY_DIR: opts.memoryRoot,
	};
}
