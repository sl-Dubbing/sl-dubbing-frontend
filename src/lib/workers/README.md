// # FILE frontend/sl-dubbing-frontend-main/src/lib/workers/README.md
// # AR Web Workers + WASM integration notes

# Workers

## FFmpeg.wasm

Integrated through `src/lib/services/ffmpeg.ts` and wired into the dubbing upload
path by `src/lib/services/media-prepare.ts`.

- Lazy-loaded: WASM core is not downloaded until local extraction/remux is requested.
- Owns its module worker inside `@ffmpeg/ffmpeg`.
- Call `releaseMediaPrepareResources()` / `terminateBrowserFfmpeg()` when a session ends.

## File hash worker

`file-hash.worker.ts` hashes large Blobs with SHA-256 off the UI thread:

```ts
import { hashFileSha256InWorker } from '$lib/services/file-hash';
const hex = await hashFileSha256InWorker(file);
```

## App-owned workers

```ts
const worker = new Worker(new URL('./file-hash.worker.ts', import.meta.url), {
  type: 'module'
});
```
