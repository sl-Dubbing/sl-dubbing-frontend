<script lang="ts">
	import { onMount } from 'svelte';
	import { auth, refreshUserCreditsInMenu } from '$lib/stores/auth';
	import { apiFetch, parseJsonSafe } from '$lib/services/api';
	import { showToast } from '$lib/stores/toast';

	let file = $state<File | null>(null);
	let preview = $state<string | null>(null);
	let prompt = $state('');
	let estimate = $state<string>('—');
	let busy = $state(false);
	let resultUrl = $state<string | null>(null);
	let resultText = $state<string | null>(null);
	type StudioResult = {
		id: string;
		createdAt: string;
		prompt: string;
		imageDataUrl: string;
		videoUrl?: string;
		response?: string;
		creditsCharged?: number;
	};
	let results = $state<StudioResult[]>([]);
	const RESULTS_KEY = 'glotix_image_studio_results';

	onMount(() => {
		try {
			const stored = JSON.parse(localStorage.getItem(RESULTS_KEY) || '[]');
			results = Array.isArray(stored) ? stored : [];
		} catch {
			results = [];
		}
	});

	function imageDataUrl(source: File): Promise<string> {
		return new Promise((resolve, reject) => {
			const reader = new FileReader();
			reader.onload = () => resolve(String(reader.result || ''));
			reader.onerror = () => reject(reader.error);
			reader.readAsDataURL(source);
		});
	}

	function addResult(entry: StudioResult) {
		results = [entry, ...results].slice(0, 50);
		localStorage.setItem(RESULTS_KEY, JSON.stringify(results));
	}

	function onFile(e: Event) {
		const input = e.target as HTMLInputElement;
		const f = input.files?.[0] || null;
		file = f;
		if (preview) URL.revokeObjectURL(preview);
		preview = f ? URL.createObjectURL(f) : null;
		void refreshEstimate();
	}

	async function refreshEstimate() {
		if (!prompt.trim()) {
			estimate = '—';
			return;
		}
		try {
			const res = await apiFetch('/api/image/to-video/estimate', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ prompt: prompt.trim() })
			});
			const data = await parseJsonSafe<{ credits?: number; total?: number; cost?: number }>(res);
			const c = data?.credits ?? data?.total ?? data?.cost;
			estimate = c != null ? String(c) : '—';
		} catch {
			estimate = '—';
		}
	}

	async function generateVideo() {
		if (!$auth.user) {
			showToast('Please sign in', 'error');
			return;
		}
		if (!file) {
			showToast('Choose an image', 'error');
			return;
		}
		if (!prompt.trim()) {
			showToast('Enter what the person should say', 'error');
			return;
		}
		busy = true;
		resultUrl = null;
		resultText = null;
		try {
			const imageSnapshot = await imageDataUrl(file);
			const fd = new FormData();
			fd.append('image', file);
			fd.append('prompt', prompt.trim());
			const res = await apiFetch('/api/image/to-video', { method: 'POST', body: fd });
			const data = await parseJsonSafe<{
				video_url?: string;
				url?: string;
				error?: string;
				message?: string;
			}>(res);
			if (!res.ok) {
				showToast(data?.error || data?.message || 'Generation failed', 'error');
				return;
			}
			resultUrl = data?.video_url || data?.url || null;
			addResult({
				id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`,
				createdAt: new Date().toISOString(),
				prompt: prompt.trim(),
				imageDataUrl: imageSnapshot,
				videoUrl: resultUrl || undefined,
				creditsCharged: (data as { credits_charged?: number })?.credits_charged
			});
			showToast('Video ready', 'success');
			await refreshUserCreditsInMenu();
		} catch {
			showToast('Generation failed', 'error');
		} finally {
			busy = false;
		}
	}

	async function askAboutPhoto() {
		if (!$auth.user) {
			showToast('Please sign in', 'error');
			return;
		}
		if (!file) {
			showToast('Choose an image', 'error');
			return;
		}
		busy = true;
		resultText = null;
		try {
			const imageSnapshot = await imageDataUrl(file);
			const fd = new FormData();
			fd.append('image', file);
			fd.append('prompt', prompt.trim() || 'Describe this image');
			const res = await apiFetch('/api/image/process', { method: 'POST', body: fd });
			const data = await parseJsonSafe<{
				text?: string;
				result?: string;
				response?: string;
				error?: string;
			}>(res);
			if (!res.ok) {
				showToast(data?.error || 'Process failed', 'error');
				return;
			}
			resultText = data?.response || data?.text || data?.result || JSON.stringify(data);
			addResult({
				id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`,
				createdAt: new Date().toISOString(),
				prompt: prompt.trim(),
				imageDataUrl: imageSnapshot,
				response: resultText || ''
			});
		} catch {
			showToast('Process failed', 'error');
		} finally {
			busy = false;
		}
	}
