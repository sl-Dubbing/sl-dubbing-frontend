<script lang="ts">
	import { onMount } from 'svelte';
	import { auth } from '$lib/stores/auth';
	import { apiFetch, parseJsonSafe } from '$lib/services/api';
	import { showToast } from '$lib/stores/toast';

	type ApiKey = { id: string; name?: string; prefix?: string; key_prefix?: string; created_at?: string };

	let keys = $state<ApiKey[]>([]);
	let loading = $state(true);
	let creating = $state(false);
	let newKeyPlain = $state<string | null>(null);
	let keyName = $state('My key');

	const MIN_CREDITS = 1300;

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
			const data = await parseJsonSafe<{ keys?: ApiKey[]; data?: ApiKey[]; api_keys?: ApiKey[] }>(res);
			keys = data?.api_keys || data?.keys || data?.data || [];
		} catch {
			showToast('Failed to load API keys', 'error');
		} finally {
			loading = false;
		}
	}

	async function createKey() {
		creating = true;
		newKeyPlain = null;
		try {
			const res = await apiFetch('/api/developer/keys', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name: keyName || 'My key' })
			});
			const data = await parseJsonSafe<{
				key?: string;
				api_key?: string;
				error?: string;
				message?: string;
				success?: boolean;
			}>(res);
			if (!res.ok || data?.success === false) {
				showToast(data?.error || data?.message || 'Could not create key', 'error');
				return;
			}
			newKeyPlain = data?.key || data?.api_key || null;
			showToast('API key created — copy it now', 'success');
			await loadKeys();
		} catch {
			showToast('Could not create key', 'error');
		} finally {
			creating = false;
		}
	}

	async function revokeKey(id: string) {
		if (!confirm('Revoke this API key?')) return;
		const res = await apiFetch(`/api/developer/keys/${id}`, { method: 'DELETE' });
		if (!res.ok) {
			showToast('Revoke failed', 'error');
			return;
		}
		showToast('Key revoked', 'success');
		await loadKeys();
	}

	function copy(text: string) {
		void navigator.clipboard.writeText(text);
		showToast('Copied', 'success');
	}

	const creditsNum = $derived(
		typeof $auth.user?.credits === 'number' ? $auth.user.credits : Number($auth.user?.credits) || 0
	);
</script>

<svelte:head>
	<title>Developer API | Glotix</title>
	<link rel="canonical" href="https://glotix.ai/developer" />
</svelte:head>

<section class="container">
	<div class="page-hero">
		<h1>Developer API</h1>
		<p>Create API keys to call Glotix REST endpoints with character credits.</p>
	</div>

	{#if !$auth.user}
		<div class="card-panel">
			<p>Sign in to manage API keys.</p>
			<a class="btn-primary" href="/login">Sign in</a>
		</div>
	{:else}
		{#if creditsNum < MIN_CREDITS}
			<div class="card-panel warn">
				You need at least <strong>{MIN_CREDITS}</strong> credits to create an API key. Current:
				<strong>{creditsNum}</strong>. <a href="/pricing">Top up →</a>
			</div>
		{/if}

		<div class="card-panel create">
			<label>
				Key name
				<input bind:value={keyName} />
			</label>
			<button
				class="btn-primary"
				disabled={creating || creditsNum < MIN_CREDITS}
				onclick={createKey}
			>
				{creating ? 'Creating…' : 'Create API key'}
			</button>
		</div>

		{#if newKeyPlain}
			<div class="card-panel secret">
				<p>Copy this key now — it won’t be shown again.</p>
				<code>{newKeyPlain}</code>
				<button class="btn-outline" type="button" onclick={() => copy(newKeyPlain || '')}>
					Copy
				</button>
			</div>
		{/if}

		<div class="card-panel">
			<h2>Active keys</h2>
			{#if loading}
				<p class="muted">Loading…</p>
			{:else if keys.length === 0}
				<p class="muted">No keys yet.</p>
			{:else}
				<ul class="key-list">
					{#each keys as k}
						<li>
							<div>
								<strong>{k.name || 'Key'}</strong>
								<span class="muted">{k.prefix || k.key_prefix || k.id}</span>
							</div>
							<button class="btn-outline danger" type="button" onclick={() => revokeKey(k.id)}>
								Revoke
							</button>
						</li>
					{/each}
				</ul>
			{/if}
		</div>

		<div class="card-panel">
			<h2>Quick start</h2>
			<pre>{`curl -H "Authorization: Bearer YOUR_API_KEY" \\
  https://api.glotix.ai/v1/credits`}</pre>
		</div>
	{/if}
</section>

<style>
	.warn {
		border-color: #fde68a;
		background: #fffbeb;
		color: #92400e;
		margin-bottom: 16px;
	}
	.create {
		display: flex;
		flex-wrap: wrap;
		gap: 12px;
		align-items: end;
		margin-bottom: 16px;
	}
	.create label {
		display: flex;
		flex-direction: column;
		gap: 6px;
		font-weight: 600;
		flex: 1;
	}
	.create input {
		padding: 10px 12px;
		border-radius: 10px;
		border: 1px solid var(--border-color);
		background: var(--bg-page);
		color: var(--text-main);
	}
	.secret {
		margin-bottom: 16px;
		display: grid;
		gap: 10px;
	}
	.secret code {
		word-break: break-all;
		background: var(--bg-soft);
		padding: 12px;
		border-radius: 10px;
	}
	.key-list {
		list-style: none;
		padding: 0;
		margin: 0;
	}
	.key-list li {
		display: flex;
		justify-content: space-between;
		gap: 12px;
		align-items: center;
		padding: 12px 0;
		border-bottom: 1px solid var(--border-color);
	}
	.danger {
		color: var(--error);
	}
	pre {
		background: var(--bg-soft);
		padding: 14px;
		border-radius: 12px;
		overflow: auto;
		font-size: 0.85rem;
	}
</style>
