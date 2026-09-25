# js/shared/ — Shared Frontend Modules

> **Parent:** [`../MEMORY.md`](../MEMORY.md) · **Map:** [`../../../../PROJECT_MAP.md`](../../../../PROJECT_MAP.md#-يوليو-2026--الفوترة-بالأحرف-character-credits)

## Overview
Shared JavaScript modules used across all pages (dubbing, TTS, video-creation). Handles auth, API base URL, Supabase client, session management, **character credits** display, toast notifications, and initialization.

## Files

| File | Purpose |
|------|---------|
| `01-api-base.js` | API base URL configuration (detects Go gateway vs direct Flask) |
| `02-toast.js` | Toast notification system |
| `03-jwt.js` | JWT token management |
| `04-auth-headers.js` | Authorization header injection for API calls |
| `05-session.js` | User session management |
| `06-guest-menu.js` | Guest user menu UI |
| `07-supabase-client.js` | Supabase client initialization |
| `08-credits-helpers.js` | Credit helpers — يفضّل `character_credits` من الـ API |
| `09-credits-fetch.js` | Credit balance fetching (`/api/user/credits`) |
| `10-menu-ui.js` | User menu UI rendering |
| `11-menu-actions.js` | User menu action handlers |
| `12-auth-sync.js` | Cross-tab authentication sync |
| `13-connection.js` | Connection status monitoring |
| `14-init.js` | Shared initialization sequence |
| `15-api-errors.js` | Centralized API error handling |
| `16-credits-modal.js` | Insufficient credits modal → `/pricing` |
| `17-pricing-packages.js` | ★ باقات أحرف Starter/Pro/Elite + Stripe checkout |
| `18-credit-balance.js` | ★ شارة الرصيد في الهيدر (`#creditBalanceBadge`) |

## Notes
- Load order: numbered modules then page-specific
- Balance display unit: **characters** (formatted as 100k / 1.5M)
- Checkout: `POST /api/payments/checkout` with Stripe price_id
