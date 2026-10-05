# 🧠 Memory — Frontend JavaScript Modules

> **Parent:** [`../MEMORY.md`](../MEMORY.md) · **Map:** [`../../../PROJECT_MAP.md`](../../../PROJECT_MAP.md#-يوليو-2026--الفوترة-بالأحرف-character-credits)

## Purpose
Client-side JavaScript for Glotix. Modules: dubbing UI, TTS studio, shared utils (**character credits**), video-creation.

## Directory Structure
```
js/
├── dubbing/          # Main dubbing pipeline UI (+ 19-cost-estimate)
├── shared/           # Auth, character credits, pricing packs, menus
├── tts/              # Standalone TTS studio UI
├── video-creation/   # Video creation studio
├── languages.js
└── src-lang-picker.js
```

## Character credits (جول 2026)
| File | Purpose |
|------|---------|
| `shared/17-pricing-packages.js` | Starter/Pro/Elite packs + Stripe checkout |
| `shared/18-credit-balance.js` | Header balance badge |
| `dubbing/19-cost-estimate.js` | ~1000 chars/min estimate; disable Start at 0 |
| `shared/08-credits-helpers.js` | Prefers `character_credits` from API |

## Sub-MEMORY
- [`dubbing/MEMORY.md`](dubbing/MEMORY.md)
- [`shared/MEMORY.md`](shared/MEMORY.md)
- [`tts/MEMORY.md`](tts/MEMORY.md)
- [`video-creation/MEMORY.md`](video-creation/MEMORY.md)
- [`dubbing/wasm/MEMORY.md`](dubbing/wasm/MEMORY.md)
