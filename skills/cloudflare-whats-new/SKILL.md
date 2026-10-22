---
name: cloudflare-whats-new
description: Use for Cloudflare features shipped in October 2026 that the other Cloudflare skills do not cover yet. Covers the Web Search API, Pi Durable PiHarness, D1 and Workers KV jurisdictions, 30-day analytics retention, Workers Observability in Custom Dashboards, strict Access service-token authentication, and BGP over IPsec and GRE tunnels.
---

# Cloudflare platform updates

The other Cloudflare skills lag these launches. Read the live doc for the task before giving commands, config, limits, or code. Prefer the Cloudflare docs MCP (`search_cloudflare_documentation`) over memory.

Account changes go through the main `cloudflare` MCP server. Logs, traces, and analytics go through `cloudflare-observability`. AI Gateway logs, including Web Search calls, go through `cloudflare-ai-gateway`. KV, D1, and other Worker bindings go through `cloudflare-bindings`.

## What changed

| Need | Current fact | Read first |
| --- | --- | --- |
| Ground an agent or app with live web results | Web Search API is beta and runs through AI Gateway. Launch providers are Ceramic.ai, Exa, and Linkup. Workers call `env.AI.websearch`. REST is `POST /accounts/{account_id}/ai/websearch/`. | [How to use Web Search API](https://developers.cloudflare.com/web-search/how-to-use/) |
| Run a Pi agent that survives eviction | `PiHarness` from `agents/harness/pi` is beta. It is not in the `agents-sdk` skill. Install `agents`, `@earendil-works/pi-durable`, and `@earendil-works/pi-ai`, then read the current harness page before writing code. | [Pi harness](https://developers.cloudflare.com/agents/harnesses/pi/) |
| Keep KV data in a region | Workers KV jurisdictions are generally available. Set `eu`, `us`, or `fedramp` only at namespace creation. Workers can still read the namespace from anywhere; the jurisdiction is durable storage, not cache. | [KV jurisdictions](https://developers.cloudflare.com/changelog/post/2026-10-02-kv-jurisdictions-ga/) |
| Keep a D1 database in the United States | `us` is a create-time jurisdiction, alongside `eu` and `fedramp`. It cannot be added later. | [D1 changelog](https://developers.cloudflare.com/changelog/product/d1/) |
| Look back more than a week in analytics | Adaptive datasets, including HTTP requests, security events, and DNS analytics, retain at least 31 days on Free and Pro, and a query can span 30 days. Aggregated datasets such as `httpRequests1hGroups` keep their old plan limits. | [30 days of analytics](https://developers.cloudflare.com/changelog/post/2026-10-02-30-days-analytics-on-every-plan/) |
| Chart Worker logs next to HTTP or WAF data | Custom Dashboards can query Workers Observability — Logs and Workers Observability — Traces (OTel) for Workers that have logs or traces enabled. | [Workers Observability in Custom Dashboards](https://developers.cloudflare.com/changelog/post/2026-10-02-workers-observability-in-custom-dashboards/) |
| Call Access with a service token | Organizations created on or after October 5, 2026 have strict service token authentication on, and cannot turn it off. Failed auth returns 401 or 403, not a login redirect. Only Service Auth policies match, and Access does not issue a `CF_Authorization` cookie. | [Strict service token authentication](https://developers.cloudflare.com/changelog/post/2026-10-02-strict-service-token-authentication/) |
| Exchange WAN or Magic Transit routes over a tunnel | BGP over IPsec and GRE is generally available for production on accounts that use Unified Routing. No extra enablement. BGP over CNI is still closed beta. | [BGP over tunnels](https://developers.cloudflare.com/changelog/post/2026-10-05-bgp-over-tunnels-ga/) |

For Cloudflare WAN and Access design, also load `cloudflare-one`. For Worker logs and traces in code, also load `workers-best-practices`.
