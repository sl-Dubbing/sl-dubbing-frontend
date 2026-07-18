<script lang="ts">
	import { onMount } from 'svelte';
	import {
		loadPremiumVoices,
		loadSavedVoice,
		loadUserVoiceClones,
		saveVoiceClone,
		uploadVoiceSample,
		type Voice
	} from '$lib/services/voices';
	import { showToast } from '$lib/stores/toast';

	type Props = {
		selected?: Voice | null;
		includeQuick?: boolean;
		includeVideoClone?: boolean;
		onchange?: (voice: Voice) => void;
	};

	let {
		selected = null,
		includeQuick = false,
		includeVideoClone = false,
		onchange
	}: Props = $props();

	let voices = $state<Voice[]>([]);
	let loading = $state(true);
	let recording = $state(false);
	let recorder: MediaRecorder | null = null;
	let recordingStream: MediaStream | null = null;
	let chunks: Blob[] = [];
	let audioPreview: HTMLAudioElement | null = null;
	let uploadBusy = $state(false);
	let saveName = $state('');
	let pendingUpload: Voice | null = $state(null);

	onMount(() => {
		void refresh();
		return releaseRecorder;
	});

	async function refresh() {
		loading = true;
		const [premium, clones, saved] = await Promise.all([
			loadPremiumVoices(),
			loadUserVoiceClones(),
			loadSavedVoice()
		]);
		voices = [...(saved ? [saved] : []), ...clones, ...premium];
		loading = false;
		if (!selected) {
			if (includeQuick) choose(quickVoice);
			else if (includeVideoClone) choose(videoClone);
			else if (voices[0]) choose(voices[0]);
		}
	}

	const quickVoice: Voice = {
		id: 'quick_edge',
		name: 'Quick',
		sample_url: '',
		source: 'quick'
	};
	const videoClone: Voice = {
		id: 'video_clone',
		name: 'Clone from video',
		sample_url: '',
		source: 'video'
	};
	const defaultVoice: Voice = {
		id: 'default',
		name: 'Default voice',
		sample_url: '',
		source: 'default'
	};

	function choose(voice: Voice) {
		selected = voice;
		onchange?.(voice);
	}

	function play(event: MouseEvent, voice: Voice) {
		event.stopPropagation();
		if (!voice.sample_url) return;
		if (audioPreview) {
			audioPreview.pause();
			audioPreview = null;
		}
		audioPreview = new Audio(voice.sample_url);
		void audioPreview.play();
	}

	async function handleUpload(event: Event) {
		const input = event.target as HTMLInputElement;
		const file = input.files?.[0];
		input.value = '';
		if (!file) return;
		await uploadBlob(file, file.name);
	}

	async function uploadBlob(blob: Blob, filename: string) {
		uploadBusy = true;
		try {
			const sampleUrl = await uploadVoiceSample(blob, filename);
			pendingUpload = {
				id: `upload_${Date.now()}`,
				name: 'New voice',
				sample_url: sampleUrl,
				source: 'upload'
			};
			saveName = 'My Voice';
			choose(pendingUpload);
			showToast('Voice sample uploaded', 'success');
		} catch (error) {
			showToast(error instanceof Error ? error.message : 'Voice upload failed', 'error');
		} finally {
			uploadBusy = false;
		}
	}

	async function persistPending() {
		if (!pendingUpload) return;
		try {
			await saveVoiceClone(saveName, pendingUpload.sample_url);
			pendingUpload = null;
			showToast('Voice saved to your library', 'success');
			await refresh();
		} catch (error) {
			showToast(error instanceof Error ? error.message : 'Could not save voice', 'error');
		}
	}

	// # FN startMicrophoneVoiceCapture
	// # AR Record a short voice sample from the browser microphone
	// # KW صوت,استنساخ,voice,clone,sample
	async function startRecording() {
		try {
			recordingStream = await navigator.mediaDevices.getUserMedia({ audio: true });
			chunks = [];
			recorder = new MediaRecorder(recordingStream);
			recorder.ondataavailable = (event) => {
				if (event.data.size) chunks.push(event.data);
			};
			recorder.onstop = () => {
				const blob = new Blob(chunks, { type: recorder?.mimeType || 'audio/webm' });
				releaseRecorder();
				void uploadBlob(blob, `voice-${Date.now()}.webm`);
			};
			recorder.start();
			recording = true;
			setTimeout(() => {
				if (recording) stopRecording();
			}, 8000);
		} catch {
			showToast('Microphone permission was denied', 'error');
		}
	}

	function stopRecording() {
		if (recorder?.state === 'recording') recorder.stop();
		recording = false;
	}

	function releaseRecorder() {
		recordingStream?.getTracks().forEach((track) => track.stop());
		recordingStream = null;
		recorder = null;
		recording = false;
	}
</script>

