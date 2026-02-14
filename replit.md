# OpenClaw - Hybrid AI Workspace

## Overview

MY OPENCLAW is a personalized hybrid AI workspace. Routes between local Ollama models (Qwen) and cloud services (MiniMax, Claude) for optimal performance. Uses nyanbook.io API as the atomic logic/reasoning brain. NOT Replit-powered — Replit is dev environment only. Production runs on user's own infra with local Ollama or cloud API keys.

## User Preferences

Preferred communication style: Simple, everyday language.

## Architecture

### Unified Pipeline (void-pipeline.js)
Single O(n) pass orchestrator. No duplicate routing, no hanging endpoints.
1. DETECT — parallel regex branches (identity? psi-ema? stock? legal? forex? code?)
2. GATE — privilege check for prescribe mode (PRIVILEGED_CALLER_ID only)
2b. SAFETY — exec safety guard blocks dangerous patterns (rm -rf, dd, fork bombs) in prescribe mode (PicoClaw-inspired)
3. CONTEXT — MoE expert file injection (IDENTITY.md, PHILOSOPHY.md) + session memory
4. CALL — single LLM call via dynamic fallback chain (maxTokens auto-clamped per provider)
5. SIGN — personality stamp (regex, not LLM)

### Three Modes
- **prescribe** — build/kernel/code (privileged, restricted to PRIVILEGED_CALLER_ID)
- **scribe** — create/docs/legal (open)
- **describe** — chat/general (open)

### Startup Environment Detection
At boot, the system:
1. Probes Ollama at localhost:11434 for local model availability
2. Checks all cloud API keys (MINIMAX, ANTHROPIC, GROQ, OPENAI)
3. Detects runtime (local, cloud deploy, replit-dev)
4. Builds dynamic fallback chain from what's actually available
5. Prints colored TUI banner with full status and guidance

### Dynamic Fallback Chain
Built at startup from detected providers. Priority: Cloud providers first (MiniMax, Groq, Claude, OpenAI), then Ollama (local) last as substrate safety net. No hardcoded chain — adapts to environment. Hot-reloadable via `GET /api/env?reload=true`.

### Security Hardening
- **Localhost trust gate** — RFC1918/loopback IPs trusted on POST endpoints; public IPs require `Authorization: Bearer <SESSION_SECRET>`. No SESSION_SECRET set = open (dev mode).
- **Context window clamping** — CONTEXT_LIMITS map per provider auto-clamps maxTokens before each LLM call, preventing silent overflow when falling from large-context to small-context provider.
- **Exec safety guard** — DANGEROUS_PATTERNS blocklist in void-pipeline blocks destructive commands (rm -rf, dd if=, fork bombs, chmod 777 /, shutdown) in prescribe mode before they reach the LLM. PicoClaw-inspired.
- **Path traversal protection** — context-router.js validates all file paths stay within WORKSPACE root. No absolute path injection.
- **Workspace portability** — `OPENCLAW_WORKSPACE` env var overrides workspace root; defaults to project root. Portable across local/cloud/container.

## Project Structure

- `index.js` - Express entry point with env detection + TUI boot sequence
- `lib/` - Core library modules (18 modules)
  - `llm-client.js` - Multi-provider LLM router with configurable fallback chains
  - `nyan-api.js` - nyanbook.io API client (atomic logic, psi-ema)
  - `void-pipeline.js` - Unified O(n) single-pass pipeline orchestrator
  - `env-detect.js` - Startup environment detection (Ollama probe, API key check, runtime detect)
  - `startup-tui.js` - Terminal UI banner with colored status output
  - `preflight-router.js` - Request preflight routing
  - `context-router.js` - Context-aware MoE expert file injection
  - `model-fallback.js` - Model fallback logic (legacy CLI tool)
  - `memory-manager.js` - Session memory management (shared across modes/providers)
  - `psi-ema.js` - Psi-EMA financial analysis + documentation
  - `stock-fetcher.js` - Stock data fetching
  - `financial-physics.js` - Financial physics calculations
  - `forex-fetcher.js` - Forex data fetching
  - `legal-analysis.js` - Legal analysis tools
  - `web-search.js` - Web search integration
  - `data-package.js` - Data packaging
  - `mode-registry.js` - Mode registry
  - `code-context.js` - Code context analysis
  - `index.js` - Barrel export (unified module interface)
  - `README.md` - Kernel+Satellites architecture documentation
