# TOOLS.md - Local Notes

Skills define _how_ tools work. This file is for _your_ specifics — the stuff that's unique to your setup.

## What Goes Here

Things like:

- Camera names and locations
- SSH hosts and aliases
- Preferred voices for TTS
- Speaker/room names
- Device nicknames
- Anything environment-specific

## Examples

```markdown
### Cameras

- living-room → Main area, 180° wide angle
- front-door → Entrance, motion-triggered

### SSH

- home-server → 192.168.1.100, user: admin

### TTS

- Preferred voice: "Nova" (warm, slightly British)
- Default speaker: Kitchen HomePod
```

## Why Separate?

Skills are shared. Your setup is yours. Keeping them apart means you can update skills without losing your notes, and share skills without leaking your infrastructure.

---

## Model Stack

### Local-First = Substrate Defense (φ-ontology)

**Philosophy:**
- **Local (00)** = substrate — fastest, private, always tried first
- **Cloud (φ¹)** = fallback — when local unavailable or overloaded

```
Local (Ollama) → [fails] → Cloud (MiniMax/Claude/Groq) → [fails] → Error
```

"The ground runs first. The sky holds when the ground can't."

| Model | Role | Context |
|-------|------|---------|
| Qwen2.5 Coder 7B | Primary (00) — local substrate | 128k |
| MiniMax-M2.5 | Cloud fallback (φ¹) | 200k |
| Claude | Cloud fallback (φ¹) | 200k |
| Groq | Cloud fallback (φ¹) — fast inference | 128k |

### Dynamic Chain

Built at startup from detected providers. Priority order:
1. Ollama (local) — always first if running
2. MiniMax — if MINIMAX_API_KEY set
3. Groq — if GROQ_API_KEY set
4. Claude — if ANTHROPIC_API_KEY set
5. OpenAI — if OPENAI_API_KEY set

### Manual Override

- `/model qwen` → force local
- `/model minimax` → force cloud (MiniMax)
- `/model auto` → smart routing (default, dynamic chain)

---

## Nyan API Fallback Strategy

**Endpoint:** https://nyanbook.io/api/v1/nyan
**Token:** NYAN_API_TOKEN (env secret)

### Query Priority:

1. **Internal first** → PHILOSOPHY.md, MEMORY.md, user context
2. **Fallback to Nyan API** → Real-time prices, weather, current events
3. **Always Nyan API** → Ψ-EMA calculations, chemistry, legal analysis, specialized atomic queries

### Usage:
```javascript
const { atomicQuery } = require('./lib/nyan-api.js');
// For real-time data
const result = await atomicQuery('CPO price Indonesia');
// For Ψ-EMA
const psiEma = await getPsiEMA('AAPL');
```
