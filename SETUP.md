# SETUP.md — MY OPENCLAW Quick Start

## One-Liner Hatch

```bash
git clone https://github.com/10nc3/ProbablyNothing.git
cd ProbablyNothing
npm install
node setup.js
```

That's it. The setup script will:
1. Show what's already configured
2. Prompt for your privileged caller ID (phone/email/username)
3. Prompt for any missing API keys
4. Write a `.env` file
5. Boot the server

After first hatch, just `node index.js` (or `npm start`) to boot — `.env` is loaded automatically.

---

## Manual Setup (if you prefer full control)

### Environment Variables

#### Required

| Variable | Purpose |
|----------|---------|
| `NYAN_API_TOKEN` | nyanbook.io API — atomic logic brain |

#### Privilege (optional, secure-by-default)

| Variable | Purpose |
|----------|---------|
| `PRIVILEGED_CALLER_ID` | Comma-separated IDs allowed to use prescribe mode. Phone, email, username — any format. No value = prescribe locked. |

```bash
# Single user
export PRIVILEGED_CALLER_ID=+628116360610

# Multiple users
export PRIVILEGED_CALLER_ID=+628116360610,admin@example.com,devops-bot
```

#### Cloud LLM Providers (at least one recommended)

Set any combination — the system builds a fallback chain from what's available. Cloud providers are tried first, in this order:

| Variable | Provider | Priority |
|----------|----------|----------|
| `MINIMAX_API_KEY` | MiniMax | 1st (primary) |
| `GROQ_API_KEY` | Groq | 2nd |
| `ANTHROPIC_API_KEY` | Claude | 3rd |
| `OPENAI_API_KEY` | OpenAI | 4th |

#### Security (optional)

| Variable | Purpose |
|----------|---------|
| `SESSION_SECRET` | Bearer token for non-localhost requests. No value = open (dev mode). |
| `OPENCLAW_WORKSPACE` | Override workspace root. Default: project root. |
| `OLLAMA_URL` | Custom Ollama endpoint. Default: `http://localhost:11434` |

### Deployment Paths

#### A. Local with Ollama (substrate-only, no cloud costs)

```bash
ollama serve
ollama pull qwen2.5-coder:7b
node index.js
```

Chain: `ollama` (single provider, local)

#### B. Cloud-only (no Ollama needed)

```bash
export MINIMAX_API_KEY=your_key
export NYAN_API_TOKEN=your_token
node index.js
```

Chain: `minimax` (or whichever cloud keys you set)

#### C. Hybrid (recommended)

```bash
export MINIMAX_API_KEY=your_key
export GROQ_API_KEY=your_key
ollama serve
ollama pull qwen2.5-coder:7b
export NYAN_API_TOKEN=your_token
node index.js
```

Chain: `minimax -> groq -> ollama`
Cloud runs first. Ollama holds the ground when the sky falls.

---

## Verify

### Doctor (recommended)

```bash
node doctor.js          # diagnose — checks everything, read-only
node doctor.js --fix    # diagnose + auto-repair what it can
```

Checks: dependencies, .env, privilege config, cloud API keys, Ollama, nyan API (live ping), port 5000, core files, and runs all tests. Color-coded output.

### Manual checks

```bash
curl http://localhost:5000/health                # health check
curl http://localhost:5000/api/env               # full environment status
curl http://localhost:5000/api/modules           # 18 modules loaded
curl -X POST http://localhost:5000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "who are you"}'               # identity shortcut (no LLM needed)
```

### Run tests

```bash
node test/run.js
```

56 tests covering pipeline logic, security guards, env detection, and context routing.

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `NO PROVIDERS AVAILABLE` | Set at least one cloud API key or start Ollama: `ollama serve` |
| `Token missing` | Set `NYAN_API_TOKEN` in environment |
| Ollama not found | Run `ollama serve` then restart the server |
| Wrong chain priority | Check `GET /api/env` — cloud providers should appear before ollama |
| `prescribe mode locked` | Set `PRIVILEGED_CALLER_ID` env var or re-run `node setup.js` |
| Replit-dev warning | Normal for development — deploy to your own infra for production |
| Port conflict | Default is 5000. Check nothing else is bound to it |
| Hot-reload chain | `curl http://localhost:5000/api/env?reload=true` to re-probe all providers |

---

## Three Modes

| Mode | Purpose | Access |
|------|---------|--------|
| prescribe | build/kernel/code | `PRIVILEGED_CALLER_ID` only |
| scribe | create/docs/legal | Open |
| describe | chat/general | Open |

The TUI banner shows lock status at boot:
- `[locked — set PRIVILEGED_CALLER_ID]` when unset
- `[+62***610]` when configured (masked for security)

---

_See also: `ONBOARDING.md` for first-hatch flow, `TOOLS.md` for model stack strategy._
