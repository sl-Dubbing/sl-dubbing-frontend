// # FILE frontend/sl-dubbing-frontend-main/src/lib/services/ffmpeg.ts
// # AR Lazy FFmpeg.wasm browser media preparation
// # KW صوت_معالجة,ffmpeg,mix,LUFS,WASM,worker

import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

export type FfmpegProgress = {
	progress: number;
	time: number;
};

export type ExtractAudioOptions = {
	sampleRate?: number;
	channels?: 1 | 2;
	/** Prefer compressed MP3 for fast ASR upload; wav keeps PCM for legacy remux helpers. */
	format?: 'mp3' | 'wav';
	bitrate?: string;
	onProgress?: (event: FfmpegProgress) => void;
	coreBaseUrl?: string;
};

let ffmpegPromise: Promise<FFmpeg> | null = null;

// # FN loadBrowserFfmpeg
// # AR Lazily load the FFmpeg core only when local media preparation is requested
// # KW صوت_معالجة,ffmpeg,WASM,worker
export function loadBrowserFfmpeg(options: ExtractAudioOptions = {}): Promise<FFmpeg> {
	if (ffmpegPromise) return ffmpegPromise;
	ffmpegPromise = (async () => {
		const ffmpeg = new FFmpeg();
		if (options.onProgress) ffmpeg.on('progress', options.onProgress);
		const base =
			options.coreBaseUrl ||
			'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm';
		await ffmpeg.load({
			coreURL: await toBlobURL(`${base}/ffmpeg-core.js`, 'text/javascript'),
			wasmURL: await toBlobURL(`${base}/ffmpeg-core.wasm`, 'application/wasm')
		});
		return ffmpeg;
	})().catch((error) => {
		ffmpegPromise = null;
		throw error;
	});
	return ffmpegPromise;
}

// # FN extractAudioWithFfmpegWasm
// # AR Convert browser media to mono speech audio (compressed MP3 by default) in FFmpeg's worker
// # KW صوت_معالجة,ffmpeg,mix,LUFS,WASM,worker
export async function extractAudioWithFfmpegWasm(
	input: File,
	options: ExtractAudioOptions = {}
): Promise<Blob> {
	const ffmpeg = await loadBrowserFfmpeg(options);
	const format = options.format || 'mp3';
	const extension = input.name.split('.').pop()?.replace(/[^a-z0-9]/gi, '') || 'bin';
	const inputName = `input-${crypto.randomUUID()}.${extension}`;
	const outputName = `audio-${crypto.randomUUID()}.${format}`;
	await ffmpeg.writeFile(inputName, await fetchFile(input));
	try {
		const args =
			format === 'wav'
				? [
						'-i',
						inputName,
						'-vn',
						'-ac',
						String(options.channels || 1),
						'-ar',
						String(options.sampleRate || 16000),
						'-c:a',
						'pcm_s16le',
						outputName
					]
				: [
						'-i',
						inputName,
						'-vn',
						'-ac',
						String(options.channels || 1),
						'-ar',
						String(options.sampleRate || 16000),
						'-b:a',
						options.bitrate || '64k',
						'-c:a',
						'libmp3lame',
						outputName
					];
		await ffmpeg.exec(args);
		const result = await ffmpeg.readFile(outputName);
		if (typeof result === 'string') throw new Error('FFmpeg returned an invalid audio buffer');
		const bytes = Uint8Array.from(result);
		return new Blob([bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)], {
			type: format === 'wav' ? 'audio/wav' : 'audio/mpeg'
		});
	} finally {
		await Promise.allSettled([ffmpeg.deleteFile(inputName), ffmpeg.deleteFile(outputName)]);
	}
}

// # FN terminateBrowserFfmpeg
// # AR Release the FFmpeg worker and WASM memory
// # KW صوت_معالجة,ffmpeg,WASM,worker
export async function terminateBrowserFfmpeg(): Promise<void> {
	if (!ffmpegPromise) return;
	try {
		const ffmpeg = await ffmpegPromise;
		ffmpeg.terminate();
	} finally {
		ffmpegPromise = null;
	}
}
