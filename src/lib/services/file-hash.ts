// # FILE frontend/sl-dubbing-frontend-main/src/lib/services/file-hash.ts
// # AR Hash large files inside a Web Worker so the UI stays responsive
// # KW رفع,upload,worker,hash

import type { FileHashRequest, FileHashResponse } from '$lib/workers/file-hash.worker';

// # FN hashFileSha256InWorker
// # AR Compute SHA-256 for a Blob/File without blocking the main thread
// # KW رفع,upload,worker,hash
export async function hashFileSha256InWorker(file: Blob): Promise<string> {
	if (typeof Worker === 'undefined') {
		const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
		return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
	}

	const worker = new Worker(new URL('../workers/file-hash.worker.ts', import.meta.url), {
		type: 'module'
	});
	const id = crypto.randomUUID();

	return await new Promise<string>((resolve, reject) => {
		const timer = setTimeout(() => {
			worker.terminate();
			reject(new Error('File hash timed out'));
		}, 30 * 60_000);

		worker.onmessage = (event: MessageEvent<FileHashResponse>) => {
			if (event.data.id !== id) return;
			clearTimeout(timer);
			worker.terminate();
			if (event.data.ok) resolve(event.data.hex);
			else reject(new Error(event.data.error));
		};
		worker.onerror = (event) => {
			clearTimeout(timer);
			worker.terminate();
			reject(event.error || new Error('File hash worker failed'));
		};

		// # guard — structured-clone the Blob handle; never allocate the full file on the UI thread
		const payload: FileHashRequest = { id, file };
		worker.postMessage(payload);
	});
}
