<script lang="ts">
	import { onMount } from 'svelte';
	import { auth } from '$lib/stores/auth';
	import { apiFetch, parseJsonSafe } from '$lib/services/api';
	import { showToast } from '$lib/stores/toast';

	type FileItem = {
		id: string;
		type?: string;
		status?: string;
		lang?: string;
		language?: string;
		name?: string;
		title?: string;
		output_url?: string;
		media_url?: string;
		url?: string;
		redub_available?: boolean;
		created_at?: string;
		local?: boolean;
	};

	let files = $state<FileItem[]>([]);
	let loading = $state(true);
	let filter = $state<'all' | 'dubbing' | 'tts' | 'clone'>('all');
	let selected = $state<Set<string>>(new Set());
	let pollTimer: ReturnType<typeof setInterval> | null = null;

	let redubOpen = $state(false);
	let redubSourceId = $state('');
	let redubLang = $state('en');

	function loadLocalTts(): FileItem[] {
		try {
			const parsed = JSON.parse(localStorage.getItem('glotix_tts_history') || '[]');
			if (!Array.isArray(parsed)) return [];
			return parsed.map((item) => ({ ...item, type: 'tts', local: true }));
		} catch {
			return [];
		}
	}

	onMount(() => {
		const unsub = auth.subscribe(() => {
			void refresh();
		});
		return () => {
			unsub();
			if (pollTimer) clearInterval(pollTimer);
		};
	});

	const filtered = $derived(
		files.filter((f) => {
			if (filter === 'all') return true;
			const t = (f.type || '').toLowerCase();
			if (filter === 'dubbing') return t.includes('dub') || t === 'video' || !t;
			if (filter === 'tts') return t.includes('tts') || t.includes('audio');
			if (filter === 'clone') return t.includes('clone') || t.includes('voice');
			return true;
		})
	);

	async function refresh() {
		if (!$auth.user) {
			loading = false;
			files = [];
			return;
		}
		loading = true;
		try {
			const res = await apiFetch('/api/user/files');
			const data = await parseJsonSafe<{ files?: FileItem[]; items?: FileItem[] }>(res);
			const remote = data?.files || data?.items || [];
			const seen = new Set(remote.map((item) => item.id));
			files = [...remote, ...loadLocalTts().filter((item) => !seen.has(item.id))];
			const processing = files.some((f) =>
				['pending', 'processing', 'queued', 'running'].includes(String(f.status || '').toLowerCase())
			);
			if (pollTimer) clearInterval(pollTimer);
			if (processing) {
				pollTimer = setInterval(() => {
					void refreshQuiet();
				}, 8000);
			}
		} catch {
			showToast('Failed to load files', 'error');
		} finally {
			loading = false;
		}
	}

	async function refreshQuiet() {
		try {
			const res = await apiFetch('/api/user/files');
			const data = await parseJsonSafe<{ files?: FileItem[]; items?: FileItem[] }>(res);
			const remote = data?.files || data?.items || [];
			const seen = new Set(remote.map((item) => item.id));
			files = [...remote, ...loadLocalTts().filter((item) => !seen.has(item.id))];
		} catch {
			/* ignore */
		}
	}

	function toggleSelect(id: string) {
		const next = new Set(selected);
		if (next.has(id)) next.delete(id);
		else next.add(id);
		selected = next;
	}

	async function deleteOne(file: FileItem) {
		if (file.local) {
			const updated = loadLocalTts().filter(
				(item) => item.id !== file.id && mediaUrl(item) !== mediaUrl(file)
			);
			localStorage.setItem('glotix_tts_history', JSON.stringify(updated));
			files = files.filter((item) => item !== file);
			showToast('Deleted', 'success');
			return;
		}
		const type = file.type || 'dubbing';
		const res = await apiFetch(
			`/api/user/files/${encodeURIComponent(type)}/${encodeURIComponent(file.id)}`,
			{ method: 'DELETE' }
		);
		if (!res.ok) {
			showToast('Delete failed', 'error');
			return;
		}
		showToast('Deleted', 'success');
		await refresh();
	}

	async function bulkDelete() {
		const ids = [...selected];
		if (!ids.length) return;
		if (!confirm(`Delete ${ids.length} file(s)?`)) return;
		const chosen = files.filter((file) => selected.has(file.id));
		const localChosen = chosen.filter((file) => file.local);
		if (localChosen.length) {
			const localUrls = new Set(localChosen.map(mediaUrl));
			const updated = loadLocalTts().filter(
				(item) => !selected.has(item.id) && !localUrls.has(mediaUrl(item))
			);
			localStorage.setItem('glotix_tts_history', JSON.stringify(updated));
		}
		const items = chosen
			.filter((file) => !file.local)
			.map((file) => ({ type: file.type || 'dubbing', id: String(file.id) }));
		if (!items.length) {
			selected = new Set();
			await refresh();
			return;
		}
		const res = await apiFetch('/api/user/files/bulk-delete', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ items })
		});
		if (!res.ok) {
			showToast('Bulk delete failed', 'error');
			return;
		}
		selected = new Set();
		showToast('Deleted', 'success');
		await refresh();
	}

	function openRedub(id: string) {
		redubSourceId = id;
		redubOpen = true;
	}

	async function startRedub() {
		const res = await apiFetch('/api/dub/redub', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ source_job_id: redubSourceId, lang: redubLang })
		});
		const data = await parseJsonSafe<{ error?: string; job_id?: string }>(res);
		if (!res.ok) {
			showToast(data?.error || 'Re-dub failed', 'error');
			return;
		}
		redubOpen = false;
		showToast('Re-dub started', 'success');
		await refresh();
	}

	function mediaUrl(f: FileItem) {
		return f.output_url || f.media_url || f.url || '';
	}
