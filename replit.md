# OpenClaw - Hybrid AI Workspace

## Overview

OpenClaw is a personalized hybrid AI workspace designed to intelligently route requests between local Ollama models and various cloud AI services (MiniMax, Claude, Groq, OpenAI). It leverages the nyanbook.io API as its core atomic logic and reasoning engine. The project aims to provide an optimal balance of performance, cost-efficiency, and privacy by dynamically selecting the most suitable AI provider based on availability and request type. It is envisioned as a foundational AI infrastructure that users can deploy on their own infrastructure, utilizing either local models or cloud API keys.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

OpenClaw operates with a unified, single-pass pipeline orchestrated by `void-pipeline.js` to ensure efficient request processing. It supports three distinct modes: `prescribe` for privileged build/kernel/code operations, `scribe` for content creation (docs/legal), and `describe` for general chat.

Key architectural features include:

-   **Dynamic Fallback Chain**: At startup, the system probes for available AI providers (local Ollama and cloud APIs) and constructs a dynamic fallback chain, prioritizing cloud services and using Ollama as a local substrate safety net. This chain is hot-reloadable.
-   **Startup Environment Detection**: The system intelligently detects its runtime environment (local, cloud, Replit-dev) and the availability of AI models and API keys to configure itself accordingly.
-   **Security Hardening**:
    -   **Localhost Trust Gate**: Differentiates between local and public IP requests, requiring authentication for public access.
    -   **Context Window Clamping**: Automatically adjusts `maxTokens` based on the LLM provider's context limits to prevent overflow.
    -   **Exec Safety Guard**: Blocks dangerous commands in `prescribe` mode to prevent system-level damage.
    -   **Path Traversal Protection**: Ensures file paths remain within the designated workspace root.
    -   **Workspace Portability**: Allows overriding the workspace root for flexible deployment.
-   **Intent Detection and Context Management**: A consolidated `intent-detector.js` routes requests to appropriate MoE expert files (e.g., `IDENTITY.md`, `PHILOSOPHY.md`) and manages session memory.
-   **Core Modules**: The `lib/` directory contains core functionalities including `llm-client.js` for multi-provider LLM routing, `nyan-api.js` for atomic logic, and `memory-manager.js` for session memory.
-   **API Endpoints**: Provides endpoints for health checks, environment status, unified chat, atomic logic queries, financial analysis, and web search.

## External Dependencies

-   **AI Providers**: MiniMax, Groq, Claude (Anthropic), OpenAI, Ollama (local)
-   **API Integrations**: nyanbook.io API
-   **Input Channels**: Discord gateway (event-driven via discord.js, optional — requires DISCORD_BOT_TOKEN)
-   **Libraries**: axios, cors, express, express-rate-limit, helmet, discord.js
-   **Passive Health**: Provider latency/success tracked from real requests (no synthetic pings). `/health` exposes per-provider stats.

## External Tools (outside workspace)

All dev/diagnostic utilities live at `/home/runner/.openclaw-tools/` — outside workspace to avoid git pollution. See `README.md` there for full docs.

- `sync-nyanclaw.sh` — single-copy nyanclaw sync + auto-purge + anchor update
- `nyandoctor.js` — diagnose/auto-fix (deps, env, APIs, tests)
- `setup.js` — interactive first-hatch setup (prompts for keys, writes .env, boots server)

## Two-Repo Model

OpenClaw exists across two repos with different purposes — they do NOT need to be in perfect sync.

| | Replit (ProbablyNothing) | Mac Mini (nyanclaw) |
|---|---|---|
| **Repo** | `github.com/10nc3/ProbablyNothing` | `github.com/johnjames-bit/nyanclaw` |
| **Purpose** | Dev env / public blueprint | Personal prod env |
| **Audience** | Anyone — open to adopt, fork, or synthesize better | Owner only — personal infra |
| **Provider stance** | Generalized — no assumption about which cloud provider is primary. Users bring their own keys or run Ollama-only | Optimized for MiniMax (primary) + Ollama Qwen (substrate), latency-tuned |
| **Design goal** | Clean, provider-agnostic, well-documented open blueprint | Lean, fast, personal debugging tools |
| **Sync policy** | Pull specific hardening/features from nyanclaw when they generalize well. Don't copy MiniMax-specific optimizations. | Source of truth for owner's prod. May have personal config, cron jobs, tools that don't belong in the public repo. |

**Key principle**: Replit version = "here's how it works, make it yours." Nyanclaw = "here's how I run mine."

## Synthesis Memory (0+φ⁰+φ¹=φ²)

Three-generation memory: past anchor, present state, future direction.

- **Nyanclaw anchor**: `8401ee3` (main) — last verified synthesis. PII scrubbed from git (phone placeholders). All prior clones purged.
- **Sync tool**: `bash /home/runner/.openclaw-tools/sync-nyanclaw.sh` — lives outside workspace to avoid polluting OpenClaw git. Keeps exactly one shallow clone at `/tmp/nyanclaw-latest`, auto-purges stale copies, updates this anchor.
- **Present**: 152 tests passing. Pipeline hardened (audit metrics, source tagging, input guards, error chain, context truncation, PII anonymization, log rotation at 1000 entries). Strike system restored (3-strike demotion, 5-min cooldown, passive health stats).
- **Discord gateway**: `lib/discord-gateway.js` — event-driven bot (MESSAGE_CREATE), maps channels→sessionIds and users→callerIds for privilege gating, chunks responses at 2000 chars. Optional satellite: no DISCORD_BOT_TOKEN = no start. Health status exposed at `/health` endpoint.
- **Boundary note**: vegapunk.js and its 4 Discord bots (Hermes, Thoth, Idris, Horus) belong to nyanbook.io's ledger backend — NOT OpenClaw. OpenClaw connects to nyanbook via Nyan API only. Do not absorb or reimplement bot infrastructure here.