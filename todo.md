# Grok 4.7 cost control — todo

Updated: 2026-10-24
Scope: `omp-config`. Production model is `xai-oauth/grok-4.7` only. No other Grok 4.x model is used.

## Current state

- `compaction.modelThresholds` is now `{"xai-oauth/grok-4.7": "f150000"}`.
- The 9 per-model entries for grok-4.3, 4.5, 4.6, 4.20, and grok-build are removed.
- `grok-4.7`: 500k window, 200k long-context tier (inclusive), 2x for the whole request.
- Config backup: `config.yml.bak-20261024_035857`.
- Last Grok call: 2026-10-22 16:12. The 150k line has never run on a Grok session.
- OMP already prices the tier correctly: `omp models --json xai-oauth` reports
  `longContext.inputThreshold = 200000`, `input = 4`, `output = 12`, `cacheRead = 1`.

## 1. Config

- [x] Replace the 9 exact Grok keys with one exact `grok-4.7` key.
- [x] Do not use a wildcard: the threshold is pinned to the only model we run.
- [x] Keep only `xai-oauth/grok-4.7` as the Grok model in `enabledModels`.
- [ ] Decide whether to add `"xai/*": f150000` for the API-key route. Skip until
      an `xai` API key is actually configured.
- [ ] Re-run `./setup.sh` on the desktop (`omarchy-1`) after `git pull`.

## 2. Guardrails

- [x] `scripts/grok-policy.py` + `tests/test_grok_policy.py`
      - Resolve the compaction trigger per selector: exact key, then longest
        `*` suffix, then `fN` / `N` / `N%`.
      - Fail when any xAI chat model resolves to a trigger >= 200000 or has no
        matching key.
      - Check `omp models --json xai-oauth` against `config.yml`.
- [x] `scripts/grok-audit.py` + `tests/test_grok_audit.py`
      - Count `input_tokens + cache_read_tokens >= 200000` from `stats.db`.
      - Report per model: calls, over-200k calls, cost, max prompt.
      - Flags: `--since`, `--model`, `--json`, `--fail-on-violation`.
      - Boundary test: 199,999 is safe; 200,000 is over. Cache reads count.
- [ ] `extensions/grok-guard/` + `bun test`
      - Footer status: `grok 142k/200k` when the active provider is xai.
      - Notify at 170k and 190k; once per band, reset after compaction.
      - Notify when `retry_fallback_applied` lands on an xAI target.
      - No blocking: OMP's 150k compaction is the enforcement.
      - Main session only (`ctx.agent.kind === "main"`).

## 3. Verification

- [ ] Live proof of the 150k trigger (needs approval; ~$0.50–$1.00 API-equivalent).
      - Start Grok 4.7 in a throwaway session and load a ~600 KB text file.
      - Expect one request between 150k and 200k, then a `compaction` entry with
        `reason = threshold` in the session JSONL.
      - `python3 scripts/grok-audit.py --since <start> --fail-on-violation` exits 0.
- [ ] Weekly receipt: `python3 scripts/grok-audit.py --since <Monday> --json`.
      - Baseline this week: 298 of 2,744 calls >= 200k, $92.13 of $214.20.
- [ ] Measure the SuperGrok pool question once: read `omp usage` before and after
      one known Grok session. Record whether the API line moved. Do not claim a
      pool attribution without this reading.

## 4. Docs

- [ ] Update `docs/long-context-pricing.md`
      - Grok 4.7 Fast: 2x below 200k, 1.5x above; Cursor and Grok Build only,
        absent from the public API.
      - Priority Processing: 2x when the response has `"service_tier": "priority"`.
      - 4.3 and 4.20 have 1M windows; the 200k line still applies.
      - OMP evidence: `omp models --json` long-context fields; local `service_tier`
        is NULL, and `tier.*` has no xAI family.
- [ ] Add one paragraph to `README.md` under model routing: Grok only via
      `xai-oauth`, compact at 150k, no other Grok 4.x model.

## 5. Open decisions

- [ ] 150k vs 170k. Current choice: 150k. 170k leaves only 30k of headroom,
      and the largest observed single-turn jump was 48k.
- [ ] Whether Grok should ever be a fallback target. Current chains point to
      DeepSeek only. Keep it that way.
- [ ] Whether the `xai-oauth` subscription pool is the same meter as the API
      invoice. xAI's docs conflict. Treat OMP dollars as API-equivalent estimates.

## 6. Done log

- [x] 2026-10-24: simplified `compaction.modelThresholds`; verified with
      `omp config get` and `omp config list`.
- [x] 2026-10-24: confirmed Grok 4.7 catalog metadata (500k window, 200k tier).
- [x] 2026-10-24: `grok-policy.py` and `grok-audit.py` tests passed; independent review PASS (`grok-guard-review`). Live policy exits 1: nine xAI chat models have no key. `grok-4.7` matches `f150000`.
- [x] 2026-10-24: live catalog `contextWindow` is 256000. The 200k price line is still listed. User closed the 2x-window hunt. Paid threshold proof stays unchecked.
- [x] 2026-10-26: DeepSeek fully removed (`agentModelOverrides`, `fallbackChains`, `enabledModels`, `modelProviderOrder`). Replaced with `xai-oauth/grok-4.7`. Compaction pinned to 150k (`f150000`) across providers to guarantee sessions never exceed Grok's 256k context window.
