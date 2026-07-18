<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import AppNav from '$lib/components/AppNav.svelte';
	import ToastStack from '$lib/components/ToastStack.svelte';
	import { syncAuthSessionAndCreditsToUi, checkApiConnection } from '$lib/stores/auth';
	import { getSupabase } from '$lib/services/supabase';
	import { initThemeFromStorage } from '$lib/services/theme';
	import '$lib/styles/theme.css';
	import '$lib/styles/brand-theme.css';
	import '$lib/styles/logo.css';
	import '$lib/styles/style.css';
	import '$lib/styles/app.css';

	let { children } = $props();

	onMount(() => {
		if (!browser) return;
		initThemeFromStorage();
		void syncAuthSessionAndCreditsToUi();
		void checkApiConnection();

		const supabase = getSupabase();
		const { data } = supabase?.auth.onAuthStateChange(() => {
			void syncAuthSessionAndCreditsToUi();
		}) || { data: null };

		return () => data?.subscription.unsubscribe();
	});
</script>

<div class="app-shell">
	<AppNav />
	<main class="app-main">
		{@render children()}
	</main>
	<ToastStack />
</div>
