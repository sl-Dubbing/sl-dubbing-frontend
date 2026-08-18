<script lang="ts">
	import { onMount } from 'svelte';
	import { auth } from '$lib/stores/auth';
	import { apiFetch, parseJsonSafe } from '$lib/services/api';
	import { showToast } from '$lib/stores/toast';

	type ApiKey = {
		id: string;
		name?: string;
		prefix?: string;
		key_prefix?: string;
		created_at?: string;
		last_used_at?: string;
	};

	let keys = $state<ApiKey[]>([]);
	let loading = $state(true);
	let creating = $state(false);
	let modalOpen = $state(false);
	let newKeyPlain = $state<string | null>(null);
	let keyName = $state('');

	const MAX_KEYS = 2;

	onMount(() => {
		const unsub = auth.subscribe((s) => {
			if (s.user) void loadKeys();
			else {
				keys = [];
				loading = false;
			}
		});
		return unsub;
	});

	async function loadKeys() {
		loading = true;
		try {
			const res = await apiFetch('/api/developer/keys');
			const data = await parseJsonSafe<{ api_keys?: ApiKey[] }>(res);
			keys = data?.api_keys || [];
		} catch {
			showToast('Failed to load API keys', 'error');
		} finally {
			loading = false;
		}
	}

	function openCreate() {
		if (keys.length >= MAX_KEYS) {
			showToast('Maximum of 2 API keys per account', 'error');
			return;
		}
		keyName = '';
		modalOpen = true;
	}

	async function createKey() {
		creating = true;
		const name = keyName.trim() || 'My API Key';
		if (keys.some((k) => String(k.name || '').trim().toLowerCase() === name.toLowerCase())) {
			showToast('Each API key needs a different name.', 'error');
			creating = false;
			return;
		}
		try {
			const res = await apiFetch('/api/developer/keys', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name })
			});
			const data = await parseJsonSafe<{
				key?: string;
				success?: boolean;
				error?: string;
				message?: string;
			}>(res);
			if (!res.ok || data?.success === false) {
				showToast(data?.message || data?.error || 'Could not create key', 'error');
				return;
			}
			newKeyPlain = data?.key || null;
			modalOpen = false;
			await loadKeys();
		} catch {
			showToast('Could not create key', 'error');
		} finally {
			creating = false;
		}
	}

	async function revokeKey(id: string) {
		if (!confirm('Delete this key?')) return;
		const res = await apiFetch(`/api/developer/keys/${id}`, { method: 'DELETE' });
		if (!res.ok) {
			showToast('Delete failed', 'error');
			return;
		}
		await loadKeys();
	}

	function copy(text: string) {
		void navigator.clipboard.writeText(text);
		showToast('Copied', 'success');
	}

	function closeModal() {
		modalOpen = false;
	}

	function onModalKey(e: KeyboardEvent) {
		if (e.key === 'Escape') closeModal();
	}

	function fmtDate(value?: string) {
		if (!value) return '—';
		const d = new Date(value);
		return Number.isNaN(d.getTime()) ? '—' : d.toISOString().slice(0, 10);
	}

	function mask(prefix?: string) {
		return `${prefix || 'gl_live_'}*****`;
	}
</script>

<svelte:head>
	<title>API keys | Glotix</title>
	<link rel="canonical" href="https://glotix.ai/developer" />
</svelte:head>

