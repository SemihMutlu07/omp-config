/**
 * DeepSeek Off-Peak Status
 *
 * Shows in the footer whether DeepSeek API calls are billed at off-peak
 * (cheaper) or peak (full price) rates, so you can decide when to run
 * expensive batches.
 *
 * Rule (https://api-docs.deepseek.com/quick_start/pricing):
 *   Peak: 01:00–04:00 and 06:00–10:00 UTC, Monday–Friday, excluding
 *         Chinese public holidays.
 *   Everything else is off-peak, including weekends and holidays in full.
 *   Off-peak rates are half of the peak rates.
 *
 * The status only appears while the active model is a DeepSeek model.
 */

import type { Model } from "@earendil-works/pi-ai";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

const STATUS_KEY = "deepseek-offpeak";

/**
 * omp exposes isolation-safe timers on the handler context; a raw
 * `setInterval` callback that throws tears the whole session down there.
 * Pi's context has no managed timers yet, so fall back to the globals.
 */
interface ManagedTimers {
	setInterval?: (fn: () => void, ms: number) => unknown;
	clearTimer?: (timer: unknown) => void;
}

/** Handle of the global `setInterval` a host without managed timers falls back to. */
type NativeTimerHandle = ReturnType<typeof setInterval>;

/** Peak windows as [startHour, endHour) in UTC. */
const PEAK_WINDOWS: ReadonlyArray<readonly [number, number]> = [
	[1, 4],
	[6, 10],
];

/**
 * Chinese public holidays (full off-peak days). Extend this list each year
 * from the State Council schedule; dates outside the list are treated as
 * normal weekdays.
 */
const HOLIDAYS = new Set<string>([
	// New Year
	"2026-01-01",
	"2026-01-02",
	"2026-01-03",
	// Spring Festival
	"2026-02-15",
	"2026-02-16",
	"2026-02-17",
	"2026-02-18",
	"2026-02-19",
	"2026-02-20",
	"2026-02-21",
	"2026-02-22",
	"2026-02-23",
	// Qingming
	"2026-04-04",
	"2026-04-05",
	"2026-04-06",
	// Labour Day
	"2026-05-01",
	"2026-05-02",
	"2026-05-03",
	"2026-05-04",
	"2026-05-05",
	// Dragon Boat
	"2026-06-19",
	"2026-06-20",
	"2026-06-21",
	// Mid-Autumn
	"2026-09-25",
	"2026-09-26",
	"2026-09-27",
	// National Day
	"2026-10-01",
	"2026-10-02",
	"2026-10-03",
	"2026-10-04",
	"2026-10-05",
	"2026-10-06",
	"2026-10-07",
]);

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

const pad = (n: number) => String(n).padStart(2, "0");

function isoDate(d: Date): string {
	return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

export function isPeak(d: Date): boolean {
	const dow = d.getUTCDay(); // 0 = Sunday, 6 = Saturday
	if (dow === 0 || dow === 6) return false;
	if (HOLIDAYS.has(isoDate(d))) return false;
	const hour = d.getUTCHours();
	return PEAK_WINDOWS.some(([start, end]) => hour >= start && hour < end);
}

/** First moment within the next 7 days where peak/off-peak flips, or null if none. */
export function nextChange(now: Date): Date | null {
	const current = isPeak(now);
	const start = Math.ceil(now.getTime() / MINUTE) * MINUTE;
	const horizon = now.getTime() + 7 * DAY;
	for (let t = start; t <= horizon; t += MINUTE) {
		if (isPeak(new Date(t)) !== current) return new Date(t);
	}
	return null;
}

function humanize(ms: number): string {
	const totalMinutes = Math.max(1, Math.round(ms / MINUTE));
	const days = Math.floor(totalMinutes / (24 * 60));
	const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
	const minutes = totalMinutes % 60;
	if (days > 0) return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
	if (hours === 0) return `${minutes}m`;
	if (minutes === 0) return `${hours}h`;
	return `${hours}h ${minutes}m`;
}
function isDeepSeek(model: Model<any> | undefined): boolean {
	return model?.provider === "deepseek" || (model?.id?.includes("deepseek") ?? false);
}

function renderStatus(ctx: ExtensionContext, model: Model<any> | undefined): string | undefined {
	if (!isDeepSeek(model)) return undefined;

	const now = new Date();
	const peak = isPeak(now);
	const change = nextChange(now);
	const remaining = change ? humanize(change.getTime() - now.getTime()) : ">24h";
	const theme = ctx.ui.theme;

	if (peak) {
		return (
			theme.fg("error", "🔴 deepseek peak") +
			theme.fg("dim", ` · full price · ${remaining}`)
		);
	}
	return (
		theme.fg("success", "🟢 deepseek off-peak") +
		theme.fg("dim", ` · 50% off · ${remaining}`)
	);
}

/** Local HH:MM for a whole UTC hour, using the machine's timezone. */
function localHourLabel(ref: Date, utcHour: number): string {
	const d = new Date(ref);
	d.setUTCHours(utcHour, 0, 0, 0);
	return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
}

function scheduleText(now: Date): string {
	const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
	const windows = PEAK_WINDOWS.map(([start, end]) => `${localHourLabel(now, start)}–${localHourLabel(now, end)}`).join(", ");
	const change = nextChange(now);
	const remaining = change ? humanize(change.getTime() - now.getTime()) : ">24h";
	const state = isPeak(now)
		? `🔴 Peak now — full price (2× the off-peak rate)\nNext off-peak in ${remaining}`
		: `🟢 Off-peak now — 50% off (half price)\nNext peak in ${remaining}`;
	return `${state}\n\nPeak: ${windows} ${tz}, Mon–Fri\nWeekends and Chinese public holidays are entirely off-peak.`;
}

export default function (pi: ExtensionAPI) {
	let timer: unknown;

	pi.registerCommand("deepseek", {
		description: "Show DeepSeek peak/off-peak billing hours and the current state",
		handler: async (_args, ctx) => {
			ctx.ui.notify(scheduleText(new Date()), "info");
		},
	});

	const update = (ctx: ExtensionContext, model?: Model<any>) => {
		ctx.ui.setStatus(STATUS_KEY, renderStatus(ctx, model ?? ctx.model));
	};

	const stopTimer = (ctx?: ExtensionContext) => {
		if (timer === undefined) return;
		const timers = ctx as ManagedTimers | undefined;
		if (timers?.clearTimer) timers.clearTimer(timer);
		else clearInterval(timer as NativeTimerHandle);
		timer = undefined;
	};

	pi.on("session_start", async (_event, ctx) => {
		stopTimer(ctx);
		update(ctx);
		const tick = () => update(ctx);
		const timers = ctx as ManagedTimers;
		timer = timers.setInterval ? timers.setInterval(tick, 5_000) : setInterval(tick, 5_000);
	});

	pi.on("model_select", async (event, ctx) => {
		update(ctx, event.model);
	});

	pi.on("input", async (_event, ctx) => {
		update(ctx);
	});

	pi.on("before_agent_start", async (_event, ctx) => {
		update(ctx);
	});

	pi.on("session_shutdown", async (_event, ctx) => {
		stopTimer(ctx);
	});
}