</script>

<svelte:head>
	<title>Image Studio | Glotix</title>
	<link rel="canonical" href="https://glotix.ai/video-creation" />
</svelte:head>

<section class="container">
	<div class="page-hero">
		<h1>Image Studio</h1>
		<p>Upload an image and generate a talking video or ask about the photo.</p>
	</div>

	<div class="card-panel studio">
		<label class="upload">
			<input type="file" accept="image/png,image/jpeg,image/webp" onchange={onFile} />
			{#if preview}
				<img src={preview} alt="Preview" />
			{:else}
				<span>Choose PNG / JPEG / WebP</span>
			{/if}
		</label>
		<label>
			Speech / prompt
			<textarea
				rows="4"
				bind:value={prompt}
				oninput={() => void refreshEstimate()}
				placeholder="What should the image say?"
			></textarea>
		</label>
		<p class="muted">Estimated credits: <strong>{estimate}</strong></p>
		<div class="row">
			<button class="btn-primary" type="button" disabled={busy} onclick={generateVideo}>
				{busy ? 'Working…' : 'Generate video'}
			</button>
			<button class="btn-outline" type="button" disabled={busy} onclick={askAboutPhoto}>
				Ask about photo
			</button>
		</div>
		{#if resultUrl}
			<video controls src={resultUrl}><track kind="captions" /></video>
		{/if}
		{#if resultText}
			<pre>{resultText}</pre>
		{/if}
	</div>

	<section class="results-section">
		<div class="results-head">
			<h2>Results</h2>
			{#if results.length}
				<button
					class="btn-outline danger"
					type="button"
					onclick={() => {
						if (!confirm('Clear all Image Studio results?')) return;
						results = [];
						localStorage.setItem(RESULTS_KEY, '[]');
					}}>Clear all</button
				>
			{/if}
		</div>
		{#if results.length === 0}
			<div class="card-panel muted">No Image Studio results yet.</div>
		{:else}
			<div class="results-list">
				{#each results as item}
					<article class="card-panel result-item">
						<div class="result-head">
							<img src={item.imageDataUrl} alt="" />
							<div>
								<time>{new Date(item.createdAt).toLocaleString()}</time>
								<strong>{item.prompt}</strong>
								{#if item.creditsCharged != null}
									<span>{item.creditsCharged} credits</span>
								{/if}
							</div>
						</div>
						{#if item.videoUrl}
							<video controls src={item.videoUrl}><track kind="captions" /></video>
							<a class="btn-outline" href={item.videoUrl} download>Download video</a>
						{:else}
							<pre>{item.response}</pre>
						{/if}
					</article>
				{/each}
			</div>
		{/if}
	</section>
</section>

<style>
	.studio {
		display: grid;
		gap: 14px;
	}
	.upload {
		border: 1px dashed var(--border-color);
		border-radius: 16px;
		min-height: 200px;
		display: grid;
		place-items: center;
		cursor: pointer;
		overflow: hidden;
		background: var(--bg-soft);
		position: relative;
	}
	.upload input {
		position: absolute;
		inset: 0;
		opacity: 0;
		cursor: pointer;
	}
	.upload img {
		width: 100%;
		max-height: 360px;
		object-fit: contain;
	}
	label {
		display: grid;
		gap: 6px;
		font-weight: 600;
	}
	textarea {
		padding: 12px 14px;
		border-radius: 12px;
		border: 1px solid var(--border-color);
		background: var(--bg-page);
		color: var(--text-main);
		font: inherit;
	}
	.row {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
	}
	video {
		width: 100%;
		border-radius: 12px;
		background: #000;
	}
	pre {
		white-space: pre-wrap;
		background: var(--bg-soft);
		padding: 12px;
		border-radius: 12px;
	}
	.results-section {
		margin-top: 28px;
	}
	.results-head {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 12px;
	}
	.results-list {
		display: grid;
		gap: 14px;
	}
	.result-item {
		display: grid;
		gap: 12px;
	}
	.result-head {
		display: flex;
		gap: 12px;
		align-items: center;
	}
	.result-head img {
		width: 70px;
		height: 70px;
		object-fit: cover;
		border-radius: 10px;
	}
	.result-head > div {
		display: grid;
		gap: 3px;
	}
	.result-head time,
	.result-head span {
		color: var(--text-muted);
		font-size: 0.8rem;
	}
	.danger {
		color: var(--error);
	}
</style>
