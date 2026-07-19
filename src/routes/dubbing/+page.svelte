<script lang="ts">
	import { onMount } from 'svelte';
	import { get } from 'svelte/store';
	import LanguageSelect from '$lib/components/LanguageSelect.svelte';
	import SrtEditor from '$lib/components/SrtEditor.svelte';
	import VoicePicker from '$lib/components/VoicePicker.svelte';
	import { appConfig } from '$lib/config';
	import { apiBase, apiFetch, parseJsonSafe } from '$lib/services/api';
	import { getApiAuthHeaders, refreshApiAuthHeadersFromSupabase } from '$lib/services/auth-headers';
	import {
		findLanguage,
		loadLanguages,
		type Language
	} from '$lib/services/languages';
	import {
		cloneSegments,
		translateSegmentsLiteralApi,
		type ScriptSegment
	} from '$lib/services/srt';
	import type { Voice } from '$lib/services/voices';
	import {
		prepareMediaForUpload,
		releaseMediaPrepareResources,
		remuxDubbedAudioOntoVideo,
		type PreparedMedia
	} from '$lib/services/media-prepare';
	import { uploadFileResumableToR2 } from '$lib/services/r2-upload';
	import { auth, refreshUserCreditsInMenu } from '$lib/stores/auth';
	import { showToast } from '$lib/stores/toast';

	type UploadGrant = {
		file_key?: string;
		key?: string;
		upload_url?: string;
		put_url?: string;
		url?: string;
		get_url?: string;
	};

	type PendingJob = {
		jobId: string;
		langCode: string;
		langName: string;
		startedAt: string;
	};

	type ResultItem = {
		jobId: string;
		langCode: string;
		langName: string;
		url: string;
	};

	let file = $state<File | null>(null);
	let previewUrl = $state<string | null>(null);
	let isVideo = $state(true);
	let durationSeconds = $state(0);
	let languages = $state<Language[]>([]);
	let sourceLang = $state('en-us');
	let targetLangs = $state<string[]>(['ar']);
	let selectedVoice = $state<Voice | null>(null);
	let speakerMode = $state('auto');
	let enableLipsync = $state(false);
	let quality = $state('fast');
	let segments = $state<ScriptSegment[]>([]);
	let sourceSegments = $state<ScriptSegment[]>([]);
	let srtStatus = $state('');
	let uploadedKey = $state('');
	let audioUploadedKey = $state('');
	let videoUploadedKey = $state('');
	let videoUploadPromise = $state<Promise<UploadGrant> | null>(null);
	let uploadGrant = $state<UploadGrant | null>(null);
	let preparedMedia = $state<PreparedMedia | null>(null);
	let progress = $state(0);
	let statusText = $state('');
	let busy = $state(false);
	let extracting = $state(false);
	let activeJobIds = $state<string[]>([]);
	let results = $state<ResultItem[]>([]);
	let activeResult = $state<ResultItem | null>(null);
	let abort: AbortController | null = null;

	const PENDING_PREFIX = 'glotix_pending_dub_jobs_';
	const MAX_BYTES = 5 * 1024 * 1024 * 1024;

	onMount(() => {
		void loadLanguages().then((items) => {
			languages = items;
			if (!findLanguage(items, sourceLang)) sourceLang = items[0]?.code || 'en-us';
			targetLangs = targetLangs.filter((code) => findLanguage(items, code));
			if (!targetLangs.length && items[0]) targetLangs = [items[0].code];
		});
		// # guard — Wait for auth.ready so pending jobs load under the real user id, not guest.
		void waitForAuthReady().then(() => resumePendingJobs());
		return () => {
			abort?.abort();
			if (previewUrl) URL.revokeObjectURL(previewUrl);
			// # guard — Remuxed blob: URLs are not freed by clearing results alone.
			revokeResultBlobUrls(results);
			void releaseMediaPrepareResources();
		};
	});

	async function waitForAuthReady(): Promise<void> {
		if (get(auth).ready) return;
		await new Promise<void>((resolve) => {
			const unsub = auth.subscribe((state) => {
				if (state.ready) {
					unsub();
					resolve();
				}
			});
		});
	}

	function revokeResultBlobUrls(items: ResultItem[]) {
		for (const item of items) {
			if (item.url?.startsWith('blob:')) URL.revokeObjectURL(item.url);
		}
	}

	function storageKey(): string {
		return `${PENDING_PREFIX}${$auth.user?.id || 'guest'}`;
	}

	function loadPending(): PendingJob[] {
		try {
			const parsed = JSON.parse(localStorage.getItem(storageKey()) || '[]');
			return Array.isArray(parsed) ? parsed : [];
		} catch {
			return [];
		}
	}

	// # FN registerPendingDubJob
	// # AR Persist one in-flight job so a refresh resumes status watching
	// # KW مهمة,job,polling,storage
	function registerPending(job: PendingJob) {
		const list = loadPending().filter((item) => item.jobId !== job.jobId);
		list.push(job);
		localStorage.setItem(storageKey(), JSON.stringify(list));
	}

	// # FN clearPendingDubJob
	// # AR Remove a terminal job from refresh-resume storage
	// # KW مهمة,job,polling,storage
	function clearPending(jobId: string) {
		localStorage.setItem(
			storageKey(),
			JSON.stringify(loadPending().filter((item) => item.jobId !== jobId))
		);
	}

	function onPick(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const next = input.files?.[0] || null;
		if (next && next.size > MAX_BYTES) {
			showToast('File too large (maximum 5 GB)', 'error');
			input.value = '';
			return;
		}
		file = next;
		if (previewUrl) URL.revokeObjectURL(previewUrl);
		revokeResultBlobUrls(results);
		previewUrl = next ? URL.createObjectURL(next) : null;
		isVideo = !!(
			next &&
			(next.type.startsWith('video/') || /\.(mp4|mov|webm|mkv)$/i.test(next.name))
		);
		durationSeconds = 0;
		segments = [];
		sourceSegments = [];
		uploadedKey = '';
		audioUploadedKey = '';
		videoUploadedKey = '';
		videoUploadPromise = null;
		uploadGrant = null;
		preparedMedia = null;
		results = [];
		activeResult = null;
		progress = 0;
		statusText = '';
		void releaseMediaPrepareResources();
	}

	function readDuration(event: Event) {
		const media = event.currentTarget as HTMLMediaElement;
		durationSeconds = Number.isFinite(media.duration) ? media.duration : 0;
	}

	// # FN uploadMediaFileToR2PresignedUrl
	// # AR Fast path: upload compressed audio for ASR and start video upload in parallel
	// # KW رفع,upload,R2,storage,ffmpeg,WASM
	async function ensureUploaded(): Promise<UploadGrant> {
		if (videoUploadedKey && uploadGrant?.file_key === videoUploadedKey) return uploadGrant;
		if (audioUploadedKey && preparedMedia?.mode === 'audio-only' && !videoUploadedKey) {
			// Audio ready; video may still be uploading — return audio grant for ASR
			if (uploadGrant?.file_key === audioUploadedKey) return uploadGrant;
		}
		if (!file) throw new Error('Select a media file first');

		const prepared =
			preparedMedia && preparedMedia.originalFile === file
				? preparedMedia
				: await prepareMediaForUpload(file, {
						enableLipsync,
						onStatus: (message) => {
							statusText = message;
						},
						onProgress: (event) => {
							progress = Math.min(30, Math.round((event.progress || 0) * 30));
						}
					});
		preparedMedia = prepared;

		if (prepared.mode === 'audio-only' && prepared.audioFile) {
			statusText = 'Uploading extracted audio directly to storage…';
			const audioGrant = await uploadFileResumableToR2(prepared.audioFile, {
				contentType: 'audio/mpeg',
				signal: abort?.signal,
				onProgress: (ratio) => {
					progress = Math.max(progress, Math.round(30 + ratio * 20));
				}
			});
			const audioKey = audioGrant.file_key;
			if (!audioKey) throw new Error('Incomplete audio upload grant');
			audioUploadedKey = audioKey;
			uploadedKey = audioKey;
			uploadGrant = audioGrant;

			videoUploadPromise = uploadFileResumableToR2(file, {
				contentType: file.type || 'application/octet-stream',
				signal: abort?.signal,
				onProgress: (ratio) => {
					progress = Math.max(progress, Math.round(50 + ratio * 10));
					statusText = 'Background video upload…';
				}
			}).then((grant) => {
				const key = grant.file_key;
				if (!key) throw new Error('Incomplete video upload grant');
				videoUploadedKey = key;
				uploadGrant = grant;
				return grant;
			});

			progress = Math.max(progress, 50);
			statusText = 'Audio uploaded — transcript can start while video uploads';
			return audioGrant;
		}

		statusText = 'Uploading media directly to storage…';
		const grant = await uploadFileResumableToR2(prepared.uploadFile, {
			contentType: prepared.uploadFile.type || 'application/octet-stream',
			signal: abort?.signal,
			onProgress: (ratio) => {
				progress = Math.max(progress, Math.round(30 + ratio * 25));
			}
		});
		const fileKey = grant.file_key;
		if (!fileKey) throw new Error('Incomplete upload grant');
		uploadedKey = fileKey;
		videoUploadedKey = fileKey;
		audioUploadedKey = '';
		uploadGrant = grant;
		progress = Math.max(progress, 55);
		statusText = 'Media uploaded';
		return grant;
	}

	async function ensureVideoReadyForDub(): Promise<string> {
		if (videoUploadedKey) return videoUploadedKey;
		let pending = videoUploadPromise;
		if (pending) {
			statusText = 'Finishing background video upload…';
			const grant = await pending;
			const key = grant.file_key;
			if (!key) throw new Error('Video upload incomplete');
			videoUploadedKey = key;
			return key;
		}
		const grant = await ensureUploaded();
		pending = videoUploadPromise;
		if (pending) {
			const videoGrant = await pending;
			const key = videoGrant.file_key;
			if (!key) throw new Error('Video upload incomplete');
			videoUploadedKey = key;
			return key;
		}
		const key = grant.file_key || videoUploadedKey || uploadedKey;
		if (!key) throw new Error('Video file_key missing');
		videoUploadedKey = key;
		return key;
	}

	// # FN extractScriptFromMedia
	// # AR Upload media if needed, transcribe it, and show editable cues
	// # KW تفريغ,asr,srt
	async function extractScript() {
		if (!$auth.user) return showToast('Please sign in first', 'error');
		if (!file) return showToast('Select a media file first', 'error');
		if (!sourceLang) return showToast('Select original media language', 'error');
		extracting = true;
		srtStatus = 'Uploading & extracting script…';
		try {
			await ensureUploaded();
			const transcribeBody: Record<string, string> = {
				source_language: sourceLang
			};
			if (audioUploadedKey && preparedMedia?.mode === 'audio-only') {
				transcribeBody.audio_file_key = audioUploadedKey;
				transcribeBody.file_key = audioUploadedKey;
			} else {
				transcribeBody.file_key = uploadedKey;
			}
			const res = await apiFetch('/api/dub/transcribe', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(transcribeBody)
			});
			const data = await parseJsonSafe<{
				success?: boolean;
				segments?: ScriptSegment[];
				error?: string;
			}>(res);
			if (!res.ok || !data?.success) throw new Error(data?.error || 'Transcript preview failed');
			sourceSegments = cloneSegments(data.segments || []);
			segments = sourceSegments.map((segment) => ({ ...segment }));
			showToast(
				segments.length ? `Loaded ${segments.length} cue(s)` : 'No speech cues found',
				segments.length ? 'success' : 'info'
			);
		} catch (error) {
			showToast(error instanceof Error ? error.message : 'Extract failed', 'error');
		} finally {
			extracting = false;
			srtStatus = '';
		}
	}

	function voicePayload() {
		const voice = selectedVoice;
		let effectiveQuality = quality;
		if (effectiveQuality === 'fast' && (!voice || voice.source === 'video')) {
			effectiveQuality = 'studio';
			showToast('Fast Dub needs Default/Premium voice — using Studio for video clone', 'info');
		}
		if (!voice || voice.source === 'video') {
			return {
				voice_mode: 'clone',
				clone_source: 'video',
				speaker_mode: speakerMode,
				enable_lipsync: enableLipsync,
				quality: effectiveQuality
			};
		}
		if (voice.source === 'default') {
			return {
				voice_mode: 'default',
				speaker_mode: speakerMode,
				enable_lipsync: enableLipsync,
				quality: effectiveQuality
			};
		}
		return {
			voice_mode: 'clone',
			clone_source:
				voice.source === 'upload'
					? 'library'
					: voice.source === 'premium'
						? 'premium'
						: voice.source,
			sample_url: voice.sample_url,
			sample_text: voice.sample_text || '',
			elevenlabs_voice_id: voice.elevenlabs_voice_id || '',
			use_saved_voice: voice.source === 'saved',
			speaker_mode: speakerMode,
			enable_lipsync: enableLipsync,
			quality: effectiveQuality
		};
	}

	function outputUrl(payload: Record<string, unknown>): string {
		const nested = payload.result as Record<string, unknown> | undefined;
		return String(
			payload.output_url ||
				payload.media_url ||
				payload.dubbed_url ||
				payload.file_url ||
				payload.result_url ||
				payload.url ||
				nested?.output_url ||
				nested?.url ||
				''
		);
	}

	// # FN watchDubbingJobUntilFinished
	// # AR Watch SSE and polling concurrently; first terminal result wins
	// # KW مهمة,job,polling,SSE,status
	async function watchJob(job: PendingJob, signal: AbortSignal): Promise<ResultItem> {
		let headers = (await refreshApiAuthHeadersFromSupabase()) || getApiAuthHeaders();
		let done = false;
		let eventSource: EventSource | null = null;
		// # guard — Upload UI can sit at ~55%; map Modal 0–100 into the remaining band so the bar never freezes.
		const progressFloor = Math.min(Math.max(progress, 0), 55);
		const startedAt = Date.now();
		const maxWatchMs = 45 * 60 * 1000;

		return new Promise<ResultItem>((resolve, reject) => {
			const stop = () => {
				done = true;
				eventSource?.close();
			};
			const handle = (payload: Record<string, unknown>) => {
				const state = String(payload.status || payload.state || '').toLowerCase();
				const apiProgress = Number(payload.progress ?? payload.percent ?? 0);
				if (Number.isFinite(apiProgress) && apiProgress > 0) {
					const mapped = progressFloor + (apiProgress / 100) * (96 - progressFloor);
					progress = Math.max(progress, Math.min(96, mapped));
				}
				const stage = String(payload.stage || '').trim();
				const message = String(payload.message || '').trim();
				statusText = message || stage || state || 'Processing…';
				if (['completed', 'done', 'success', 'complete', 'succeeded'].includes(state)) {
					const url = outputUrl(payload);
					stop();
					if (!url) return reject(new Error(`${job.langName}: completed without media URL`));
					resolve({ jobId: job.jobId, langCode: job.langCode, langName: job.langName, url });
				}
				if (['failed', 'error', 'failure', 'fail'].includes(state)) {
					stop();
					reject(new Error(String(payload.error || payload.message || `${job.langName} failed`)));
				}
				if (['cancelled', 'canceled'].includes(state)) {
					stop();
					reject(new DOMException('Cancelled', 'AbortError'));
				}
			};

			if (appConfig.DUB_USE_SSE && headers) {
				void fetch(`${apiBase()}/api/dub/status/${encodeURIComponent(job.jobId)}/sse-ticket`, {
					method: 'POST',
					headers
				})
					.then(async (ticketRes) => {
						if (!ticketRes.ok || done) return;
						const ticketPayload = await parseJsonSafe<{ sse_ticket?: string }>(ticketRes);
						const ticket = String(ticketPayload?.sse_ticket || '').trim();
						if (!ticket || done) return;
						const url = `${apiBase()}/api/dub/status/${encodeURIComponent(job.jobId)}?sse_ticket=${encodeURIComponent(ticket)}`;
						eventSource = new EventSource(url);
						const onSse = (event: MessageEvent) => {
							try {
								handle(JSON.parse(event.data) as Record<string, unknown>);
							} catch {
								/* ignore malformed event */
							}
						};
						eventSource.onmessage = onSse;
						eventSource.addEventListener('progress', onSse);
						eventSource.addEventListener('completed', onSse);
						eventSource.addEventListener('failed', onSse);
						eventSource.onerror = () => eventSource?.close();
					})
					.catch(() => {
						/* fall through to polling */
					});
			}

			void (async () => {
				let notFoundStreak = 0;
				while (!done && !signal.aborted) {
					if (Date.now() - startedAt > maxWatchMs) {
						stop();
						reject(new Error(`${job.langName}: timed out waiting for job status`));
						return;
					}
					try {
						let res = await fetch(`${apiBase()}/api/job/${encodeURIComponent(job.jobId)}`, {
							headers: headers || undefined,
							signal
						});
						if (res.status === 401) {
							headers = (await refreshApiAuthHeadersFromSupabase()) || getApiAuthHeaders();
							res = await fetch(`${apiBase()}/api/job/${encodeURIComponent(job.jobId)}`, {
								headers: headers || undefined,
								signal
							});
						}
						if (res.status === 404) {
							notFoundStreak += 1;
							if (notFoundStreak >= 5) {
								stop();
								reject(new Error(`${job.langName}: job not found`));
								return;
							}
						} else {
							notFoundStreak = 0;
						}
						if (res.ok) {
							const payload = await parseJsonSafe<Record<string, unknown>>(res);
							if (payload) handle(payload);
						}
					} catch (error) {
						if ((error as Error).name === 'AbortError') break;
					}
					await new Promise((timerResolve) => setTimeout(timerResolve, 3000));
				}
				if (signal.aborted && !done) {
					stop();
					reject(new DOMException('Aborted', 'AbortError'));
				}
			})();
		});
	}

	async function segmentsForTarget(code: string): Promise<ScriptSegment[]> {
		const source = cloneSegments(sourceSegments.length ? sourceSegments : segments);
		const sourceBase = findLanguage(languages, sourceLang)?.base_lang || sourceLang.split('-')[0];
		const targetBase = findLanguage(languages, code)?.base_lang || code.split('-')[0];
		if (sourceBase === targetBase) return source;
		srtStatus = `Translating script to ${findLanguage(languages, code)?.name_en || code}…`;
		return translateSegmentsLiteralApi(source, targetBase);
	}

	async function finalizeResultItem(item: ResultItem): Promise<ResultItem> {
		// Server Fast path now muxes on Modal; keep local remux only as a last-resort fallback.
		if (!(preparedMedia?.mode === 'audio-only' && isVideo && preparedMedia.originalFile)) {
			return item;
		}
		if (item.url && /\.(mp4|webm|mov)(\?|$)/i.test(item.url)) {
			return item;
		}
		try {
			statusText = `Remuxing ${item.langName} onto original video locally…`;
			const audioRes = await fetch(item.url);
			if (!audioRes.ok) throw new Error('Could not download dubbed audio for remux');
			const audioBlob = await audioRes.blob();
			const remuxed = await remuxDubbedAudioOntoVideo(preparedMedia.originalFile, audioBlob, {
				onProgress: (event) => {
					progress = Math.min(99, Math.round(90 + (event.progress || 0) * 9));
				}
			});
			return { ...item, url: URL.createObjectURL(remuxed) };
		} catch (error) {
			console.warn('[dubbing] local remux failed', error);
			showToast('Dubbed audio ready (local video remux skipped)', 'info');
			return item;
		}
	}

	async function startOneLanguage(code: string, signal: AbortSignal): Promise<ResultItem> {
		const language = findLanguage(languages, code);
		const voice = voicePayload();
		const translated = await segmentsForTarget(code);
		const source = findLanguage(languages, sourceLang);
		const videoKey = await ensureVideoReadyForDub();
		const body: Record<string, unknown> = {
			file_key: videoKey,
			lang: code,
			target_language: language?.base_lang || code.split('-')[0],
			dialect: language?.dialect || '',
			source_language: source?.base_lang || sourceLang.split('-')[0],
			source_dialect: source?.dialect || '',
			translate: false,
			voice_config: voice,
			sample_url: 'sample_url' in voice ? voice.sample_url : '',
			sample_text: 'sample_text' in voice ? voice.sample_text : '',
			voice_mode: voice.voice_mode,
			clone_source: 'clone_source' in voice ? voice.clone_source : '',
			speaker_mode: speakerMode,
			enable_lipsync: enableLipsync,
			use_saved_voice: 'use_saved_voice' in voice ? voice.use_saved_voice : false,
			quality: 'quality' in voice ? voice.quality : quality,
			elevenlabs_voice_id:
				'elevenlabs_voice_id' in voice ? voice.elevenlabs_voice_id || '' : '',
			video_output: isVideo,
			segments: translated,
			script_segments: translated
		};
		if (audioUploadedKey && preparedMedia?.mode === 'audio-only') {
			body.audio_file_key = audioUploadedKey;
		}
		const res = await apiFetch('/api/dub', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body),
			signal
		});
		const data = await parseJsonSafe<{
			job_id?: string;
			id?: string;
			error?: string;
			message?: string;
			required?: number;
			balance?: number;
		}>(res);
		if (!res.ok) {
			if (res.status === 402) {
				throw new Error(
					`Insufficient credits (required ${data?.required ?? '?'}, balance ${data?.balance ?? '?'})`
				);
			}
			throw new Error(data?.error || data?.message || `${language?.name_en || code} failed to start`);
		}
		const id = data?.job_id || data?.id;
		if (!id) throw new Error('Server did not return a job id');
		const pending: PendingJob = {
			jobId: id,
			langCode: code,
			langName: language?.name_en || code,
			startedAt: new Date().toISOString()
		};
		activeJobIds = [...activeJobIds, id];
		registerPending(pending);
		try {
			const finished = await watchJob(pending, signal);
			return await finalizeResultItem(finished);
		} finally {
			clearPending(id);
			activeJobIds = activeJobIds.filter((item) => item !== id);
		}
	}

	// # FN handleStartDubbingButtonClick
	// # AR First click extracts script; after review starts all target jobs
	// # KW تفريغ,asr,srt,مهمة,job
	async function handleStart() {
		if (busy) return;
		if (!$auth.user) return showToast('Please sign in first', 'error');
		if (!file) return showToast('Please select a media file', 'error');
		if (!sourceLang) return showToast('Select original media language', 'error');
		if (!targetLangs.length) return showToast('Select target languages', 'error');
		if (!segments.some((segment) => segment.text.trim())) {
			await extractScript();
			return;
		}

		busy = true;
		progress = 5;
		revokeResultBlobUrls(results);
		results = [];
		activeResult = null;
		abort?.abort();
		abort = new AbortController();
		try {
			await ensureUploaded();
			statusText = 'Starting dubbing jobs…';
			const settled = await Promise.allSettled(
				targetLangs.map((code) => startOneLanguage(code, abort!.signal))
			);
			for (const item of settled) {
				if (item.status === 'fulfilled') {
					results = [...results, item.value];
					activeResult ||= item.value;
				} else if ((item.reason as Error)?.name !== 'AbortError') {
					showToast((item.reason as Error)?.message || 'One language failed', 'error');
				}
			}
			if (results.length) {
				progress = 100;
				statusText = results.length === targetLangs.length ? 'All done!' : 'Completed with errors';
				showToast(`${results.length} dubbing result(s) ready`, 'success');
				await refreshUserCreditsInMenu();
			} else if (!abort.signal.aborted) {
				statusText = 'Dubbing failed';
			}
		} catch (error) {
			if ((error as Error).name !== 'AbortError') {
				showToast(error instanceof Error ? error.message : 'Dubbing failed', 'error');
			}
		} finally {
			busy = false;
			srtStatus = '';
		}
	}

	// # FN cancelAllActiveDubbingJobsPermanently
	// # AR Cancel every active job server-side and stop local watchers
	// # KW مهمة,job,إلغاء,cancel
	async function cancelAll() {
		const ids = [...activeJobIds];
		await Promise.allSettled(
			ids.map((id) => apiFetch(`/api/dub/${encodeURIComponent(id)}/cancel`, { method: 'POST' }))
		);
		for (const id of ids) clearPending(id);
		// # guard — AbortController stops in-flight R2 uploads even before any job_id exists.
		abort?.abort();
		activeJobIds = [];
		busy = false;
		statusText = 'Cancelled';
		showToast(ids.length ? 'Active dubbing jobs cancelled' : 'Upload cancelled', 'info');
	}

	async function resumePendingJobs() {
		await waitForAuthReady();
		if (!get(auth).user) return;
		const pending = loadPending();
		if (!pending.length) return;
		busy = true;
		abort = new AbortController();
		statusText = `Resuming ${pending.length} job(s)…`;
		activeJobIds = pending.map((job) => job.jobId);
		const settled = await Promise.allSettled(
			pending.map(async (job) => {
				try {
					return await watchJob(job, abort!.signal);
				} finally {
					clearPending(job.jobId);
					activeJobIds = activeJobIds.filter((id) => id !== job.jobId);
				}
			})
		);
		for (const item of settled) {
			if (item.status === 'fulfilled') results = [...results, item.value];
		}
		activeResult = results[0] || null;
		busy = false;
		if (results.length) {
			progress = 100;
			statusText = 'Resumed jobs completed';
		}
	}
