# Nyan AI (nyanclaw)

## Overview

Nyan AI is a philosophical AI assistant / void cat chatbot. The project includes an AI pipeline with WhatsApp integration, financial analysis tools, memory management, and model fallback routing.

## User Preferences

Preferred communication style: Simple, everyday language.

## Project Structure

- `lib/` - Core library modules (AI engine, API clients, tools)
- `lib/hooks/` - Integration hooks (e.g., WhatsApp)
- `memory/` - Session memory files
- `prompts/` - Prompt templates
- `IDENTITY.md` - AI personality and identity definition
- `PHILOSOPHY.md` - Philosophical framework
- `AGENTS.md` - Agent configuration
- `SOUL.md` - Core identity traits
- `TOOLS.md` - Tool configuration and model stack info
- `USER.md` - User profile

## Tech Stack

- **Runtime**: Node.js (CommonJS modules)
- **Framework**: Express.js
- **AI**: OpenAI SDK, model fallback routing (MiniMax, Qwen, Groq)
- **Integrations**: Twilio (WhatsApp), Axios (HTTP)
- **Database**: PostgreSQL (via pg)
- **Security**: Helmet, CORS, express-rate-limit
- **Validation**: Zod

## Key Dependencies

- axios, body-parser, cors, express, express-rate-limit, express-session
- helmet, openai, pg, twilio, zod
