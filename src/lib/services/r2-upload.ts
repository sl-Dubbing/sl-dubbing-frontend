// # FILE frontend/sl-dubbing-frontend-main/src/lib/services/r2-upload.ts
// # AR Direct-to-R2 PUT with progress, abort, and automatic retry
// # KW رفع,upload,R2,storage,worker

import { apiFetch, parseJsonSafe } from '$lib/services/api';

export type DirectUploadOptions = {
	contentType?: string;
	signal?: AbortSignal;
	onProgress?: (ratio: number, loaded: number, total: number) => void;
	maxAttempts?: number;
};

export type UploadGrant = {
	file_key: string;
	upload_url?: string;
	file_url?: string;
	download_url?: string;
	public_url?: string | null;
};

export type ChunkedUploadPart = {
	partNumber: number;
	blob: Blob;
	etag?: string;
};

type MultipartPartResult = {
	part_number: number;
	etag: string;
	size: number;
};

type MultipartSession = {
	fingerprint: string;
	upload_id: string;
	file_key: string;
	file_url?: string;
	download_url?: string;
	public_url?: string | null;
	chunk_bytes: number;
	parts: MultipartPartResult[];
};

const DEFAULT_CHUNK_BYTES = 16 * 1024 * 1024;
const MULTIPART_THRESHOLD_BYTES = 500 * 1024 * 1024;
const SESSION_PREFIX = 'glotix_r2_multipart_v1_';

// # FN uploadToPresignedUrl
// # AR PUT one object to a temporary R2 URL without proxying through Rust
// # KW رفع,upload,R2,storage
export function uploadToPresignedUrl(
	putUrl: string,
	body: Blob,
	options: DirectUploadOptions = {}
): Promise<void> {
	const maxAttempts = options.maxAttempts ?? 3;
	let attempt = 0;

	const run = (): Promise<void> =>
		new Promise((resolve, reject) => {
			const xhr = new XMLHttpRequest();
			xhr.open('PUT', putUrl, true);
			xhr.setRequestHeader('Content-Type', options.contentType || body.type || 'application/octet-stream');

			const onAbort = () => {
				xhr.abort();
				reject(new DOMException('Aborted', 'AbortError'));
			};
			options.signal?.addEventListener('abort', onAbort, { once: true });

			xhr.upload.onprogress = (event) => {
				if (!event.lengthComputable) return;
				options.onProgress?.(event.loaded / event.total, event.loaded, event.total);
			};
			xhr.onload = () => {
				options.signal?.removeEventListener('abort', onAbort);
				if (xhr.status >= 200 && xhr.status < 300) {
					options.onProgress?.(1, body.size, body.size);
					resolve();
					return;
				}
				reject(new Error(`Direct upload failed: HTTP ${xhr.status}`));
			};
			xhr.onerror = () => {
				options.signal?.removeEventListener('abort', onAbort);
				reject(
					new Error(
						'Direct upload network error (storage CORS/signature). Retry once after refresh.'
					)
				);
			};
			xhr.onabort = () => {
				options.signal?.removeEventListener('abort', onAbort);
				reject(new DOMException('Aborted', 'AbortError'));
			};
			xhr.send(body);
		});

	const attemptUpload = async (): Promise<void> => {
		attempt += 1;
		try {
			await run();
		} catch (error) {
			if (error instanceof DOMException && error.name === 'AbortError') throw error;
			if (attempt >= maxAttempts) throw error;
			await new Promise((resolve) => setTimeout(resolve, Math.min(8000, 400 * 2 ** (attempt - 1))));
			await attemptUpload();
		}
	};

	return attemptUpload();
}