<section class="voice-picker">
	<header>
		<div>
			<h2>Voice</h2>
			<p>{selected?.name || 'Select a voice'}</p>
		</div>
		<div class="upload-actions">
			<label class="btn-outline">
				<i class="fas fa-upload"></i> Upload
				<input type="file" accept="audio/*" onchange={handleUpload} />
			</label>
			{#if recording}
				<button class="btn-outline recording" type="button" onclick={stopRecording}>
					<i class="fas fa-stop"></i> Stop
				</button>
			{:else}
				<button class="btn-outline" type="button" onclick={startRecording}>
					<i class="fas fa-microphone"></i> Record
				</button>
			{/if}
		</div>
	</header>

	{#if uploadBusy}
		<p class="muted">Uploading voice sample…</p>
	{/if}

	<div class="grid">
		{#if includeQuick}
			<button
				type="button"
				class="voice-card special"
				class:selected={selected?.id === quickVoice.id}
				onclick={() => choose(quickVoice)}
			>
				<span class="avatar quick"><i class="fas fa-bolt"></i></span>
				<strong>Quick</strong>
				<small>Half-price Edge TTS</small>
			</button>
		{/if}
		{#if includeVideoClone}
			<button
				type="button"
				class="voice-card special"
				class:selected={selected?.id === videoClone.id}
				onclick={() => choose(videoClone)}
			>
				<span class="avatar video"><i class="fas fa-wave-square"></i></span>
				<strong>Clone from video</strong>
				<small>+100 credits</small>
			</button>
			<button
				type="button"
				class="voice-card special"
				class:selected={selected?.id === defaultVoice.id}
				onclick={() => choose(defaultVoice)}
			>
				<span class="avatar default"><i class="fas fa-robot"></i></span>
				<strong>Default</strong>
				<small>Basic voice</small>
			</button>
		{/if}
		{#each voices as voice}
			<button
				type="button"
				class="voice-card"
				class:selected={selected?.id === voice.id && selected?.source === voice.source}
				onclick={() => choose(voice)}
			>
				<span class="avatar">
					{#if voice.avatar_url}
						<img src={voice.avatar_url} alt="" />
					{:else}
						{voice.name.slice(0, 1).toUpperCase()}
					{/if}
					{#if voice.sample_url}
						<span
							class="play"
							role="button"
							tabindex="0"
							aria-label={`Preview ${voice.name}`}
							onclick={(event) => play(event, voice)}
							onkeydown={(event) => event.key === 'Enter' && play(event as unknown as MouseEvent, voice)}
						>
							<i class="fas fa-play"></i>
						</span>
					{/if}
				</span>
				<strong>{voice.name}</strong>
				<small>{voice.source}</small>
			</button>
		{/each}
	</div>

	{#if loading}
		<p class="muted">Loading voices…</p>
	{/if}

	{#if pendingUpload}
		<div class="save-row">
			<input bind:value={saveName} placeholder="Voice name" />
			<button type="button" class="btn-primary" onclick={persistPending}>Save to library</button>
		</div>
	{/if}
</section>

<style>
	.voice-picker {
		display: grid;
		gap: 12px;
	}
	header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		flex-wrap: wrap;
		gap: 12px;
	}
	h2,
	header p {
		margin: 0;
	}
	header p {
		font-size: 0.85rem;
		color: var(--text-muted);
	}
	.upload-actions {
		display: flex;
		gap: 7px;
	}
	.upload-actions label {
		position: relative;
		cursor: pointer;
	}
	.upload-actions input {
		position: absolute;
		inset: 0;
		opacity: 0;
		cursor: pointer;
	}
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
		gap: 10px;
		max-height: 320px;
		overflow: auto;
		padding: 2px;
	}
	.voice-card {
		border: 1px solid var(--border-color);
		border-radius: 14px;
		background: var(--bg-page);
		color: var(--text-main);
		padding: 10px;
		display: grid;
		place-items: center;
		gap: 5px;
		cursor: pointer;
	}
	.voice-card.selected {
		border-color: var(--accent-gold);
		box-shadow: 0 0 0 2px rgba(252, 202, 105, 0.3);
	}
	.avatar {
		width: 52px;
		height: 52px;
		border-radius: 50%;
		background: linear-gradient(135deg, #8b5cf6, #3b82f6);
		color: #fff;
		display: grid;
		place-items: center;
		position: relative;
		overflow: hidden;
		font-weight: 800;
	}
	.avatar img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.avatar.quick {
		background: linear-gradient(135deg, #f59e0b, #f97316);
	}
	.avatar.video {
		background: linear-gradient(135deg, #111827, #475569);
	}
	.avatar.default {
		background: #64748b;
	}
	.play {
		position: absolute;
		inset: 0;
		display: grid;
		place-items: center;
		background: rgba(0, 0, 0, 0.35);
		opacity: 0;
	}
	.avatar:hover .play {
		opacity: 1;
	}
	.voice-card small {
		color: var(--text-muted);
		text-transform: capitalize;
	}
	.recording {
		color: var(--error);
	}
	.save-row {
		display: flex;
		gap: 8px;
	}
	.save-row input {
		flex: 1;
		padding: 10px 12px;
		border: 1px solid var(--border-color);
		border-radius: 10px;
		background: var(--bg-page);
		color: var(--text-main);
	}
</style>
