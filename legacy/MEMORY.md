# sl-dubbing-frontend-main/ — Glotix Frontend Root

> **Parent:** [`../MEMORY.md`](../MEMORY.md) · **Map:** [`../../PROJECT_MAP.md`](../../PROJECT_MAP.md)

## Overview
Static HTML/CSS/JS frontend served by the Go gateway or directly. Dubbing, TTS, video creation, Supabase auth, **character credit packs**.

## Root Files

| File | Purpose |
|------|---------|
| `index.html` | Landing/home page |
| `dubbing.html` | Main dubbing interface — badge + cost estimate |
| `tts.html` | Text-to-Speech studio |
| `video-creation.html` | AI video/image creation page |
| `login.html` | Login/auth page |
| `history.html` | Job history page |
| `pricing.html` | ★ Character packs (Starter/Pro/Elite) via `17-pricing-packages.js` |
| `privacy.html` / `terms.html` | Legal |
| `developer.html` | Developer API documentation |
| `robots.txt` / `sitemap.xml` | SEO |

## Subdirectories
- `auth/` — Auth confirmation pages
- `css/` — Stylesheets
- `demo/` — Demo/example files
- `js/` — JavaScript modules ([js/MEMORY.md](js/MEMORY.md))
- `logo/` — Brand assets

## Character credits UI (جول 2026)
- Header badge: `18-credit-balance.js`
- Pricing cards: `17-pricing-packages.js`
- Upload estimate + disable Start at 0: `19-cost-estimate.js`
- API balance field: prefers `character_credits`

## Serving
- Go gateway serves static files and injects `/js/config.js`
- API calls proxied to Flask backend