function uploadPartToPresignedUrl(
	putUrl: string,
	body: Blob,
	options: DirectUploadOptions = {}
): Promise<string> {
	const maxAttempts = options.maxAttempts ?? 4;
	let attempt = 0;
	const run = (): Promise<string> =>
		new Promise((resolve, reject) => {
			const xhr = new XMLHttpRequest();
			xhr.open('PUT', putUrl, true);
			const onAbort = () => xhr.abort();
			options.signal?.addEventListener('abort', onAbort, { once: true });
			xhr.upload.onprogress = (event) => {
				if (event.lengthComputable) {
					options.onProgress?.(event.loaded / event.total, event.loaded, event.total);
				}
			};
			const cleanup = () => options.signal?.removeEventListener('abort', onAbort);
			xhr.onload = () => {
				cleanup();
				if (xhr.status < 200 || xhr.status >= 300) {
					reject(new Error(`Multipart part upload failed: HTTP ${xhr.status}`));
					return;
				}
				resolve(xhr.getResponseHeader('ETag')?.trim() || 'uploaded');
			};
			xhr.onerror = () => {
				cleanup();
				reject(new Error('Multipart part network error'));
			};
			xhr.onabort = () => {
				cleanup();
				reject(new DOMException('Aborted', 'AbortError'));
			};
			xhr.send(body);
		});

	const attemptUpload = async (): Promise<string> => {
		attempt += 1;
		try {
			return await run();
		} catch (error) {
			if (error instanceof DOMException && error.name === 'AbortError') throw error;
			if (attempt >= maxAttempts) throw error;
			await new Promise((resolve) => setTimeout(resolve, Math.min(8000, 500 * 2 ** (attempt - 1))));
			return attemptUpload();
		}
	};
	return attemptUpload();
}

// # FN splitBlobIntoChunks
// # AR Split a large Blob into fixed-size parts for resumable multipart flows
// # KW رفع,upload,R2,storage,worker
export function splitBlobIntoChunks(
	body: Blob,
	chunkBytes = DEFAULT_CHUNK_BYTES
): ChunkedUploadPart[] {
	const size = Math.max(256 * 1024, chunkBytes);
	const parts: ChunkedUploadPart[] = [];
	let offset = 0;
	let partNumber = 1;
	while (offset < body.size) {
		const end = Math.min(body.size, offset + size);
		parts.push({ partNumber, blob: body.slice(offset, end) });
		offset = end;
		partNumber += 1;
	}
	return parts;
}

// # FN uploadLargeBlobWithProgress
// # AR Prefer a single progress-tracked PUT; chunk metadata is ready for future multipart API
// # KW رفع,upload,R2,storage
export async function uploadLargeBlobWithProgress(
	putUrl: string,
	body: Blob,
	options: DirectUploadOptions & { chunkBytes?: number } = {}
): Promise<{ parts: ChunkedUploadPart[] }> {
	const parts = body.size > (options.chunkBytes || DEFAULT_CHUNK_BYTES) * 2
		? splitBlobIntoChunks(body, options.chunkBytes)
		: [{ partNumber: 1, blob: body }];
	await uploadToPresignedUrl(putUrl, body, options);
	return { parts };
}

function uploadFingerprint(file: File): string {
	return [file.name, file.size, file.lastModified, file.type].join(':');
}

function multipartSessionKey(file: File): string {
	const text = uploadFingerprint(file);
	let hash = 2166136261;
	for (let index = 0; index < text.length; index += 1) {
		hash ^= text.charCodeAt(index);
		hash = Math.imul(hash, 16777619);
	}
	return `${SESSION_PREFIX}${(hash >>> 0).toString(16)}`;
}

function loadMultipartSession(file: File): MultipartSession | null {
	try {
		const value = JSON.parse(localStorage.getItem(multipartSessionKey(file)) || 'null');
		if (
			!value ||
			value.fingerprint !== uploadFingerprint(file) ||
			!value.upload_id ||
			!value.file_key ||
			!Array.isArray(value.parts)
		) {
			return null;
		}
		return value as MultipartSession;
	} catch {
		return null;
	}
}

function saveMultipartSession(file: File, session: MultipartSession): void {
	localStorage.setItem(multipartSessionKey(file), JSON.stringify(session));
}

async function postMultipart<T>(path: string, payload: unknown): Promise<T> {
	const response = await apiFetch(path, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(payload)
	});
	const data = await parseJsonSafe<T & { error?: string }>(response);
	if (!response.ok || !data) {
		throw new Error(data?.error || `Multipart API failed: HTTP ${response.status}`);
	}
	return data;
}