- `lib/hooks/` - Integration hooks (e.g., WhatsApp via Twilio)
- `memory/` - Session memory files
- `prompts/` - Prompt templates
- `IDENTITY.md` - AI personality and identity definition
- `PHILOSOPHY.md` - Philosophical framework + Kernel+Satellites φ² code philosophy
- `SOUL.md` - Core identity traits
- `ONBOARDING.md` - Setup guide with troubleshooting
- `TOOLS.md` - Local tool notes, model stack (cloud-first, Ollama substrate), Nyan API strategy

## API Endpoints

- `GET /health` - Health check with runtime, chain, and provider status
- `GET /api/env` - Full environment status (runtime, ollama, providers, chain, guidance)
- `POST /api/chat` - Unified pipeline chat (message, provider, model, callerId)
- `POST /api/atomic` - Atomic logic query via nyanbook.io (message, domain)
- `POST /api/psi-ema` - Psi-EMA financial analysis (ticker)
- `POST /api/search` - Web search (query, count)
- `GET /api/modules` - Module health status (18 modules)

## Tech Stack

- **Runtime**: Node.js (CommonJS modules)
- **Framework**: Express.js 5
- **AI Providers**: MiniMax (cloud, primary), Groq (cloud), Claude (cloud), OpenAI (cloud), Ollama (local, substrate)
- **Fallback Chain**: Dynamic — built at startup from available providers. Cloud first, Ollama last as substrate safety net.
- **Integrations**: Twilio (WhatsApp), Axios (HTTP), nyanbook.io API
- **Security**: Helmet, CORS, express-rate-limit, trust proxy
- **External Brain**: nyanbook.io API (NYAN_API_TOKEN secret)

## Key Dependencies

- axios, cors, express, express-rate-limit, helmet, twilio

## Environment Variables

- `NYAN_API_TOKEN` - nyanbook.io API authentication (secret)
- `SESSION_SECRET` - Session encryption (secret)
- `PRIVILEGED_CALLER_ID` - Comma-separated list of caller IDs allowed to use prescribe mode (no value = prescribe locked to everyone, secure by default)
- `OLLAMA_URL` - Custom Ollama endpoint (optional, default: http://localhost:11434)
- `OPENCLAW_WORKSPACE` - Workspace root override (optional, default: project root)
- `MINIMAX_API_KEY` - MiniMax cloud API key
- `ANTHROPIC_API_KEY` - Claude API key
- `GROQ_API_KEY` - Groq API key
- `OPENAI_API_KEY` - OpenAI API key

## Repo References

- **Thesis:** `10nc3/ProbablyNothing` — hardened version (this codebase)
- **Antithesis:** `johnjames-bit/nyanclaw` — OpenClaw's v2.0 restructure
- **Synthesis:** Merged best of both — our env-detect/TUI + their Kernel+Satellites docs, ONBOARDING, barrel export

## Recent Changes

- 2026-02-14: Synthesis — merged OpenClaw v2.0 docs (ONBOARDING.md, Kernel+Satellites section in PHILOSOPHY.md, lib/README.md, lib/index.js barrel, TOOLS.md cloud-first model stack + Nyan API strategy)
- 2026-02-14: Added startup env detection + TUI banner (env-detect.js, startup-tui.js)
- 2026-02-14: Dynamic fallback chain built from detected providers (not hardcoded)
- 2026-02-14: Added /api/env endpoint for runtime environment status
- 2026-02-14: Replit-dev detection with clear guidance for production deployment
- 2026-02-14: Unified void-pipeline.js as O(n) single-pass orchestrator
- 2026-02-14: 3-mode system (prescribe/scribe/describe) with privilege gating
- 2026-02-14: Identity + psi-ema shortcuts (skip LLM, instant response)
- 2026-02-14: Session memory shared across all modes and provider switches
- 2026-02-14: Clean boot: all 18 modules loading, server on port 5000
- 2026-02-14: Added context window clamping (CONTEXT_LIMITS per provider, auto-clamp maxTokens in callProvider)
- 2026-02-14: Added localhost trust gate (RFC1918/loopback bypass, SESSION_SECRET bearer auth for public IPs)
- 2026-02-14: Added exec safety guard (DANGEROUS_PATTERNS blocklist in prescribe mode, PicoClaw-inspired)
- 2026-02-14: Added workspace portability (OPENCLAW_WORKSPACE env var + path traversal protection)
- 2026-02-14: Added chain hot-reload (GET /api/env?reload=true re-probes all providers)
- 2026-02-14: Removed hardcoded phone number — prescribe privilege now env-driven via PRIVILEGED_CALLER_ID (comma-separated, secure-by-default: no value = locked)
