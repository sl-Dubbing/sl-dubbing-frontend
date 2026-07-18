<script lang="ts">
	/* Legal pages — English UI only (product policy). */
</script>

<svelte:head>
	<title>Privacy Policy | Glotix</title>
	<meta name="description" content="Glotix privacy policy." />
	<link rel="canonical" href="https://glotix.ai/privacy" />
</svelte:head>

<article class="container legal">
	<div class="page-hero">
		<h1>Privacy Policy</h1>
		<p>Last updated: 2026</p>
	</div>
	<div class="card-panel prose">
		<p>
			Glotix (“we”, “us”) provides AI dubbing and speech tools at
			<a href="https://glotix.ai">https://glotix.ai</a>. This policy explains what data we
			collect, how we use it, and your choices.
		</p>
		<h2>Information we collect</h2>
		<ul>
			<li>Account data (email, name, avatar) via Supabase Auth / Google OAuth.</li>
			<li>Usage data needed to run jobs: uploaded media references, job status, credit balance.</li>
			<li>Payment metadata processed by Stripe (we do not store full card numbers).</li>
			<li>Developer API keys you create (stored hashed; plaintext shown once).</li>
		</ul>
		<h2>How we use information</h2>
		<ul>
			<li>To authenticate you and operate dubbing, TTS, and Image Studio features.</li>
			<li>To bill character credits and prevent abuse.</li>
			<li>To improve reliability, security, and support.</li>
		</ul>
		<h2>Storage and processors</h2>
		<p>
			Media objects are stored in user-owned object storage (R2). Authentication is handled by
			Supabase. Payments are handled by Stripe. Processing may run on our API and GPU workers.
		</p>
		<h2>Retention</h2>
		<p>
			Job outputs and voice samples follow product quotas and deletion tools in My Files. You may
			request account deletion by contacting support.
		</p>
		<h2>Contact</h2>
		<p>Questions about privacy: use the contact options on the Glotix site.</p>
		<p class="muted"><a href="/terms">Terms of Service</a> · <a href="/">Home</a></p>
	</div>
</article>

<style>
	.legal {
		padding-bottom: 64px;
	}
	.prose h2 {
		margin-top: 1.4rem;
		font-size: 1.15rem;
	}
	.prose ul {
		padding-left: 1.2rem;
	}
	.prose a {
		color: var(--accent-blue);
	}
</style>
