<script lang="ts">
	import { onMount } from 'svelte';
	import { auth } from '$lib/stores/auth';
	import { apiFetch, parseJsonSafe } from '$lib/services/api';
	import { showToast } from '$lib/stores/toast';

	type Pack = {
		id: string;
		name?: string;
		credits?: number;
		amount_cents?: number;
		price_usd?: number;
		tier?: string;
		popular?: boolean;
		free?: boolean;
		features?: Array<string | { text: string; ok?: boolean }>;
	};

	const FALLBACK_PACKS: Pack[] = [
		{ id: 'price_char_free', name: 'Free', credits: 2000, amount_cents: 0, free: true },
		{ id: 'price_char_starter', name: 'Starter', credits: 90000, amount_cents: 900 },
		{
			id: 'price_char_creator',
			name: 'Creator',
			credits: 220000,
			amount_cents: 2200,
			popular: true
		},
		{ id: 'price_char_pro', name: 'Pro', credits: 990000, amount_cents: 9900 },
		{ id: 'price_char_scale', name: 'Scale', credits: 3300000, amount_cents: 33000 },
		{ id: 'price_char_business', name: 'Business', credits: 9900000, amount_cents: 99000 }
	];

	let packs = $state<Pack[]>([]);
	let loading = $state(true);
	let customUsd = $state(10);
	let busy = $state(false);

	onMount(() => {
		void loadPacks();
	});

	async function loadPacks() {
		loading = true;
		try {
			const res = await apiFetch('/api/payments/config', { auth: false });
			const data = await parseJsonSafe<{
				packs?: Pack[] | Record<string, Pack>;
				packages?: Pack[];
				top_ups?: Record<string, Pack>;
			}>(res);
			const raw = data?.top_ups || data?.packs || data?.packages || [];
			if (Array.isArray(raw)) packs = raw;
			else packs = Object.entries(raw).map(([id, v]) => ({ ...v, id }));
		} catch {
			packs = FALLBACK_PACKS;
		} finally {
			if (!packs.length) packs = FALLBACK_PACKS;
			loading = false;
		}
	}

	async function checkout(body: Record<string, unknown>) {
		if (!$auth.user) {
			showToast('Please sign in to purchase credits', 'error');
			return;
		}
		busy = true;
		try {
			const res = await apiFetch('/api/payments/checkout', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(body)
			});
			const data = await parseJsonSafe<{
				success?: boolean;
				url?: string;
				checkout_url?: string;
				error?: string;
			}>(res);
			const url = data?.url || data?.checkout_url;
			if (!res.ok || data?.success === false || !url) {
				showToast(data?.error || 'Checkout failed', 'error');
				return;
			}
			window.location.href = url;
		} catch {
			showToast('Checkout failed', 'error');
		} finally {
			busy = false;
		}
	}
</script>

<svelte:head>
	<title>Pricing | Glotix</title>
	<link rel="canonical" href="https://glotix.ai/pricing" />
</svelte:head>

<section class="container">
	<div class="page-hero">
		<h1>Pricing</h1>
		<p>
			{#if $auth.user}
				Balance: <strong>{$auth.user.credits}</strong> credits
			{:else}
				Sign in to purchase character credits.
			{/if}
		</p>
	</div>

	{#if loading}
		<p class="muted">Loading packages…</p>
	{:else}
		<div class="feature-grid">
			{#each packs as pack}
				<div class="card-panel pack" class:popular={pack.popular}>
					{#if pack.popular}<span class="badge">Popular</span>{/if}
					<h2>{pack.name || pack.id}</h2>
					<p class="credits">{pack.credits?.toLocaleString?.() ?? pack.credits} credits</p>
					<p class="price">
						{#if pack.price_usd != null}
							${pack.price_usd}
						{:else if pack.amount_cents != null}
							${(pack.amount_cents / 100).toFixed(2)}
						{/if}
					</p>
					{#if pack.features?.length}
						<ul>
							{#each pack.features as feature}
								{@const value = typeof feature === 'string' ? { text: feature, ok: true } : feature}
								<li class:missing={value.ok === false}>
									<i class={value.ok === false ? 'fas fa-xmark' : 'fas fa-check'}></i>
									{value.text}
								</li>
							{/each}
						</ul>
					{/if}
					{#if pack.free || pack.amount_cents === 0}
						<a class="btn-outline" href="/dubbing">Get started</a>
					{:else}
						<button
							class="btn-primary"
							disabled={busy}
							onclick={() => checkout({ price_id: pack.id })}
						>
							Buy
						</button>
					{/if}
				</div>
			{:else}
				<p class="muted">No fixed packs returned — use custom amount.</p>
			{/each}
		</div>
	{/if}

	<div class="card-panel custom">
		<h2>Custom amount</h2>
		<label>
			USD
			<input type="number" min="1" step="1" bind:value={customUsd} />
		</label>
		<button
			class="btn-primary"
			disabled={busy || customUsd < 5}
			onclick={() => checkout({ price_id: 'custom', custom_amount_usd: Number(customUsd) })}
		>
			Checkout
		</button>
	</div>
</section>

<style>
	.pack h2 {
		margin: 0 0 8px;
	}
	.pack {
		position: relative;
	}
	.pack.popular {
		border-color: var(--accent-gold);
	}
	.badge {
		position: absolute;
		top: 12px;
		right: 12px;
		background: var(--accent-gold);
		color: #111;
		padding: 3px 8px;
		border-radius: 999px;
		font-size: 0.75rem;
		font-weight: 700;
	}
	.pack ul {
		list-style: none;
		padding: 0;
		display: grid;
		gap: 6px;
	}
	.pack li {
		display: flex;
		gap: 7px;
		color: var(--text-muted);
	}
	.pack li.missing {
		opacity: 0.55;
	}
	.credits {
		font-weight: 700;
		margin: 0 0 4px;
	}
	.price {
		color: var(--text-muted);
		margin: 0 0 16px;
	}
	.custom {
		margin-top: 24px;
		display: flex;
		flex-wrap: wrap;
		gap: 16px;
		align-items: end;
	}
	.custom label {
		display: flex;
		flex-direction: column;
		gap: 6px;
		font-weight: 600;
	}
	.custom input {
		padding: 10px 12px;
		border-radius: 10px;
		border: 1px solid var(--border-color);
		background: var(--bg-page);
		color: var(--text-main);
		width: 140px;
	}
</style>
