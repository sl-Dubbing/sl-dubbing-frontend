/// <reference lib="webworker" />
// # FILE frontend/sl-dubbing-frontend-main/src/lib/workers/file-hash.worker.ts
// # AR SHA-256 hashing off the UI thread for large media files
// # KW رفع,upload,worker,hash

import { createSHA256 } from 'hash-wasm';

export type FileHashRequest = {
	id: string;
	file: Blob;
	chunkBytes?: number;
};

export type FileHashResponse =
	| { id: string; ok: true; hex: string }
	| { id: string; ok: false; error: string };

async function sha256Hex(file: Blob, chunkBytes = 4 * 1024 * 1024): Promise<string> {
	const hasher = await createSHA256();
	hasher.init();
	for (let offset = 0; offset < file.size; offset += chunkBytes) {
		const chunk = await file.slice(offset, Math.min(file.size, offset + chunkBytes)).arrayBuffer();
		hasher.update(new Uint8Array(chunk));
	}
	return hasher.digest('hex');
}

self.onmessage = async (event: MessageEvent<FileHashRequest>) => {
	const { id, file, chunkBytes } = event.data;
	try {
		const hex = await sha256Hex(file, chunkBytes);
		const response: FileHashResponse = { id, ok: true, hex };
		(self as DedicatedWorkerGlobalScope).postMessage(response);
	} catch (error) {
		const response: FileHashResponse = {
			id,
			ok: false,
			error: error instanceof Error ? error.message : 'Hash failed'
		};
		(self as DedicatedWorkerGlobalScope).postMessage(response);
	}
};