// # FN uploadFileResumableToR2
// # AR Upload files over 500 MB as parallel resumable R2 multipart parts persisted across retries
// # KW رفع,upload,R2,storage,multipart,resume,worker
export async function uploadFileResumableToR2(
	file: File,
	options: DirectUploadOptions & {
		multipartThresholdBytes?: number;
		chunkBytes?: number;
		concurrency?: number;
	} = {}
): Promise<UploadGrant> {
	const threshold = options.multipartThresholdBytes ?? MULTIPART_THRESHOLD_BYTES;
	if (file.size <= threshold) {
		const response = await apiFetch('/api/upload-url', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				filename: file.name,
				content_type: options.contentType || file.type || 'application/octet-stream'
			})
		});
		const grant = await parseJsonSafe<UploadGrant & { error?: string }>(response);
		if (!response.ok || !grant?.upload_url || !grant.file_key) {
			throw new Error(grant?.error || 'Upload grant failed');
		}
		await uploadToPresignedUrl(grant.upload_url, file, options);
		return grant;
	}

	const chunkBytes = Math.max(5 * 1024 * 1024, options.chunkBytes ?? DEFAULT_CHUNK_BYTES);
	const chunks = splitBlobIntoChunks(file, chunkBytes);
	if (chunks.length > 10_000) throw new Error('File requires more than 10,000 multipart chunks');
	let session = loadMultipartSession(file);
	if (!session || session.chunk_bytes !== chunkBytes) {
		const grant = await postMultipart<
			UploadGrant & { upload_id: string; expires_in?: number }
		>('/api/uploads/multipart/initiate', {
			filename: file.name,
			content_type: options.contentType || file.type || 'application/octet-stream',
			file_size: file.size
		});
		session = {
			fingerprint: uploadFingerprint(file),
			upload_id: grant.upload_id,
			file_key: grant.file_key,
			file_url: grant.file_url,
			download_url: grant.download_url,
			public_url: grant.public_url,
			chunk_bytes: chunkBytes,
			parts: []
		};
		saveMultipartSession(file, session);
	}

	const completed = new Map(session.parts.map((part) => [part.part_number, part]));
	const activeBytes = new Map<number, number>();
	const reportProgress = () => {
		const savedBytes = [...completed.values()].reduce((total, part) => total + part.size, 0);
		const loaded = Math.min(file.size, savedBytes + [...activeBytes.values()].reduce((a, b) => a + b, 0));
		options.onProgress?.(loaded / file.size, loaded, file.size);
	};
	reportProgress();

	const pending = chunks.filter((part) => !completed.has(part.partNumber));
	let cursor = 0;
	const uploadNext = async (): Promise<void> => {
		while (cursor < pending.length) {
			const part = pending[cursor];
			cursor += 1;
			const signed = await postMultipart<{ upload_url: string }>(
				'/api/uploads/multipart/part',
				{
					file_key: session!.file_key,
					upload_id: session!.upload_id,
					part_number: part.partNumber
				}
			);
			const etag = await uploadPartToPresignedUrl(signed.upload_url, part.blob, {
				...options,
				onProgress: (_ratio, loaded) => {
					activeBytes.set(part.partNumber, loaded);
					reportProgress();
				}
			});
			activeBytes.delete(part.partNumber);
			const result = { part_number: part.partNumber, etag, size: part.blob.size };
			completed.set(part.partNumber, result);
			session!.parts = [...completed.values()].sort((a, b) => a.part_number - b.part_number);
			saveMultipartSession(file, session!);
			reportProgress();
		}
	};
	await Promise.all(
		Array.from({ length: Math.min(Math.max(1, options.concurrency ?? 4), pending.length) }, () =>
			uploadNext()
		)
	);

	const completedGrant = await postMultipart<UploadGrant>('/api/uploads/multipart/complete', {
		file_key: session.file_key,
		upload_id: session.upload_id,
		// Rust lists authoritative R2 ETags; browser CORS need not expose them.
		parts: []
	});
	localStorage.removeItem(multipartSessionKey(file));
	options.onProgress?.(1, file.size, file.size);
	return completedGrant;
}