</script>

<svelte:head>
	<title>My Files | Glotix</title>
	<link rel="canonical" href="https://glotix.ai/history" />
</svelte:head>

<section class="container">
	<div class="page-hero row">
		<div>
			<h1>My Files</h1>
			<p>Dubbing outputs, TTS, and voice clones.</p>
		</div>
		{#if selected.size}
			<button class="btn-outline danger" type="button" onclick={bulkDelete}>
				Delete selected ({selected.size})
			</button>
		{/if}
	</div>

	{#if !$auth.user}
		<div class="card-panel">
			<p>Sign in to view your files.</p>
			<a class="btn-primary" href="/login">Sign in</a>
		</div>
	{:else}
		<div class="filters">
			{#each ['all', 'dubbing', 'tts', 'clone'] as f}
				<button
					type="button"
					class="filter-tab"
					class:active={filter === f}
					onclick={() => (filter = f as typeof filter)}
				>
					{f}
				</button>
			{/each}
		</div>

		{#if loading}
			<p class="muted">Loading…</p>
		{:else if filtered.length === 0}
			<div class="card-panel empty">
				<p>No files yet.</p>
				<a class="btn-primary" href="/dubbing">Start dubbing</a>
			</div>
		{:else}
			<div class="grid">
				{#each filtered as f}
					<article class="file-card" class:selected={selected.has(f.id)}>
						<label class="check">
							<input
								type="checkbox"
								checked={selected.has(f.id)}
								onchange={() => toggleSelect(f.id)}
							/>
						</label>
						<div class="thumb">
							{#if mediaUrl(f)}
								{#if (f.type || '').toLowerCase().includes('tts') || mediaUrl(f).includes('.mp3')}
									<audio controls src={mediaUrl(f)}></audio>
								{:else}
									<video controls src={mediaUrl(f)}><track kind="captions" /></video>
								{/if}
							{:else}
								<div class="ph">{f.status || 'file'}</div>
							{/if}
						</div>
						<div class="meta">
							<strong>{f.name || f.title || f.id}</strong>
							<span class="muted"
								>{f.type || 'dubbing'} · {f.lang || f.language || '—'} · {f.status || '—'}</span
							>
						</div>
						<div class="actions">
							{#if mediaUrl(f)}
								<a class="btn-outline" href={mediaUrl(f)} download>Download</a>
							{/if}
							{#if f.redub_available}
								<button class="btn-outline" type="button" onclick={() => openRedub(f.id)}>
									Re-dub
								</button>
							{/if}
							<button class="btn-outline danger" type="button" onclick={() => deleteOne(f)}>
								Delete
							</button>
						</div>
					</article>
				{/each}
			</div>
		{/if}
	{/if}
</section>

{#if redubOpen}
	<div class="modal">
		<div class="modal-card card-panel">
			<h2>Fast Re-dub</h2>
			<label>
				Target language code
				<input bind:value={redubLang} placeholder="en" />
			</label>
			<div class="modal-actions">
				<button class="btn-outline" type="button" onclick={() => (redubOpen = false)}>Cancel</button>
				<button class="btn-primary" type="button" onclick={startRedub}>Start</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.row {
		display: flex;
		justify-content: space-between;
		gap: 16px;
		align-items: start;
		flex-wrap: wrap;
	}
	.filters {
		display: flex;
		gap: 8px;
		flex-wrap: wrap;
		margin-bottom: 18px;
	}
	.filter-tab {
		background: var(--bg-card);
		border: 1px solid var(--border-color);
		padding: 8px 14px;
		border-radius: 10px;
		font-weight: 600;
		cursor: pointer;
		color: var(--text-muted);
		text-transform: capitalize;
	}
	.filter-tab.active {
		background: var(--accent-blue);
		border-color: var(--accent-blue);
		color: #fff;
	}
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
		gap: 18px;
	}
	.file-card {
		background: var(--bg-card);
		border: 1px solid var(--border-color);
		border-radius: 18px;
		overflow: hidden;
		position: relative;
		display: flex;
		flex-direction: column;
	}
	.file-card.selected {
		border-color: var(--accent-gold);
	}
	.check {
		position: absolute;
		top: 10px;
		left: 10px;
		z-index: 2;
	}
	.thumb {
		aspect-ratio: 16/9;
		background: #0a0a0a;
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.thumb video,
	.thumb audio {
		width: 100%;
		height: 100%;
	}
	.ph {
		color: #fff;
		opacity: 0.7;
		text-transform: uppercase;
		font-size: 0.8rem;
		font-weight: 700;
	}
	.meta {
		padding: 12px 14px;
		display: grid;
		gap: 4px;
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		padding: 0 14px 14px;
	}
	.danger {
		color: var(--error);
	}
	.modal {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.45);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 2000;
		padding: 20px;
	}
	.modal-card {
		width: min(420px, 100%);
		display: grid;
		gap: 12px;
	}
	.modal-card input {
		width: 100%;
		padding: 10px 12px;
		border-radius: 10px;
		border: 1px solid var(--border-color);
		background: var(--bg-page);
		color: var(--text-main);
		margin-top: 6px;
	}
	.modal-actions {
		display: flex;
		justify-content: flex-end;
		gap: 8px;
	}
</style>
