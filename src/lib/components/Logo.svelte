<script lang="ts">
	type Props = { href?: string; compact?: boolean };
	let { href = '/', compact = false }: Props = $props();
</script>

<a class="logo" {href} aria-label="Glotix home">
	<span class="logo-lockup">
		{#if compact}
			<img
				class="logo-mark logo-mark-only logo-img--light"
				src="/logo/logo_arrow_White.svg"
				alt="Glotix"
			/>
			<img
				class="logo-mark logo-mark-only logo-img--dark"
				src="/logo/logo_arrow_Black.svg"
				alt=""
			/>
		{:else}
			<img class="logo-mark logo-img--light" src="/logo/logo_arrow_White.svg" alt="" />
			<img class="logo-mark logo-img--dark" src="/logo/logo_arrow_Black.svg" alt="" />
			<span class="logo-wordmark">
				<img class="logo-img logo-img--light" src="/logo/glotix_Black.svg" alt="Glotix" />
				<img class="logo-img logo-img--dark" src="/logo/glotix_White.svg" alt="" />
				<img class="logo-i-tittle" src="/logo/glotix_Triangle.svg" alt="" />
			</span>
		{/if}
	</span>
</a>
