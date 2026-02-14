# OpenClaw - Hybrid AI Workspace

## Overview

MY OPENCLAW is a personalized hybrid AI workspace. It routes between local Ollama models (Qwen) and cloud services (MiniMax, Claude) for optimal performance. Uses nyanbook.io API as the atomic logic/reasoning brain. Originally cloned from nyanclaw repository, audited, and hardened.

## User Preferences

Preferred communication style: Simple, everyday language.

## Project Structure

- `index.js` - Express entry point (server, routes, health check)
- `lib/` - Core library modules (16 modules)
  - `llm-client.js` - Multi-provider LLM router with configurable fallback chains
  - `nyan-api.js` - nyanbook.io API client (atomic logic, psi-ema)
  - `void-pipeline.js` - AI pipeline orchestration
  - `preflight-router.js` - Request preflight routing
  - `context-router.js` - Context-aware routing
  - `model-fallback.js` - Model fallback logic
  - `memory-manager.js` - Session memory management
  - `psi-ema.js` - Psi-EMA financial analysis
  - `stock-fetcher.js` - Stock data fetching
  - `financial-physics.js` - Financial physics calculations
  - `forex-fetcher.js` - Forex data fetching
  - `legal-analysis.js` - Legal analysis tools
  - `web-search.js` - Web search integration
  - `data-package.js` - Data packaging
  - `mode-registry.js` - Mode registry
  - `code-context.js` - Code context analysis
- `lib/hooks/` - Integration hooks (e.g., WhatsApp via Twilio)
- `memory/` - Session memory files
- `prompts/` - Prompt templates
- `IDENTITY.md` - AI personality and identity definition
- `PHILOSOPHY.md` - Philosophical framework
- `SOUL.md` - Core identity traits

## API Endpoints

- `GET /health` - Health check with provider status
- `POST /api/chat` - Chat with fallback chain (message, provider, system, model)
- `POST /api/atomic` - Atomic logic query via nyanbook.io (message, domain)
- `POST /api/psi-ema` - Psi-EMA financial analysis (ticker)
- `POST /api/search` - Web search (query, count)
- `GET /api/modules` - Module health status

## Tech Stack

- **Runtime**: Node.js (CommonJS modules)
- **Framework**: Express.js 5
- **AI Providers**: Ollama (local), MiniMax (cloud), Claude (cloud), Groq (cloud), OpenAI (cloud)
- **Default Fallback Chain**: Ollama → MiniMax → Claude
- **Integrations**: Twilio (WhatsApp), Axios (HTTP), nyanbook.io API
- **Security**: Helmet, CORS, express-rate-limit, trust proxy
- **External Brain**: nyanbook.io API (NYAN_API_TOKEN secret)

## Key Dependencies

- axios, cors, express, express-rate-limit, helmet, twilio

## Environment Secrets

- `NYAN_API_TOKEN` - nyanbook.io API authentication
- `SESSION_SECRET` - Session encryption

## Recent Changes

- 2026-02-14: Cloned nyanclaw repo, audited codebase, cut 49% bloat
- 2026-02-14: Hardened llm-client.js with Claude support and configurable fallback chains
- 2026-02-14: Moved NYAN_API_TOKEN to environment secrets
- 2026-02-14: Removed 8 unused packages, kept 6 essential ones
- 2026-02-14: Created index.js entry point with all API routes
- 2026-02-14: Clean boot achieved: all 16 modules loading, server on port 5000