</script>

<svelte:head>
	<title>Glotix | Dubbing Studio</title>
	<meta
		name="description"
		content="Upload media, review its script, and dub it into multiple languages."
	/>
	<link rel="canonical" href="https://glotix.ai/dubbing" />
</svelte:head>

<section class="container">
	<div class="page-hero">
		<h1>Dubbing Studio</h1>
		<p>Upload media, review the extracted script, select voices, and dub multiple languages.</p>
	</div>

	{#if !file}
		<label class="drop card-panel">
			<input type="file" accept="video/*,audio/*" onchange={onPick} />
			<div class="empty">
				<i class="fas fa-cloud-arrow-up"></i>
				<strong>Drop video or audio</strong>
				<span class="muted">MP4, MOV, WebM, MP3, WAV · up to 5 GB · resumable over 500 MB</span>
			</div>
		</label>
	{:else}
		<div class="media-workspace">
			<div class="preview-card card-panel">
				<label class="replace" title="Replace media">
					<input type="file" accept="video/*,audio/*" onchange={onPick} />
					<i class="fas fa-rotate"></i>
				</label>
				{#if isVideo}
					<video src={previewUrl} controls onloadedmetadata={readDuration}>
						<track kind="captions" />
					</video>
				{:else}
					<div class="audio-preview">
						<i class="fas fa-wave-square"></i>
						<audio src={previewUrl} controls onloadedmetadata={readDuration}></audio>
					</div>
				{/if}
				<div class="file-meta">
					<strong>{file.name}</strong>
					<span>{(file.size / 1024 / 1024).toFixed(1)} MB</span>
					{#if durationSeconds}<span>{Math.round(durationSeconds)} sec</span>{/if}
				</div>
			</div>

			<SrtEditor
				{segments}
				busy={extracting}
				status={srtStatus}
				onchange={(next) => {
					segments = next;
					if (!sourceSegments.length) sourceSegments = next.map((segment) => ({ ...segment }));
				}}
				onextract={extractScript}
			/>
		</div>
	{/if}

	<div class="card-panel configuration">
		<div class="language-grid">
			<LanguageSelect
				{languages}
				value={sourceLang}
				label="Original language"
				onchange={(next) => (sourceLang = String(next))}
			/>
			<LanguageSelect
				{languages}
				values={targetLangs}
				label="Target languages"
				multiple
				onchange={(next) => (targetLangs = next as string[])}
			/>
		</div>

		<VoicePicker
			selected={selectedVoice}
			includeVideoClone
			preferDefault={quality === 'fast'}
			onchange={(voice) => (selectedVoice = voice)}
		/>

		<div class="advanced">
			<label>
				Speakers
				<select bind:value={speakerMode}>
					<option value="auto">Auto detect</option>
					<option value="single">Single speaker</option>
					<option value="multi">Multiple speakers</option>
				</select>
			</label>
			<label>
				Quality
				<select bind:value={quality}>
					<option value="fast">Fast (ElevenLabs Flash)</option>
					<option value="studio">Studio (music isolation + clone)</option>
				</select>
			</label>
			<label class="check">
				<input
					type="checkbox"
					bind:checked={enableLipsync}
					onchange={() => {
						uploadedKey = '';
						audioUploadedKey = '';
						videoUploadedKey = '';
						videoUploadPromise = null;
						uploadGrant = null;
						preparedMedia = null;
					}}
				/>
				Enable lip sync
				<span class="hint"
					>(uses full-video upload; off = extract audio in browser first)</span
				>
			</label>
		</div>

		<div class="actions">
			<button
				class="btn-primary start"
				type="button"
				disabled={busy || extracting || !file}
				onclick={handleStart}
			>
				{#if extracting}
					Extracting…
				{:else if busy}
					Dubbing…
				{:else if !segments.some((segment) => segment.text.trim())}
					Extract Script
				{:else}
					Start Dubbing
				{/if}
			</button>
			{#if busy}
				<button class="btn-outline danger" type="button" onclick={cancelAll}>Cancel all</button>
			{/if}
		</div>
	</div>

	{#if busy || progress > 0 || statusText}
		<div class="card-panel progress-card">
			<div class="progress-head">
				<strong>{statusText || 'Preparing…'}</strong>
				<span>{Math.round(progress)}%</span>
			</div>
			<div class="bar"><span style={`width:${progress}%`}></span></div>
		</div>
	{/if}

	{#if results.length}
		<div class="results card-panel">
			<div class="result-tabs">
				{#each results as result}
					<button
						type="button"
						class:active={activeResult?.jobId === result.jobId}
						onclick={() => (activeResult = result)}
					>
						{findLanguage(languages, result.langCode)?.flag} {result.langName}
					</button>
				{/each}
			</div>
			{#if activeResult}
				{#if isVideo}
					<video controls src={activeResult.url}>
						<track kind="captions" />
					</video>
				{:else}
					<audio controls src={activeResult.url}></audio>
				{/if}
				<a class="btn-primary" href={activeResult.url} download>
					<i class="fas fa-download"></i> Download {activeResult.langName}
				</a>
			{/if}
		</div>
	{/if}
</section>

<style>
	.drop {
		position: relative;
		overflow: hidden;
		min-height: 260px;
		display: grid;
		place-items: center;
		cursor: pointer;
		margin-bottom: 18px;
		border-style: dashed;
	}
	.drop > input,
	.replace input {
		position: absolute;
		inset: 0;
		opacity: 0;
		cursor: pointer;
	}
	.empty {
		display: grid;
		gap: 8px;
		place-items: center;
		padding: 40px;
	}
	.empty > i {
		font-size: 2.4rem;
		color: var(--accent-blue);
	}
	.media-workspace {
		display: grid;
		grid-template-columns: minmax(300px, 0.9fr) minmax(360px, 1.1fr);
		gap: 16px;
		align-items: stretch;
		margin-bottom: 18px;
	}
	.preview-card {
		position: relative;
		display: flex;
		flex-direction: column;
		min-height: 340px;
	}
	.preview-card video {
		width: 100%;
		flex: 1;
		max-height: 500px;
		border-radius: 12px;
		background: #000;
		object-fit: contain;
	}
	.audio-preview {
		flex: 1;
		display: grid;
		place-items: center;
		gap: 16px;
		background: var(--bg-soft);
		border-radius: 12px;
		padding: 30px;
	}
	.audio-preview > i {
		font-size: 3rem;
		color: var(--accent-blue);
	}
	.audio-preview audio {
		width: 100%;
	}
	.replace {
		position: absolute;
		top: 34px;
		right: 34px;
		z-index: 5;
		width: 38px;
		height: 38px;
		border-radius: 50%;
		background: rgba(255, 255, 255, 0.9);
		color: #111;
		display: grid;
		place-items: center;
		cursor: pointer;
	}
	.file-meta {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
		align-items: center;
		padding-top: 12px;
		color: var(--text-muted);
		font-size: 0.85rem;
	}
	.file-meta strong {
		color: var(--text-main);
		margin-right: auto;
	}
	.configuration {
		display: grid;
		gap: 20px;
		margin-bottom: 18px;
	}
	.language-grid,
	.advanced {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
		gap: 14px;
	}
	.advanced label {
		display: grid;
		gap: 6px;
		font-weight: 600;
		font-size: 0.9rem;
	}
	.advanced select {
		padding: 11px 12px;
		border: 1px solid var(--border-color);
		border-radius: 10px;
		background: var(--bg-page);
		color: var(--text-main);
	}
	.advanced .check {
		display: flex;
		align-items: center;
		flex-direction: row;
		flex-wrap: wrap;
		gap: 8px;
	}
	.hint {
		font-weight: 500;
		font-size: 0.8rem;
		color: var(--text-muted, #6b7280);
	}
	.actions {
		display: flex;
		gap: 10px;
		align-items: center;
	}
	.start {
		min-width: 180px;
		justify-content: center;
	}
	.danger {
		color: var(--error);
	}
	.progress-card {
		margin-bottom: 18px;
	}
	.progress-head {
		display: flex;
		justify-content: space-between;
		margin-bottom: 9px;
	}
	.bar {
		height: 10px;
		background: var(--bg-soft);
		border-radius: 999px;
		overflow: hidden;
	}
	.bar span {
		display: block;
		height: 100%;
		background: var(--accent-gold);
		transition: width 0.3s ease;
	}
	.results {
		display: grid;
		gap: 14px;
	}
	.result-tabs {
		display: flex;
		flex-wrap: wrap;
		gap: 7px;
	}
	.result-tabs button {
		padding: 8px 12px;
		border: 1px solid var(--border-color);
		border-radius: 999px;
		background: var(--bg-soft);
		color: var(--text-main);
		cursor: pointer;
	}
	.result-tabs button.active {
		border-color: var(--accent-gold);
		background: rgba(252, 202, 105, 0.2);
	}
	.results video,
	.results audio {
		width: 100%;
		max-height: 620px;
		background: #000;
		border-radius: 14px;
	}
	@media (max-width: 900px) {
		.media-workspace {
			grid-template-columns: 1fr;
		}
	}
</style>
