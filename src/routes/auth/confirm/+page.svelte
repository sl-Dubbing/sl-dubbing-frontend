<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { getSupabase } from '$lib/services/supabase';
	import { apiBase, parseJsonSafe } from '$lib/services/api';

	let errorMsg = $state('');
	let loading = $state(true);

	async function saveAndRedirect(
		session: { access_token: string; user: { id: string; email?: string; user_metadata?: Record<string, string> } },
		opts: { sendWelcome?: boolean } = {}
	) {
		localStorage.setItem('token', session.access_token);
		const headers = {
			Authorization: `Bearer ${session.access_token}`,
			'X-User-Id': String(session.user.id)
		};
		let credits: number | string = '...';
		try {
			await fetch(`${apiBase()}/api/user/init`, { method: 'POST', headers });
			const res = await fetch(`${apiBase()}/api/user/credits`, { headers });
			if (res.ok) {
				const d = await parseJsonSafe<{ success?: boolean; credits?: number }>(res);
				if (d && (d.success || d.credits != null)) credits = d.credits ?? '...';
			}
		} catch {
			/* ignore */
		}
		const meta = session.user.user_metadata || {};
		const email = session.user.email || '';
		const name = meta.full_name || meta.name || (email ? email.split('@')[0] : 'User');
		const userData = {
			id: session.user.id,
			email,
			name,
			avatar:
				meta.avatar_url ||
				meta.picture ||
				`https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=0f0f10&color=fff&size=64`,
			credits
		};
		localStorage.setItem('sl_user_cache', JSON.stringify(userData));

		if (opts.sendWelcome) {
			try {
				await fetch(`${apiBase()}/api/auth/verified`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json', ...headers },
					body: JSON.stringify({ email, name })
				});
			} catch {
				/* ignore */
			}
		}
		await goto('/');
	}

	onMount(() => {
		void (async () => {
			const supa = getSupabase();
			if (!supa) {
				errorMsg = 'Auth is not configured';
				loading = false;
				return;
			}

			const params = new URLSearchParams(window.location.search);
			const token_hash = params.get('token_hash');
			const type = params.get('type') || 'signup';
			const hash = window.location.hash;

			if (token_hash) {
				try {
					const { data, error } = await supa.auth.verifyOtp({
						token_hash,
						type: type === 'recovery' ? 'recovery' : 'email'
					});
					if (error) {
						errorMsg = error.message;
						loading = false;
						return;
					}
					if (data?.session) {
						await saveAndRedirect(data.session, { sendWelcome: true });
						return;
					}
				} catch (e) {
					errorMsg = e instanceof Error ? e.message : 'Verification failed';
					loading = false;
					return;
				}
			}

			if (hash && hash.includes('access_token')) {
				const { data } = await supa.auth.getSession();
				if (data.session) {
					await saveAndRedirect(data.session, { sendWelcome: true });
					return;
				}
			}

			const { data: sub } = supa.auth.onAuthStateChange(async (event, session) => {
				if (event === 'SIGNED_IN' && session) {
					await saveAndRedirect(session, { sendWelcome: true });
				}
			});

			setTimeout(async () => {
				const { data } = await supa.auth.getSession();
				if (data.session) {
					await saveAndRedirect(data.session, { sendWelcome: true });
				} else if (!token_hash) {
					await goto('/');
				} else {
					loading = false;
					errorMsg = 'Could not complete sign-in';
				}
				try {
					sub.subscription.unsubscribe();
				} catch {
					/* ignore */
				}
			}, 5000);
		})();
	});
</script>

<svelte:head>
	<title>Signing in... | Glotix</title>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<div class="box">
	{#if loading && !errorMsg}
		<div class="spinner"></div>
		<p>Signing you in...</p>
	{:else}
		<div class="error-box">
			<p>{errorMsg || 'Something went wrong.'}</p>
			<a href="/login">← Back to Login</a>
		</div>
	{/if}
</div>

<style>
	.box {
		text-align: center;
		padding: 40px 20px;
		min-height: 50vh;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
	}
	.spinner {
		width: 40px;
		height: 40px;
		border: 4px solid #e8e4d8;
		border-top-color: #fcca69;
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
		margin: 0 auto 20px;
	}
	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
	p {
		color: var(--text-muted);
		font-weight: 500;
	}
	.error-box {
		background: #fef2f2;
		border: 1px solid #fecaca;
		border-radius: 12px;
		padding: 20px;
		max-width: 400px;
	}
	.error-box p {
		color: #dc2626;
		margin-bottom: 12px;
	}
	.error-box a {
		color: var(--text-main);
		font-weight: 600;
		text-decoration: none;
	}
</style>
