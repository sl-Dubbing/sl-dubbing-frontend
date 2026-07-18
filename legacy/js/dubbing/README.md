# js/dubbing — Dubbing page modules

> Index: [FRONTEND.md](../../../../../FRONTEND.md) · Pitfalls: [PROJECT_MAP.md §13](../../../../../PROJECT_MAP.md)

> **Repo:** `sl-dubbing-frontend-main`  
> Load order is fixed in `dubbing.html`. All modules attach to `window.DubbingApp`.

---

## Load order (dubbing.html)

| # | File | Role |
|---|------|------|
| 1 | `01-state.js` | Shared page state |
| 2 | `02-api-config.js` | API base, auth headers, `getLocalStorageKeyForPendingDubJobs()` |
| 3 | `03-api-fetch.js` | Fetch helpers + rate-limit retry |
| 4 | `04-job-status.js` | Poll `/api/job/{id}` until complete — **no** `beforeunload` abort |
| 5 | `05-voice-payload.js` | Build dub request body; `dubbingRequestNeedsVoiceCloneCreditCharge()` |
| 6 | `06-voice-html.js` | Premium grid, save-plus card |
| 7 | `07-voice-api.js` | Load clones + saved voice |
| 8 | `08-voice-save-modal.js` | Save sample to library — **# FN markers** → [FUNCTION_INDEX.md](../../../../FUNCTION_INDEX.md) |
| 9 | `10-ui-progress.js` | Progress bar, cinema player, credits modal hook |
| 10 | `11-upload-r2.js` | Presigned R2 upload |
| 11 | `12-start-dubbing.js` | Main start flow; registers pending jobs in localStorage |
| 12 | `13-recent-jobs.js` | Recent works grid + poll while processing |
| 13 | `17-pending-jobs-resume.js` | **Page refresh:** resume polling from localStorage |
| 14 | `14-media-input.js` | File picker / drop zone |
| 15 | `15-lang-attention.js` | Red pulse when langs not selected |
| 16 | `99-init.js` | DOMContentLoaded bootstrap |

---

## Page refresh (do not break)

```
POST /api/dub success
  → 17-pending-jobs-resume.registerPendingDubJob({ jobId, langCode, ... })
  → localStorage: glotix_pending_dub_jobs_{userId}

Page reload
  → 99-init → resumePendingDubJobsIfAny()
  → poll without AbortController (null signal)

Job complete / fail
  → clearPendingDubJob(jobId)
```

**Never re-add:** `window.addEventListener('beforeunload', abortActiveDubbingWorkInProgress)` in `04-job-status.js`.

Backend job keeps running on Celery/Modal regardless of browser state.

---

## Voice clone UX (English only)

| Element | Location |
|---------|----------|
| Explainer section + SVG cards | `dubbing.html` → `#voiceCloneGuide` |
| Link from voice dropdown | `href="#voiceCloneGuide"` |
| +100 info toast | `12-start-dubbing.js` when charge applies |
| Config constant | `js/config.js` → `VOICE_CLONE_CREDIT_COST: 100` |

| User selection | `clone_source` | Extra +100? |
|----------------|----------------|-------------|
| Voice Clone (no sample) | `video` | Yes |
| Premium voice card | `premium` | No |
| Saved / library clone | `library` / `saved` | No |

---

## Pitfalls (frontend)

| Wrong | Right |
|-------|-------|
| Arabic strings in HTML/toast | English only (global product) |
| Abort polling on refresh | Pending jobs + resume on init |
| Block save-sample with 300 min balance | Save is free; fee on dub with fresh clone |
| `MIN_CREDITS_FOR_ORIGINAL_VOICE_CLONE` | Use `VOICE_CLONE_CREDIT_COST` (+100 per charged job) |

---

## Related pages

- `history.html` — lists processing jobs, polls every 8s; **pen icon** → Fast Re-dub modal → `POST /api/dub/redub`
- `js/shared/16-credits-modal.js` — insufficient credits UI (`context: 'voice_clone'`)

### Fast Re-dub (history.html)

| Step | Behavior |
|------|----------|
| List | `GET /api/user/files` — use `redub_available` to show pen icon |
| Modal | User picks target language (English UI) |
| Start | `POST /api/dub/redub` `{ source_job_id, lang }` |
| Poll | `GET /api/job/<new_job_id>` until completed |
| Cost | ~50% of full dub — no +100 clone fee |

**Note:** Jobs completed before artifacts rollout have `redub_available=false`.
