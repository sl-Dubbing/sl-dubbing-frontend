<script>
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	onMount(() => {
		goto('/', { replaceState: true });
	});
</script>

<svelte:head>
	<meta http-equiv="refresh" content="0;url=/" />
	<link rel="canonical" href="https://glotix.ai/" />
	<title>Glotix</title>
</svelte:head>

<p>This studio was removed. <a href="/">Return home</a>.</p>
