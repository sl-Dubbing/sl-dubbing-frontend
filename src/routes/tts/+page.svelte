<script lang="ts">
	import { onMount, tick } from 'svelte';
	import LanguageSelect from '$lib/components/LanguageSelect.svelte';
	import VoicePicker from '$lib/components/VoicePicker.svelte';
	import { apiFetch, parseJsonSafe } from '$lib/services/api';
	import { createAudioStreamPlayer } from '$lib/services/audio-stream-player';
	import { findLanguage, loadLanguages, type Language } from '$lib/services/languages';
	import type { Voice } from '$lib/services/voices';
	import { auth, refreshUserCreditsInMenu } from '$lib/stores/auth';
	import { showToast } from '$lib/stores/toast';

	type RecentTts = {
		id: string;
		text: string;
		output_url: string;
		lang: string;
		created_at: string;
		server: boolean;
	};

	let text = $state('');
	let languages = $state<Language[]>([]);
	let lang = $state('ar');
	let selectedVoice = $state<Voice | null>(null);
	let busy = $state(false);
	let audioUrl = $state<string | null>(null);
	let audioEl: HTMLAudioElement | null = $state(null);
	let playing = $state(false);
	let duration = $state(0);
	let currentTime = $state(0);
	let playbackRate = $state(1);
	let dictating = $state(false);
	let recognition: { stop(): void } | null = null;
	let recent = $state<RecentTts[]>([]);
	let recentLoading = $state(true);
	let streamPlayer = createAudioStreamPlayer();
	let streamProgress = $state(0);
	let playerVisible = $state(false);
	let currentDownloadUrl = $state('');

	const HISTORY_KEY = 'glotix_tts_history';

	onMount(() => {
		void loadLanguages().then((items) => {
			languages = items;
			const stored = localStorage.getItem('glotix_tts_lang');
			if (stored && findLanguage(items, stored)) lang = stored;
			else if (!findLanguage(items, lang)) lang = items[0]?.code || 'ar';
		});
		void loadRecent();
		return () => {
			recognition?.stop();
			streamPlayer.stop();
		};
	});

	function voiceRequest() {
		const voice = selectedVoice;
		if (!voice) {
			return {
				voice_id: '',
				voice_name: 'Default',
				sample_url: '',
				sample_text: '',
				mode: 'standard',
				elevenlabs_voice_id: ''
			};
		}
		const elevenlabsVoiceId =
			voice.source === 'library' || voice.source === 'saved'
				? ''
				: String(voice.elevenlabs_voice_id || voice.id || '');
		return {
			voice_id:
				voice.source === 'library' || voice.source === 'saved'
					? `clone_${voice.id}`
					: voice.id,
			voice_name: voice.name,
			sample_url: voice.sample_url,
			sample_text: voice.sample_text || '',
			mode: 'standard',
			elevenlabs_voice_id: elevenlabsVoiceId
		};
	}

	function saveLocalHistory(item: RecentTts) {
		const list = loadLocalHistory().filter(
			(existing) => existing.id !== item.id && existing.output_url !== item.output_url
		);
		localStorage.setItem(HISTORY_KEY, JSON.stringify([item, ...list].slice(0, 7)));
	}

	function loadLocalHistory(): RecentTts[] {
		try {
			const value = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
			if (!Array.isArray(value)) return [];
			return value.map((item) => ({ ...item, server: false }));
		} catch {
			return [];
		}
	}

	// # FN generateTtsAudioFromApi
	// # AR Generate TTS with language, voice, translation context, and credits
	// # KW توليد_صوت,TTS,synthesis
	async function generate() {
		if (!$auth.user) return showToast('Please sign in first', 'error');
		const cleanText = text.trim();
		if (!cleanText) return showToast('Please enter text first', 'error');
		if (busy) return;
		busy = true;
		audioUrl = null;
		playerVisible = false;
		currentDownloadUrl = '';
		streamPlayer.stop();
		try {
			const language = findLanguage(languages, lang);
			const voice = voiceRequest();
			const request = {
				text: cleanText,
				lang,
				lang_code: lang,
				dialect: language?.dialect || '',
				source_language: '',
				source_dialect: '',
				translate: true,
				...voice
			};
			const res = await apiFetch(voice.mode === 'quick' ? '/api/tts/quick' : '/api/tts/stream', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(request)
			});
			if (voice.mode !== 'quick') {
				if (!res.ok) {
					const data = await parseJsonSafe<{
						error?: string;
						required?: number;
						balance?: number;
					}>(res);
					if (res.status === 402) {
						throw new Error(
							`Insufficient credits (required ${data?.required ?? '?'}, balance ${data?.balance ?? '?'})`
						);
					}
					throw new Error(data?.error || 'Server failed to start audio stream');
				}
				const historyId = res.headers.get('x-tts-id') || '';
				playerVisible = true;
				await tick();
				streamProgress = 0;
				streamPlayer = createAudioStreamPlayer({
					audio: audioEl || undefined,
					onProgress: (loaded) => {
						streamProgress = loaded;
					}
				});
				await streamPlayer.playStream(res);
				if (streamPlayer.element) audioEl = streamPlayer.element;
				showToast('Audio stream ready!', 'success');
				await refreshUserCreditsInMenu();
				for (let attempt = 0; attempt < 5; attempt += 1) {
					await loadRecent();
					const durable = recent.find((item) => item.id === historyId && item.output_url);
					if (durable) {
						currentDownloadUrl = durable.output_url;
						break;
					}
					await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)));
				}
				return;
			}
			const data = await parseJsonSafe<{
				success?: boolean;
				audio_url?: string;
				url?: string;
				text?: string;
				error?: string;
				message?: string;
				required?: number;
				balance?: number;
			}>(res);
			if (!res.ok || data?.success === false) {
				if (res.status === 402) {
					throw new Error(
						`Insufficient credits (required ${data?.required ?? '?'}, balance ${data?.balance ?? '?'})`
					);
				}
				throw new Error(data?.error || data?.message || 'Server failed to generate audio');
			}
			const url = data?.url || data?.audio_url || '';
			if (!url) throw new Error('No audio URL returned');
			audioUrl = url;
			currentDownloadUrl = url;
			playerVisible = true;
			await tick();
			const item: RecentTts = {
				id: `tts_${Date.now()}`,
				text: (data?.text || cleanText).trim(),
				output_url: url,
				lang,
				created_at: new Date().toISOString(),
				server: false
			};
			saveLocalHistory(item);
			recent = [item, ...recent.filter((entry) => entry.output_url !== url)].slice(0, 7);
			showToast('Audio ready!', 'success');
			await refreshUserCreditsInMenu();
			streamProgress = 0;
			streamPlayer = createAudioStreamPlayer({
				audio: audioEl || undefined,
				onProgress: (loaded) => {
					streamProgress = loaded;
				}
			});
			try {
				await streamPlayer.playUrl(url);
				playing = true;
				if (streamPlayer.element) audioEl = streamPlayer.element;
			} catch {
				setTimeout(() => void audioEl?.play(), 0);
			}
		} catch (error) {
			showToast(error instanceof Error ? error.message : 'Generation failed', 'error');
		} finally {
			busy = false;
		}
	}

	function togglePlay() {
		if (!audioEl) return;
		if (audioEl.paused) void audioEl.play();
		else audioEl.pause();
	}

	function seek(delta: number) {
		if (!audioEl) return;
		audioEl.currentTime = Math.max(0, Math.min(audioEl.duration || 0, audioEl.currentTime + delta));
	}

	function changeRate() {
		const rates = [0.75, 1, 1.25, 1.5, 2];
		const index = rates.indexOf(playbackRate);
		playbackRate = rates[(index + 1) % rates.length];
		if (audioEl) audioEl.playbackRate = playbackRate;
	}

	function formatTime(value: number) {
		if (!Number.isFinite(value)) return '0:00';
		const minutes = Math.floor(value / 60);
		return `${minutes}:${String(Math.floor(value % 60)).padStart(2, '0')}`;
	}

	function startDictation() {
		const SpeechRecognition =
			(window as typeof window & {
				SpeechRecognition?: new () => {
					lang: string;
					continuous: boolean;
					interimResults: boolean;
					start(): void;
					stop(): void;
					onresult: (event: {
						results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }>;
					}) => void;
					onend: () => void;
					onerror: () => void;
				};
				webkitSpeechRecognition?: new () => {
					lang: string;
					continuous: boolean;
					interimResults: boolean;
					start(): void;
					stop(): void;
					onresult: (event: {
						results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }>;
					}) => void;
					onend: () => void;
					onerror: () => void;
				};
			}).SpeechRecognition ||
			(window as typeof window & { webkitSpeechRecognition?: new () => never })
				.webkitSpeechRecognition;
		if (!SpeechRecognition) return showToast('Speech dictation is not supported here', 'error');
		const instance = new SpeechRecognition();
		instance.lang = lang;
		instance.continuous = true;
		instance.interimResults = false;
		instance.onresult = (event) => {
			for (let i = 0; i < event.results.length; i++) {
				if (event.results[i].isFinal) {
					text = `${text}${text ? ' ' : ''}${event.results[i][0].transcript}`.slice(0, 5000);
				}
			}
		};
		instance.onend = () => (dictating = false);
		instance.onerror = () => {
			dictating = false;
			showToast('Dictation stopped', 'error');
		};
		recognition = instance;
		dictating = true;
		instance.start();
	}

	function stopDictation() {
		recognition?.stop();
		recognition = null;
		dictating = false;
	}

	// # FN loadAndRenderRecentTtsWorks
	// # AR Merge local and server TTS history without duplicates
	// # KW توليد_صوت,TTS,synthesis
	async function loadRecent() {
		recentLoading = true;
		const local = loadLocalHistory();
		let server: RecentTts[] = [];
		if ($auth.user) {
			try {
				const res = await apiFetch('/api/user/files');
				const data = await parseJsonSafe<{ files?: Array<Record<string, unknown>> }>(res);
				server = (data?.files || [])
					.filter((item) => item.type === 'tts')
					.map((item) => ({
						id: String(item.id || item.created_at || ''),
						text: String(item.text || ''),
						output_url: String(item.output_url || item.url || ''),
						lang: String(item.lang || item.language || ''),
						created_at: String(item.created_at || new Date().toISOString()),
						server: true
					}));
			} catch {
				/* local history remains available */
			}
		}
		const seen = new Set<string>();
		recent = [...local, ...server]
			.filter((item) => {
				const key = item.id || item.output_url;
				if (!key || seen.has(key)) return false;
				seen.add(key);
				return true;
			})
			.sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
			.slice(0, 7);
		recentLoading = false;
	}

	async function deleteRecent(item: RecentTts) {
		const local = loadLocalHistory().filter(
			(entry) => entry.id !== item.id && entry.output_url !== item.output_url
		);
		localStorage.setItem(HISTORY_KEY, JSON.stringify(local));
		if (item.server) {
			const res = await apiFetch(`/api/user/files/tts/${encodeURIComponent(item.id)}`, {
				method: 'DELETE'
			});
			if (!res.ok) return showToast('Delete failed', 'error');
		}
		recent = recent.filter((entry) => entry.id !== item.id);
		showToast('Deleted', 'success');
	}

	async function downloadAudio(url: string) {
		try {
			const res = await apiFetch(`/api/tts/download?url=${encodeURIComponent(url)}`);
			if (!res.ok) throw new Error();
			const blob = await res.blob();
			const objectUrl = URL.createObjectURL(blob);
			const anchor = document.createElement('a');
			anchor.href = objectUrl;
			anchor.download = `TTS-${new Date().toISOString().slice(0, 10)}.mp3`;
			anchor.click();
			URL.revokeObjectURL(objectUrl);
		} catch {
			window.open(url, '_blank', 'noopener');
		}
	}
