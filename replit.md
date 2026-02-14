# OpenClaw - Hybrid AI Workspace

## Overview

MY OPENCLAW is a personalized hybrid AI workspace. Routes between local Ollama models (Qwen) and cloud services (MiniMax, Claude) for optimal performance. Uses nyanbook.io API as the atomic logic/reasoning brain. NOT Replit-powered — Replit is dev environment only. Production runs on user's own infra with local Ollama or cloud API keys.

## User Preferences

Preferred communication style: Simple, everyday language.

## Architecture

### Unified Pipeline (void-pipeline.js)
Single O(n) pass orchestrator. No duplicate routing, no hanging endpoints.
1. DETECT — parallel regex branches (identity? psi-ema? stock? legal? forex? code?)
2. GATE — privilege check for prescribe mode (+628116360610 only)
3. CONTEXT — MoE expert file injection (IDENTITY.md, PHILOSOPHY.md) + session memory
4. CALL — single LLM call via dynamic fallback chain
5. SIGN — personality stamp (regex, not LLM)

### Three Modes
- **prescribe** — build/kernel/code (privileged, restricted to +628116360610)
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
Built at startup from detected providers. Priority: Ollama (local) first, then cloud providers in order of configured keys. No hardcoded chain — adapts to environment.

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
- `TOOLS.md` - Local tool notes, model stack (Ollama-first), Nyan API strategy

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
- **AI Providers**: Ollama (local, preferred), MiniMax (cloud), Claude (cloud), Groq (cloud), OpenAI (cloud)
- **Fallback Chain**: Dynamic — built at startup from available providers. Ollama always first if available.
- **Integrations**: Twilio (WhatsApp), Axios (HTTP), nyanbook.io API
- **Security**: Helmet, CORS, express-rate-limit, trust proxy
- **External Brain**: nyanbook.io API (NYAN_API_TOKEN secret)

## Key Dependencies

- axios, cors, express, express-rate-limit, helmet, twilio

## Environment Variables

- `NYAN_API_TOKEN` - nyanbook.io API authentication (secret)
- `SESSION_SECRET` - Session encryption (secret)
- `OLLAMA_URL` - Custom Ollama endpoint (optional, default: http://localhost:11434)
- `MINIMAX_API_KEY` - MiniMax cloud API key
- `ANTHROPIC_API_KEY` - Claude API key
- `GROQ_API_KEY` - Groq API key
- `OPENAI_API_KEY` - OpenAI API key

## Repo References

- **Thesis:** `10nc3/ProbablyNothing` — hardened version (this codebase)
- **Antithesis:** `johnjames-bit/nyanclaw` — OpenClaw's v2.0 restructure
- **Synthesis:** Merged best of both — our env-detect/TUI + their Kernel+Satellites docs, ONBOARDING, barrel export

## Recent Changes

- 2026-02-14: Synthesis — merged OpenClaw v2.0 docs (ONBOARDING.md, Kernel+Satellites section in PHILOSOPHY.md, lib/README.md, lib/index.js barrel, TOOLS.md Ollama-first model stack + Nyan API strategy)
- 2026-02-14: Added startup env detection + TUI banner (env-detect.js, startup-tui.js)
- 2026-02-14: Dynamic fallback chain built from detected providers (not hardcoded)
- 2026-02-14: Added /api/env endpoint for runtime environment status
- 2026-02-14: Replit-dev detection with clear guidance for production deployment
- 2026-02-14: Unified void-pipeline.js as O(n) single-pass orchestrator
- 2026-02-14: 3-mode system (prescribe/scribe/describe) with privilege gating
- 2026-02-14: Identity + psi-ema shortcuts (skip LLM, instant response)
- 2026-02-14: Session memory shared across all modes and provider switches
- 2026-02-14: Clean boot: all 18 modules loading, server on port 5000
