<script lang="ts">
	import { page } from '$app/stores';
	import Logo from '$lib/components/Logo.svelte';
	import { auth, clearSessionAndGuestUI, getDefaultAvatar } from '$lib/stores/auth';
	import { cycleThemeMode } from '$lib/services/theme';
	import { showToast } from '$lib/stores/toast';

	let menuOpen = $state(false);

	const links = [
		{ href: '/dubbing', label: 'Dubbing Studio', icon: 'fa-regular fa-file-video' },
		{ href: '/tts', label: 'Text to Speech', icon: 'fa-regular fa-comment-dots' },
		{ href: '/video-creation', label: 'Image Studio', icon: 'fa-regular fa-image' },
		{ href: '/history', label: 'My Files', icon: 'fa-regular fa-folder-open' },
		{ href: '/developer', label: 'Developer API', icon: 'fas fa-code', accent: 'dev' },
		{ href: '/pricing', label: 'Upgrade Plan', icon: 'fas fa-arrow-up-right-from-square', accent: 'upgrade' }
	];

	function toggleMenu() {
		menuOpen = !menuOpen;
	}

	function closeMenu() {
		menuOpen = false;
	}

	function onTheme() {
		const r = cycleThemeMode();
		showToast(`Theme: ${r.mode}`, 'info');
	}

	async function onLogout() {
		closeMenu();
		await clearSessionAndGuestUI();
		showToast('Signed out', 'success');
	}

	function onDocClick(e: MouseEvent) {
		const t = e.target as HTMLElement | null;
		if (!t?.closest?.('.user-zone')) menuOpen = false;
	}
</script>

<svelte:window onclick={onDocClick} />

<header class="top-bar">
	<Logo />
	<div class="user-zone">
		<button
			type="button"
			class="theme-toggle"
			data-theme-toggle
			aria-label="Toggle theme"
			title="Toggle theme"
			onclick={onTheme}
		>
			<i class="fas fa-circle-half-stroke"></i>
		</button>
		<button type="button" class="menu-btn" onclick={toggleMenu} aria-expanded={menuOpen}>
			{#if $auth.user}
				<img class="menu-btn-avatar" src={$auth.user.avatarUrl || getDefaultAvatar()} alt="" />
				<span class="menu-btn-label">{$auth.user.name}</span>
			{:else}
				<span class="menu-btn-label">Menu</span>
			{/if}
			<i class="fas fa-chevron-down"></i>
		</button>
		{#if menuOpen}
			<div class="dropdown-panel active" role="menu">
				{#if $auth.user}
					<div class="logged-in-box" style="display:block">
						<div class="user-name">
							<img
								class="user-avatar"
								src={$auth.user.avatarUrl || getDefaultAvatar()}
								alt=""
							/>
							{$auth.user.name}
						</div>
						<a href="/pricing" class="balance-text" onclick={closeMenu}>
							<i class="fas fa-coins"></i>
							<span>{$auth.user.credits ?? '...'}</span> Credits
						</a>
					</div>
				{:else}
					<div class="auth-buttons">
						<a href="/login" class="btn-login" onclick={closeMenu}>Login</a>
						<a href="/login" class="btn-signup" onclick={closeMenu}>Sign up</a>
					</div>
				{/if}
				<hr class="menu-divider" />
				{#each links as link}
					<a
						href={link.href}
						class="menu-item"
						class:is-active={$page.url.pathname === link.href}
						class:accent-dev={link.accent === 'dev'}
						class:accent-upgrade={link.accent === 'upgrade'}
						onclick={closeMenu}
					>
						<i class={link.icon}></i>
						{link.label}
					</a>
				{/each}
				{#if $auth.user}
					<hr class="menu-divider" />
					<button type="button" class="menu-item logout-btn" style="display:flex" onclick={onLogout}>
						<i class="fas fa-right-from-bracket"></i> Log out
					</button>
				{/if}
			</div>
		{/if}
	</div>
</header>

<style>
	.top-bar {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 20px 48px;
		width: 100%;
		box-sizing: border-box;
	}
	.user-zone {
		position: relative;
		display: flex;
		align-items: center;
		gap: 12px;
	}
	.menu-btn {
		background: var(--bg-card);
		border: 1px solid var(--border-color);
		padding: 10px 16px;
		border-radius: 10px;
		cursor: pointer;
		display: flex;
		align-items: center;
		gap: 10px;
		font-weight: 500;
		font-size: 0.95rem;
		color: var(--text-main);
	}
	.menu-btn-avatar {
		width: 24px;
		height: 24px;
		border-radius: 50%;
		object-fit: cover;
	}
	.dropdown-panel {
		position: absolute;
		top: calc(100% + 12px);
		right: 0;
		width: 300px;
		background: var(--bg-card);
		border: 1px solid var(--border-color);
		border-radius: 16px;
		box-shadow: 0 10px 40px rgba(0, 0, 0, 0.08);
		padding: 16px;
		display: flex;
		flex-direction: column;
		gap: 8px;
		z-index: 1000;
	}
	.dropdown-panel a,
	.dropdown-panel button.menu-item {
		text-decoration: none;
		color: var(--text-main);
		padding: 12px 14px;
		border-radius: 10px;
		font-weight: 500;
		display: flex;
		align-items: center;
		gap: 14px;
		background: transparent;
		border: none;
		width: 100%;
		text-align: left;
		cursor: pointer;
		font-size: 0.95rem;
	}
	.dropdown-panel a:hover,
	.dropdown-panel button.menu-item:hover {
		background: var(--bg-soft);
	}
	.menu-divider {
		border: none;
		border-top: 1px solid var(--border-color);
		margin: 8px 0;
	}
	.auth-buttons {
		display: flex;
		gap: 10px;
	}
	.btn-login,
	.btn-signup {
		flex: 1;
		padding: 12px;
		border-radius: 10px;
		text-align: center;
		text-decoration: none;
		font-weight: 600;
		font-size: 0.95rem;
	}
	.btn-login {
		background: var(--bg-page);
		border: 1px solid var(--border-color);
		color: var(--text-main);
	}
	.btn-signup {
		background: var(--primary);
		color: white;
		border: 1px solid var(--primary);
	}
	.logged-in-box {
		background: var(--bg-soft);
		border: 1px solid var(--border-color);
		padding: 16px;
		border-radius: 12px;
	}
	.user-name {
		font-weight: 600;
		font-size: 0.95rem;
		margin-bottom: 8px;
		display: flex;
		align-items: center;
		gap: 10px;
	}
	.user-avatar {
		width: 32px;
		height: 32px;
		border-radius: 50%;
		object-fit: cover;
	}
	.balance-text {
		color: var(--text-muted);
		font-weight: 600;
		font-size: 0.85rem;
		display: flex;
		align-items: center;
		gap: 8px;
		text-decoration: none;
	}
	.logout-btn {
		color: var(--error) !important;
	}
	.accent-dev {
		background: #f0f9ff;
		color: #0284c7;
		border: 1px solid #bae6fd;
	}
	.accent-upgrade {
		background: #eff6ff;
		color: #007aff;
		border: 1px solid #bfdbfe;
	}
	.is-active {
		font-weight: 700;
	}
	@media (max-width: 800px) {
		.top-bar {
			padding: 16px 24px;
		}
		.menu-btn-label {
			display: none;
		}
	}
</style>
