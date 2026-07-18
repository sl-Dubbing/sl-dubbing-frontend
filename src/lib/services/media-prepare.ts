// # FILE frontend/sl-dubbing-frontend-main/src/lib/services/media-prepare.ts
// # AR Local media prep: extract audio in-browser before R2 upload when safe
// # KW صوت_معالجة,ffmpeg,رفع,upload,WASM,worker

import type { FfmpegProgress } from '$lib/services/ffmpeg';

let browserFfmpegUsed = false;

export type PreparedMedia = {
	uploadFile: File;
	mode: 'audio-only' | 'original';
	originalFile: File;
	extractedAudio?: Blob;
};

export type PrepareMediaOptions = {
	enableLipsync?: boolean;
	forceOriginal?: boolean;
	/** Prefer local extract when video is larger than this (bytes). */
	minBytesForExtract?: number;
	/** Keep FFmpeg.wasm below its practical 32-bit browser memory ceiling. */
	maxBytesForExtract?: number;
	onStatus?: (message: string) => void;
	onProgress?: (event: FfmpegProgress) => void;
};

function isVideoFile(file: File): boolean {
	return file.type.startsWith('video/') || /\.(mp4|mov|webm|mkv|m4v)$/i.test(file.name);
}

function audioFileName(source: File): string {
	const base = source.name.replace(/\.[^.]+$/, '') || 'audio';
	return `${base}.wav`;
}

// # FN shouldExtractAudioLocally
// # AR Decide when browser extraction beats uploading the full video
// # KW صوت_معالجة,ffmpeg,رفع,upload
export function shouldExtractAudioLocally(
	file: File,
	options: PrepareMediaOptions = {}
): boolean {
	if (options.forceOriginal || options.enableLipsync) return false;
	if (!isVideoFile(file)) return false;
	const minBytes = options.minBytesForExtract ?? 8 * 1024 * 1024;
	const deviceMemoryGb =
		typeof navigator !== 'undefined' && 'deviceMemory' in navigator
			? Number((navigator as Navigator & { deviceMemory?: number }).deviceMemory || 4)
			: 4;
	const memoryAwareMax = Math.min(1024 * 1024 * 1024, Math.max(256, deviceMemoryGb * 128) * 1024 * 1024);
	const maxBytes = options.maxBytesForExtract ?? memoryAwareMax;
	return file.size >= minBytes && file.size <= maxBytes;
}

// # FN prepareMediaForUpload
// # AR Extract mono 16 kHz WAV locally when lipsync is off; else keep original
// # KW صوت_معالجة,ffmpeg,رفع,upload,WASM
export async function prepareMediaForUpload(
	file: File,
	options: PrepareMediaOptions = {}
): Promise<PreparedMedia> {
	if (!shouldExtractAudioLocally(file, options)) {
		return { uploadFile: file, mode: 'original', originalFile: file };
	}

	options.onStatus?.('Extracting audio locally (no full-video upload)…');
	try {
		browserFfmpegUsed = true;
		const { extractAudioWithFfmpegWasm } = await import('$lib/services/ffmpeg');
		const extractedAudio = await extractAudioWithFfmpegWasm(file, {
			sampleRate: 16000,
			channels: 1,
			onProgress: options.onProgress
		});
		const uploadFile = new File([extractedAudio], audioFileName(file), {
			type: 'audio/wav',
			lastModified: Date.now()
		});
		options.onStatus?.(
			`Local audio ready (${Math.max(1, Math.round(uploadFile.size / (1024 * 1024)))} MB) — uploading…`
		);
		return {
			uploadFile,
			mode: 'audio-only',
			originalFile: file,
			extractedAudio
		};
	} catch (error) {
		console.warn('[media-prepare] local extract failed; uploading original', error);
		options.onStatus?.('Local extract unavailable — uploading original media…');
		return { uploadFile: file, mode: 'original', originalFile: file };
	}
}

// # FN remuxDubbedAudioOntoVideo
// # AR Replace video soundtrack with dubbed audio inside the browser
// # KW صوت_معالجة,ffmpeg,فيديو,WASM
export async function remuxDubbedAudioOntoVideo(
	videoFile: File,
	dubbedAudio: Blob,
	options: { onProgress?: (event: FfmpegProgress) => void } = {}
): Promise<Blob> {
	browserFfmpegUsed = true;
	const { loadBrowserFfmpeg } = await import('$lib/services/ffmpeg');
	const { fetchFile } = await import('@ffmpeg/util');
	const ffmpeg = await loadBrowserFfmpeg({ onProgress: options.onProgress });
	const videoName = `video-${crypto.randomUUID()}.mp4`;
	const audioName = `dub-${crypto.randomUUID()}.wav`;
	const outName = `out-${crypto.randomUUID()}.mp4`;
	await ffmpeg.writeFile(videoName, await fetchFile(videoFile));
	await ffmpeg.writeFile(audioName, await fetchFile(dubbedAudio));
	try {
		await ffmpeg.exec([
			'-i',
			videoName,
			'-i',
			audioName,
			'-map',
			'0:v:0',
			'-map',
			'1:a:0',
			'-c:v',
			'copy',
			'-c:a',
			'aac',
			'-shortest',
			outName
		]);
		const result = await ffmpeg.readFile(outName);
		if (typeof result === 'string') throw new Error('Remux returned an invalid buffer');
		const bytes = Uint8Array.from(result);
		return new Blob([bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)], {
			type: 'video/mp4'
		});
	} finally {
		await Promise.allSettled([
			ffmpeg.deleteFile(videoName),
			ffmpeg.deleteFile(audioName),
			ffmpeg.deleteFile(outName)
		]);
	}
}

// # FN releaseMediaPrepareResources
// # AR Drop FFmpeg WASM memory after a dubbing session ends
// # KW صوت_معالجة,ffmpeg,WASM
export async function releaseMediaPrepareResources(): Promise<void> {
	if (!browserFfmpegUsed) return;
	const { terminateBrowserFfmpeg } = await import('$lib/services/ffmpeg');
	await terminateBrowserFfmpeg();
	browserFfmpegUsed = false;
}