</script>

<svelte:head>
	<title>Text to Speech | Glotix</title>
	<meta name="description" content="Generate speech with quick, premium, or cloned voices." />
	<link rel="canonical" href="https://glotix.ai/tts" />
</svelte:head>

<section class="container">
	<div class="page-hero">
		<h1>Text to Speech</h1>
		<p>Type, dictate, select a language and voice, then generate downloadable audio.</p>
	</div>

	<div class="tts-grid">
		<div class="card-panel editor">
			<LanguageSelect
				{languages}
				value={lang}
				label="Speech language"
				onchange={(next) => {
					lang = String(next);
					localStorage.setItem('glotix_tts_lang', lang);
				}}
			/>

			<label class="text-label" for="tts-text">Text</label>
			<textarea
				id="tts-text"
				rows="11"
				maxlength="5000"
				bind:value={text}
				placeholder="Type or paste text…"
			></textarea>
			<div class="toolbar">
				<div>
					<button class="icon-button" type="button" onclick={() => navigator.clipboard.readText().then((value) => (text = value.slice(0, 5000)))}>
						<i class="fas fa-paste"></i> Paste
					</button>
					<button class="icon-button" type="button" onclick={() => (text = '')}>
						<i class="fas fa-trash"></i> Clear
					</button>
					{#if dictating}
						<button class="icon-button recording" type="button" onclick={stopDictation}>
							<i class="fas fa-stop"></i> Stop dictation
						</button>
					{:else}
						<button class="icon-button" type="button" onclick={startDictation}>
							<i class="fas fa-microphone"></i> Dictate
						</button>
					{/if}
				</div>
				<span class="muted">{text.length} / 5000</span>
			</div>
		</div>

		<div class="card-panel voice-panel">
			<VoicePicker
				selected={selectedVoice}
				onchange={(voice) => (selectedVoice = voice)}
			/>
		</div>
	</div>

	<div class="generate-row">
		<button class="btn-primary generate" type="button" disabled={busy} onclick={generate}>
			{#if busy}<i class="fas fa-circle-notch fa-spin"></i>{:else}<i class="fas fa-wand-magic-sparkles"></i>{/if}
			{busy ? 'Generating…' : 'Generate Audio'}
		</button>
	</div>

	{#if playerVisible}
		<div class="card-panel player">
			<audio
				bind:this={audioEl}
				src={audioUrl ?? undefined}
				onplay={() => (playing = true)}
				onpause={() => (playing = false)}
				onended={() => (playing = false)}
				onloadedmetadata={() => {
					duration = audioEl?.duration || 0;
					if (audioEl) audioEl.playbackRate = playbackRate;
				}}
				ontimeupdate={() => (currentTime = audioEl?.currentTime || 0)}
			></audio>
			<div class="player-controls">
				<button type="button" onclick={() => seek(-10)} aria-label="Back 10 seconds">−10</button>
				<button class="play" type="button" onclick={togglePlay} aria-label={playing ? 'Pause' : 'Play'}>
					<i class={playing ? 'fas fa-pause' : 'fas fa-play'}></i>
				</button>
				<button type="button" onclick={() => seek(10)} aria-label="Forward 10 seconds">+10</button>
				<button type="button" onclick={changeRate}>{playbackRate}×</button>
			</div>
			<div class="timeline">
				<span>{formatTime(currentTime)}</span>
				<input
					type="range"
					min="0"
					max={duration || 1}
					step="0.1"
					value={currentTime}
					oninput={(event) => {
						if (audioEl) audioEl.currentTime = Number(event.currentTarget.value);
					}}
				/>
				<span>{formatTime(duration)}</span>
			</div>
			<button
				class="btn-outline"
				type="button"
				disabled={!currentDownloadUrl}
				onclick={() => downloadAudio(currentDownloadUrl)}
			>
				<i class="fas fa-download"></i> Download
			</button>
		</div>
	{/if}

	<section class="recent-section">
		<h2>Recent works</h2>
		{#if recentLoading}
			<p class="muted">Loading…</p>
		{:else if recent.length === 0}
			<div class="card-panel empty-recent">No recent TTS works yet.</div>
		{:else}
			<div class="recent-grid">
				{#each recent as item}
					<article class="card-panel recent-card">
						<audio controls src={item.output_url}></audio>
						<p>“{item.text.slice(0, 90)}{item.text.length > 90 ? '…' : ''}”</p>
						<div class="recent-meta">
							<span>{findLanguage(languages, item.lang)?.flag} {item.lang}</span>
							<span>{new Date(item.created_at).toLocaleDateString()}</span>
						</div>
						<div class="recent-actions">
							<button class="btn-outline" type="button" onclick={() => downloadAudio(item.output_url)}>
								Download
							</button>
							<button class="btn-outline danger" type="button" onclick={() => deleteRecent(item)}>
								Delete
							</button>
						</div>
					</article>
				{/each}
			</div>
		{/if}
	</section>
</section>

<style>
	.tts-grid {
		display: grid;
		grid-template-columns: minmax(0, 1.2fr) minmax(330px, 0.8fr);
		gap: 18px;
	}
	.editor,
	.voice-panel {
		display: grid;
		gap: 14px;
		align-content: start;
	}
	.text-label {
		font-weight: 600;
	}
	textarea {
		resize: vertical;
		padding: 14px;
		border: 1px solid var(--border-color);
		border-radius: 14px;
		background: var(--bg-page);
		color: var(--text-main);
		font: inherit;
	}
	.toolbar,
	.toolbar > div,
	.player-controls,
	.timeline,
	.recent-actions {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.toolbar {
		justify-content: space-between;
		flex-wrap: wrap;
	}
	.icon-button {
		border: 0;
		background: transparent;
		color: var(--text-muted);
		cursor: pointer;
		padding: 6px;
	}
	.recording,
	.danger {
		color: var(--error);
	}
	.generate-row {
		display: flex;
		justify-content: center;
		padding: 22px 0;
	}
	.generate {
		min-width: 220px;
		justify-content: center;
	}
	.player {
		display: grid;
		gap: 14px;
		margin-bottom: 28px;
	}
	.player-controls {
		justify-content: center;
	}
	.player-controls button {
		border: 1px solid var(--border-color);
		background: var(--bg-soft);
		color: var(--text-main);
		border-radius: 50%;
		width: 44px;
		height: 44px;
		cursor: pointer;
	}
	.player-controls .play {
		width: 56px;
		height: 56px;
		background: var(--primary);
		color: var(--bg-card);
	}
	.timeline input {
		flex: 1;
	}
	.recent-section h2 {
		font-size: 1.3rem;
	}
	.recent-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
		gap: 14px;
	}
	.recent-card {
		display: grid;
		gap: 10px;
	}
	.recent-card audio {
		width: 100%;
	}
	.recent-card p {
		margin: 0;
		color: var(--text-muted);
	}
	.recent-meta {
		display: flex;
		justify-content: space-between;
		gap: 8px;
		font-size: 0.8rem;
		color: var(--text-muted);
	}
	@media (max-width: 900px) {
		.tts-grid {
			grid-template-columns: 1fr;
		}
	}
</style>
