# lib/ — MY OPENCLAW Module Architecture

## Philosophy: Kernel + Satellites

Modular satellites orbiting a central kernel.

**Goal:** Minimize token bleed. Only load what's needed per query.

---

## Kernel (Always Loaded)

| File | Purpose |
|------|---------|
| `void-pipeline.js` | O(n) single-pass orchestrator — DETECT, GATE, CONTEXT, CALL, SIGN |
| `intent-detector.js` | MoE-inspired expert routing — loads relevant identity/philosophy files |
| `llm-client.js` | Multi-provider LLM client with dynamic fallback chain + passive health tracking |

---

## Satellites (On-Demand)

| File | Trigger | Purpose |
|------|---------|---------|
| `nyan-api.js` | atomic, nyan queries | nyanbook.io API client |
| `psi-ema.js` | psi-ema, theta, z-score | Financial analysis + documentation |
| `financial-physics.js` | fp, physics, momentum | Financial physics calculations |
| `stock-fetcher.js` | stock, price, CPO | Stock/commodity data |
| `legal-analysis.js` | legal, contract | Legal analysis tools |
| `web-search.js` | search, web | Web search integration |
| `data-package.js` | data, package | Data packaging |
| `memory-manager.js` | remember, memory | Session memory (shared across modes/providers) |
| `mode-registry.js` | mode detection | prescribe/scribe/describe routing |

---

## Input Channels

| File | Trigger | Purpose |
|------|---------|---------|
| `discord-gateway.js` | DISCORD_BOT_TOKEN set | Event-driven Discord bot — maps channels→sessions, users→callerIds, chunks at 2000 chars |

---

## Infrastructure

| File | Purpose |
|------|---------|
| `env-detect.js` | Startup probe: Ollama HTTP check, API key detection, runtime detection, dynamic chain building (zero token cost) |
| `startup-tui.js` | Colored terminal banner with provider status and setup guidance |

---

## Token Strategy

- **Kernel:** ~4KB (pipeline + context router + LLM client)
- **Satellite:** Only loaded when triggered by keyword match
- **Memory:** Single-pass, no redundant context injection
- **Result:** ~2KB per query vs ~374KB monolithic (old architecture)

---

## Adding a Satellite

1. Create `lib/your-satellite.js`
2. Export your function
3. Add trigger keywords to `intent-detector.js` TRIGGERS
4. Add files to `intent-detector.js` EXPERTS if needed
5. Kernel handles the rest — pipeline routes automatically

---

## Dynamic Fallback Chain

Built at startup by `env-detect.js`. Priority: **Cloud first** (fast, smart), then **Ollama last** as local substrate (safety net when cloud fails). Provider health tracked passively from real requests — no synthetic pings.

```
minimax -> groq -> claude -> openai -> ollama
  ^         ^        ^         ^         ^
  |         |        |         |         |
cloud    cloud    cloud     cloud     local
(primary  (if key  (if key   (if key  (substrate
 if set)   set)     set)      set)    last resort)
```

---

_φ² Genesis — O(n) with parallel satellites_
