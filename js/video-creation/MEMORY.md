# js/video-creation/ — AI Video Creation Module

## Overview
JavaScript for Image Studio (`video-creation.html`): talking video via `/api/image/to-video` (ElevenLabs + Wav2Lip), cost estimate, optional Gemini text Q&A, localStorage results.

## Files

| File | Lines | Purpose |
|------|-------|---------|
| `01-process.js` | 266 | Image prompt processing: API call, result rendering, preview |
| `README.md` | — | Documentation |

## Key Functions in `01-process.js`
- `apiBase()` — Resolve API base URL
- `escapeHtml(text)` — XSS-safe HTML escaping
- `formatTime(iso)` — ISO date formatting
- `loadResults()` / `saveResults(items)` — localStorage-based history
- `renderResultsList()` — Render saved results
- `addResultToList(entry)` — Append new result
- `previewImage(event)` — Image preview modal
- `processImagePrompt()` — Main async function: fetch `/api/image/process`, handle progress
