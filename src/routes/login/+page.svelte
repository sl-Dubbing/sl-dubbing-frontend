<script lang="ts">
	import { goto } from '$app/navigation';
	import { getSupabase } from '$lib/services/supabase';
	import { syncAuthSessionAndCreditsToUi } from '$lib/stores/auth';
	import { showToast } from '$lib/stores/toast';
	import Logo from '$lib/components/Logo.svelte';

	let email = $state('');
	let password = $state('');
	let mode = $state<'login' | 'signup'>('login');
	let loading = $state(false);
	let errorMsg = $state('');

	async function signInWithGoogle() {
		const supa = getSupabase();
		if (!supa) {
			errorMsg = 'Auth is not configured';
			return;
		}
		loading = true;
		errorMsg = '';
		const { error } = await supa.auth.signInWithOAuth({
			provider: 'google',
			options: { redirectTo: `${window.location.origin}/auth/confirm` }
		});
		if (error) {
			errorMsg = error.message || 'Google sign-in failed';
			loading = false;
		}
	}

	async function handleSubmit(e: Event) {
		e.preventDefault();
		const supa = getSupabase();
		if (!supa) {
			errorMsg = 'Auth is not configured';
			return;
		}
		loading = true;
		errorMsg = '';
		try {
			if (mode === 'login') {
				const { data, error } = await supa.auth.signInWithPassword({ email, password });
				if (error) throw error;
				if (data.session) {
					localStorage.setItem('token', data.session.access_token);
					await syncAuthSessionAndCreditsToUi();
					showToast('Signed in', 'success');
					await goto('/');
				}
			} else {
				const { error } = await supa.auth.signUp({
					email,
					password,
					options: { emailRedirectTo: `${window.location.origin}/auth/confirm` }
				});
				if (error) throw error;
				showToast('Check your email to confirm your account', 'success');
				mode = 'login';
			}
		} catch (err) {
			errorMsg = err instanceof Error ? err.message : 'Authentication failed';
		} finally {
			loading = false;
		}
	}
</script>

<svelte:head>
	<title>Glotix | Login</title>
	<meta name="robots" content="noindex, nofollow" />
	<link rel="canonical" href="https://glotix.ai/login" />
</svelte:head>

<div class="login-page">
	<header class="login-top">
		<Logo />
	</header>
	<div class="login-wrapper">
		<div class="login-card">
			<h1>{mode === 'login' ? 'Welcome Back' : 'Create Account'}</h1>
			<p class="subtitle">
				{mode === 'login'
					? 'Sign in to your account to continue'
					: 'Sign up to start dubbing with Glotix'}
			</p>

			{#if errorMsg}
				<div class="error-msg show">
					<i class="fas fa-exclamation-circle"></i>
					<span>{errorMsg}</span>
				</div>
			{/if}

			<button class="oauth-btn" type="button" disabled={loading} onclick={signInWithGoogle}>
				<i class="fab fa-google" style="color:#ea4335"></i>
				Continue with Google
			</button>

			<div class="divider">or continue with email</div>

			<form onsubmit={handleSubmit}>
				<div class="form-group">
					<label for="email">Email</label>
					<input
						id="email"
						type="email"
						bind:value={email}
						placeholder="you@example.com"
						required
						autocomplete="email"
					/>
				</div>
				<div class="form-group">
					<label for="password">Password</label>
					<input
						id="password"
						type="password"
						bind:value={password}
						placeholder="Enter your password"
						required
						autocomplete={mode === 'login' ? 'current-password' : 'new-password'}
					/>
				</div>
				<button type="submit" class="login-btn" disabled={loading}>
					{#if loading}
						<span class="spinner"></span>
						{mode === 'login' ? 'Signing in...' : 'Creating account...'}
					{:else}
						{mode === 'login' ? 'Sign In' : 'Sign Up'}
					{/if}
				</button>
			</form>

			<p class="signup-link">
				{#if mode === 'login'}
					Don't have an account?
					<button type="button" class="linkish" onclick={() => (mode = 'signup')}>Sign up</button>
				{:else}
					Already have an account?
					<button type="button" class="linkish" onclick={() => (mode = 'login')}>Sign in</button>
				{/if}
			</p>
		</div>
	</div>
</div>

<style>
	.login-page {
		min-height: calc(100vh - 90px);
	}
	.login-top {
		padding: 8px 24px 0;
	}
	.login-wrapper {
		display: flex;
		justify-content: center;
		align-items: center;
		min-height: calc(100vh - 160px);
		padding: 24px;
	}
	.login-card {
		background: var(--bg-card);
		border: 1px solid var(--border-color);
		border-radius: 24px;
		padding: 48px 40px;
		width: 100%;
		max-width: 440px;
		box-shadow: 0 4px 20px rgba(0, 0, 0, 0.04);
	}
	.login-card h1 {
		font-size: 1.8rem;
		font-weight: 800;
		margin: 0 0 8px;
		text-align: center;
	}
	.subtitle {
		color: var(--text-muted);
		text-align: center;
		margin: 0 0 32px;
		font-size: 0.95rem;
	}
	.oauth-btn {
		width: 100%;
		padding: 14px;
		border-radius: 12px;
		border: 1px solid var(--border-color);
		background: var(--bg-page);
		color: var(--text-main);
		font-weight: 600;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 10px;
		margin-bottom: 24px;
	}
	.divider {
		display: flex;
		align-items: center;
		gap: 16px;
		margin-bottom: 24px;
		color: var(--text-muted);
		font-size: 0.85rem;
	}
	.divider::before,
	.divider::after {
		content: '';
		flex: 1;
		height: 1px;
		background: var(--border-color);
	}
	.form-group {
		margin-bottom: 20px;
	}
	.form-group label {
		display: block;
		font-size: 0.9rem;
		font-weight: 600;
		margin-bottom: 8px;
	}
	.form-group input {
		width: 100%;
		padding: 14px 16px;
		border: 1px solid var(--border-color);
		border-radius: 12px;
		font-size: 0.95rem;
		background: var(--bg-page);
		color: var(--text-main);
	}
	.login-btn {
		width: 100%;
		padding: 16px;
		border-radius: 12px;
		border: none;
		background: var(--primary);
		color: white;
		font-weight: 700;
		font-size: 1rem;
		cursor: pointer;
		margin-top: 8px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
	}
	.login-btn:disabled,
	.oauth-btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}
	.signup-link {
		text-align: center;
		margin-top: 24px;
		color: var(--text-muted);
		font-size: 0.9rem;
	}
	.linkish {
		background: none;
		border: none;
		color: var(--accent-blue);
		font-weight: 600;
		cursor: pointer;
		padding: 0;
		font-size: inherit;
	}
	.error-msg {
		background: #fee2e2;
		color: #dc2626;
		padding: 12px 16px;
		border-radius: 10px;
		font-size: 0.9rem;
		font-weight: 500;
		margin-bottom: 20px;
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.spinner {
		display: inline-block;
		width: 16px;
		height: 16px;
		border: 2px solid rgba(255, 255, 255, 0.3);
		border-top-color: white;
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}
	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
</style>
