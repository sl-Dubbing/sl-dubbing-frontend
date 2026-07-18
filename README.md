# Glotix Frontend (SvelteKit + TypeScript)

Static SvelteKit app (`@sveltejs/adapter-static`) migrated from the legacy Vanilla HTML/CSS/JS UI in [`legacy/`](legacy/).

## Scripts

```bash
npm install
npm run dev
npm run build
npm run preview
```

## Environment

Copy [`.env.example`](.env.example) to `.env`:

- `PUBLIC_API_BASE` — Rust API (default `https://api.glotix.ai`)
- `PUBLIC_SUPABASE_URL` / `PUBLIC_SUPABASE_KEY` — anon browser keys
- `PUBLIC_DUB_USE_SSE` — job progress via SSE + polling fallback
- `PUBLIC_VOICE_CLONE_CREDIT_COST` — clone surcharge mirror

## Routes

`/` · `/login` · `/auth/confirm` · `/dubbing` · `/tts` · `/history` · `/developer` · `/pricing` · `/privacy` · `/terms` · `/video-creation`

Legacy `.html` URLs under `static/` redirect to the new routes (for example `/dubbing.html` → `/dubbing`).

## What shipped

- Shared auth / credits / theme / toast / API / Supabase under `src/lib/`
- Dubbing: **local FFmpeg.wasm audio extract** (when lip sync is off and browser memory is safe) → direct R2 upload → SSE/polling → optional **local remux** onto the original video
- Files above 500 MB use real **R2 S3 Multipart** uploads (16 MB parts, four parallel transfers, retry, and local resume metadata); the configured limit is 5 GB
- TTS: language picker, Quick/premium/clone voices, dictation, and true **ElevenLabs → Rust → MediaSource streaming** while generation is still running
- History / Image Studio / Developer / Pricing API contracts aligned with the backend
- Helpers: `media-prepare.ts`, `r2-upload.ts`, `audio-stream-player.ts`, `ffmpeg.ts`, incremental WASM SHA-256 in a Web Worker (`file-hash.worker.ts`)

English UI only.

## Local extract policy

| Mode | Behavior |
|------|----------|
| Lip sync **off**, video ≥ 8 MB | Extract mono 16 kHz WAV in-browser, upload audio only |
| Lip sync **on** or extract fails | Upload original media via progress-tracked presigned PUT |
| After audio-only dub completes | Remux dubbed audio onto the original video locally when possible |
