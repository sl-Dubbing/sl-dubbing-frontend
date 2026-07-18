// # FILE frontend/sl-dubbing-frontend-main/src/lib/services/audio-stream-player.ts
// # AR Progressive Response playback via MediaSource with Blob fallback
// # KW توليد_صوت,TTS,streaming

export type AudioStreamPlayerOptions = {
	sampleRate?: number;
	audio?: HTMLAudioElement;
	onProgress?: (loadedBytes: number) => void;
	mimeType?: string;
};

function preferredMime(response: Response, override?: string): string {
	if (override) return override;
	const header = response.headers.get('content-type') || '';
	if (header.includes('audio/')) return header.split(';')[0].trim();
	return 'audio/mpeg';
}

function canUseMediaSource(mimeType: string): boolean {
	return (
		typeof MediaSource !== 'undefined' &&
		typeof MediaSource.isTypeSupported === 'function' &&
		MediaSource.isTypeSupported(mimeType)
	);
}

// # FN createAudioStreamPlayer
// # AR Create an abortable player that starts audio before the full body arrives
// # KW توليد_صوت,TTS,streaming
export function createAudioStreamPlayer(options: AudioStreamPlayerOptions = {}) {
	let audio = options.audio || null;
	let objectUrl = '';
	let controller: AbortController | null = null;
	let activeReader: ReadableStreamDefaultReader<Uint8Array> | null = null;
	let mediaSource: MediaSource | null = null;

	function cleanupUrl(): void {
		if (!objectUrl) return;
		URL.revokeObjectURL(objectUrl);
		objectUrl = '';
	}

	function resetMediaSource(): void {
		if (mediaSource && mediaSource.readyState === 'open') {
			try {
				mediaSource.endOfStream();
			} catch {
				/* ignore */
			}
		}
		mediaSource = null;
	}

	async function playWithMediaSource(response: Response, mimeType: string): Promise<void> {
		const reader = response.body?.getReader();
		if (!reader) throw new Error('Audio response has no readable body');
		activeReader = reader;

		mediaSource = new MediaSource();
		cleanupUrl();
		objectUrl = URL.createObjectURL(mediaSource);
		audio ||= new Audio();
		audio.src = objectUrl;

		await new Promise<void>((resolve, reject) => {
			mediaSource!.addEventListener('sourceopen', () => resolve(), { once: true });
			mediaSource!.addEventListener(
				'error',
				() => reject(new Error('MediaSource failed to open')),
				{ once: true }
			);
		});

		const sourceBuffer = mediaSource.addSourceBuffer(mimeType);
		let loaded = 0;
		let started = false;

		const append = (chunk: Uint8Array) =>
			new Promise<void>((resolve, reject) => {
				const onUpdate = () => {
					sourceBuffer.removeEventListener('updateend', onUpdate);
					sourceBuffer.removeEventListener('error', onError);
					resolve();
				};
				const onError = () => {
					sourceBuffer.removeEventListener('updateend', onUpdate);
					sourceBuffer.removeEventListener('error', onError);
					reject(new Error('SourceBuffer append failed'));
				};
				sourceBuffer.addEventListener('updateend', onUpdate);
				sourceBuffer.addEventListener('error', onError);
				sourceBuffer.appendBuffer(chunk.slice().buffer);
			});

		try {
			while (true) {
				if (controller?.signal.aborted) throw new DOMException('Aborted', 'AbortError');
				const { done, value } = await reader.read();
				if (done) break;
				if (!value?.byteLength) continue;
				loaded += value.byteLength;
				options.onProgress?.(loaded);
				while (sourceBuffer.updating) {
					await new Promise((resolve) =>
						sourceBuffer.addEventListener('updateend', () => resolve(undefined), { once: true })
					);
				}
				await append(value);
				if (!started) {
					started = true;
					await audio.play();
				}
			}
			while (sourceBuffer.updating) {
				await new Promise((resolve) =>
					sourceBuffer.addEventListener('updateend', () => resolve(undefined), { once: true })
				);
			}
			if (mediaSource.readyState === 'open') mediaSource.endOfStream();
		} finally {
			activeReader = null;
		}
	}

	async function playBlobFallback(response: Response, mimeType: string): Promise<void> {
		const reader = response.body?.getReader();
		if (!reader) throw new Error('Audio response has no readable body');
		activeReader = reader;
		const chunks: Uint8Array[] = [];
		let loaded = 0;
		while (true) {
			if (controller?.signal.aborted) throw new DOMException('Aborted', 'AbortError');
			const { done, value } = await reader.read();
			if (done) break;
			if (value) {
				chunks.push(value);
				loaded += value.byteLength;
				options.onProgress?.(loaded);
			}
		}
		activeReader = null;
		const blob = new Blob(chunks as BlobPart[], { type: mimeType });
		cleanupUrl();
		objectUrl = URL.createObjectURL(blob);
		audio ||= new Audio();
		audio.src = objectUrl;
		await audio.play();
	}

	return {
		get element(): HTMLAudioElement | null {
			return audio;
		},
		async playStream(response: Response): Promise<void> {
			if (!response.ok) throw new Error(`Audio stream failed: HTTP ${response.status}`);
			controller?.abort();
			void activeReader?.cancel();
			activeReader = null;
			resetMediaSource();
			controller = new AbortController();
			const mimeType = preferredMime(response, options.mimeType);
			if (canUseMediaSource(mimeType) && response.body) {
				// # guard — cloning a live stream tees and buffers the unread branch in memory
				await playWithMediaSource(response, mimeType);
				return;
			}
			await playBlobFallback(response, mimeType);
		},
		async playUrl(url: string): Promise<void> {
			if (url.startsWith('data:audio/')) {
				audio ||= new Audio();
				audio.src = url;
				await audio.play();
				return;
			}
			const response = await fetch(url);
			await this.playStream(response);
		},
		stop(): void {
			controller?.abort();
			controller = null;
			void activeReader?.cancel();
			activeReader = null;
			if (audio) {
				audio.pause();
				audio.removeAttribute('src');
				audio.load();
			}
			resetMediaSource();
			cleanupUrl();
		}
	};
}