<section class="wrap">
	<nav class="side">
		<a href="/history">Usage</a>
		<a href="/developer" class="active">API keys</a>
		<a href="/pricing">Top up</a>
		<a href="/pricing">Billing</a>
	</nav>
	<div class="main">
		<div class="head">
			<h1>API keys</h1>
			{#if $auth.user}
				<button class="btn-primary" type="button" onclick={openCreate}>Create new API key</button>
			{/if}
		</div>
		<p class="hint">First key requires any credit pack of $9 or more. You can create up to two keys, each with a different name.</p>

		{#if !$auth.user}
			<p><a href="/login">Sign in</a></p>
		{:else}
			{#if newKeyPlain}
				<div class="reveal">
					<code>{newKeyPlain}</code>
					<button type="button" onclick={() => copy(newKeyPlain || '')}>Copy</button>
				</div>
			{/if}
			{#if loading}
				<p class="muted">…</p>
			{:else}
				<table>
					<thead>
						<tr>
							<th>Name</th>
							<th>Key</th>
							<th>Created</th>
							<th>Last used</th>
							<th></th>
						</tr>
					</thead>
					<tbody>
						{#if keys.length === 0}
							<tr><td colspan="5" class="muted">No keys</td></tr>
						{:else}
							{#each keys as k}
								<tr>
									<td>{k.name || 'Key'}</td>
									<td class="mono">{mask(k.prefix || k.key_prefix)}</td>
									<td>{fmtDate(k.created_at)}</td>
									<td>{fmtDate(k.last_used_at)}</td>
									<td>
										<button class="icon" type="button" onclick={() => revokeKey(k.id)}>Delete</button>
									</td>
								</tr>
							{/each}
						{/if}
					</tbody>
				</table>
			{/if}
		{/if}
	</div>
</section>

{#if modalOpen}
	<div
		class="modal-bg"
		role="button"
		tabindex="0"
		aria-label="Close dialog"
		onclick={closeModal}
		onkeydown={(e) => {
			if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') closeModal();
		}}
	>
		<div
			class="modal"
			role="dialog"
			aria-modal="true"
			tabindex="-1"
			aria-labelledby="create-key-title"
			onclick={(e) => e.stopPropagation()}
			onkeydown={onModalKey}
		>
			<h2 id="create-key-title">Create new API key</h2>
			<input bind:value={keyName} maxlength="80" placeholder="Unique name" />
			<div class="actions">
				<button type="button" onclick={closeModal}>Cancel</button>
				<button class="btn-primary" type="button" disabled={creating} onclick={createKey}>
					{creating ? '…' : 'Create'}
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.wrap {
		display: grid;
		grid-template-columns: 200px 1fr;
		gap: 40px;
		max-width: 1180px;
		margin: 0 auto;
		padding: 8px 24px 64px;
	}
	.side {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.side a {
		text-decoration: none;
		color: var(--text-main);
		padding: 10px 14px;
		border-radius: 8px;
		font-weight: 550;
	}
	.side a.active {
		background: #eceae6;
		font-weight: 700;
	}
	.head {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 18px;
	}
	h1 {
		font-size: 1.7rem;
		margin: 0;
	}
	.hint {
		color: var(--text-muted);
		font-size: 0.9rem;
		margin: -8px 0 18px;
		max-width: 46rem;
	}
	table {
		width: 100%;
		border-collapse: collapse;
	}
	th {
		text-align: left;
		font-size: 0.78rem;
		color: var(--text-muted);
		padding: 10px 8px;
		border-bottom: 1px solid var(--border-color);
	}
	td {
		padding: 14px 8px;
		border-bottom: 1px solid var(--border-color);
	}
	.mono {
		font-family: ui-monospace, monospace;
		font-size: 0.84rem;
	}
	.reveal {
		display: flex;
		gap: 10px;
		align-items: center;
		margin-bottom: 16px;
		padding: 12px;
		border: 1px solid var(--border-color);
		border-radius: 10px;
	}
	.reveal code {
		flex: 1;
		word-break: break-all;
	}
	.icon {
		background: none;
		border: none;
		color: var(--text-muted);
		cursor: pointer;
	}
	.modal-bg {
		position: fixed;
		inset: 0;
		background: rgba(10, 10, 10, 0.35);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 50;
	}
	.modal {
		background: #fff;
		width: min(420px, 92vw);
		padding: 22px;
		border-radius: 14px;
	}
	.modal input {
		width: 100%;
		padding: 11px 12px;
		margin: 12px 0 16px;
		border-radius: 10px;
		border: 1px solid var(--border-color);
	}
	.actions {
		display: flex;
		justify-content: flex-end;
		gap: 8px;
	}
	@media (max-width: 800px) {
		.wrap {
			grid-template-columns: 1fr;
		}
	}
</style>
