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
-   **API Integrations**: nyanbook.io API, Twilio (for WhatsApp integration)
-   **Libraries**: axios, cors, express, express-rate-limit, helmet