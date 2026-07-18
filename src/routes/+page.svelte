<script lang="ts">
	const studios = [
		{
			href: '/dubbing',
			title: 'Dubbing Studio',
			desc: 'Upload video and dub it into 55+ languages with AI voice cloning.',
			icon: 'fa-solid fa-film'
		},
		{
			href: '/tts',
			title: 'Text to Speech',
			desc: 'Generate natural speech from text with premium and cloned voices.',
			icon: 'fa-solid fa-microphone'
		},
		{
			href: '/video-creation',
			title: 'Image Studio',
			desc: 'Turn a still image into a talking video with estimated credit cost.',
			icon: 'fa-solid fa-image'
		}
	];
</script>

<svelte:head>
	<title>Glotix | AI Video Dubbing</title>
	<meta
		name="description"
		content="Glotix AI dubbing, text-to-speech, and image-to-video studio."
	/>
	<link rel="canonical" href="https://glotix.ai/" />
</svelte:head>

<section class="hero container">
	<p class="eyebrow">Glotix</p>
	<h1>AI dubbing that keeps the voice</h1>
	<p class="lead">
		Translate, clone, and deliver studio-ready audio for video — with credits, history, and a
		developer API.
	</p>
	<div class="cta-row">
		<a class="btn-primary" href="/dubbing">Start Dubbing <i class="fa-solid fa-arrow-right"></i></a>
		<a class="btn-outline" href="/pricing">See pricing</a>
	</div>
</section>

<section class="container">
	<div class="feature-grid">
		{#each studios as s}
			<a class="feature-card" href={s.href}>
				<div class="icon"><i class={s.icon}></i></div>
				<h2>{s.title}</h2>
				<p>{s.desc}</p>
			</a>
		{/each}
	</div>
</section>

<section class="container secondary">
	<div class="card-panel links">
		<a href="/history">My Files</a>
		<a href="/developer">Developer API</a>
		<a href="/privacy">Privacy</a>
		<a href="/terms">Terms</a>
	</div>
</section>

<style>
	.hero {
		padding-top: 48px;
		padding-bottom: 36px;
	}
	.eyebrow {
		font-weight: 800;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--accent-gold);
		margin: 0 0 12px;
		font-size: 0.85rem;
	}
	.hero h1 {
		font-size: clamp(2.2rem, 5vw, 3.4rem);
		font-weight: 800;
		letter-spacing: -0.04em;
		margin: 0 0 14px;
		max-width: 14ch;
		line-height: 1.05;
	}
	.lead {
		color: var(--text-muted);
		font-size: 1.1rem;
		max-width: 42rem;
		margin: 0 0 28px;
	}
	.cta-row {
		display: flex;
		flex-wrap: wrap;
		gap: 12px;
	}
	.icon {
		width: 44px;
		height: 44px;
		border-radius: 12px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--bg-soft);
		color: var(--accent-gold);
		margin-bottom: 14px;
	}
	.secondary {
		padding-top: 28px;
	}
	.links {
		display: flex;
		flex-wrap: wrap;
		gap: 18px;
	}
	.links a {
		color: var(--text-muted);
		font-weight: 600;
		text-decoration: none;
	}
	.links a:hover {
		color: var(--text-main);
	}
</style>
