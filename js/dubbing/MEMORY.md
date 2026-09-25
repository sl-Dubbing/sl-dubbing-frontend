# js/dubbing/ — Dubbing Interface JavaScript Modules

> **Parent:** [`../MEMORY.md`](../MEMORY.md) · **Map:** [`../../../../PROJECT_MAP.md`](../../../../PROJECT_MAP.md#-يوليو-2026--الفوترة-بالأحرف-character-credits)

## Overview
Modular JavaScript files (01–99 pattern) for the main dubbing UI. Covers state, API, voices, R2 upload, progress, SSE, and **character cost estimation**.

## Files

| File | Purpose |
|------|---------|
| `01-state.js` | Application state (`selectedMediaDurationSec` يُستخدم للتقدير) |
| `02-api-config.js` | API endpoint configuration |
| `03-api-fetch.js` | HTTP fetch wrappers with auth headers |
| `04-job-status.js` | Job status polling and SSE integration |
| `05-voice-payload.js` | Voice configuration payload construction |
| `06-voice-html.js` | Voice selection UI rendering |
| `07-voice-api.js` | Voice-related API calls |
| `08-voice-save-modal.js` | Save voice modal UI + logic |
| `09-voice-recorder.js` | Microphone recording for voice samples |
| `10-ui-progress.js` | Dubbing progress UI |
| `11-upload-r2.js` | Direct-to-R2 file upload with progress |
| `12-start-dubbing.js` | Start dubbing button + payload submission |
| `13-recent-jobs.js` | Recent jobs history list |
| `14-media-input.js` | Media picker — stores duration + يحدّث تقدير التكلفة |
| `15-lang-attention.js` | Language attention/selection UI |
| `16-lang-picker.js` | Language picker dropdown |
| `17-dub-lang-context.js` | Dubbing language context management |
| `17-pending-jobs-resume.js` | Resume pending jobs on page load |
| `18-stream-player.js` | Audio/video stream player |
| `19-cost-estimate.js` | ★ تقدير ~1000 حرف/دقيقة ×1.5؛ تعطيل `#dubBtn` إن الرصيد 0 |
| `99-init.js` | Initialization and event binding |
| `audio-scheduler.js` / `audio-worklet-processor.js` / `dubbing-worker.js` / `mic-capture-processor.js` / `ws-realtime-client.js` | Audio / WS helpers |

## Notes
- SSE used for real-time job progress
- Exact charge happens on Modal after translation (not at Start click)
- Soft estimate only in UI; server pre-check requires `character_credits > 0`
