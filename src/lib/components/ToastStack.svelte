<script lang="ts">
	import { toasts } from '$lib/stores/toast';
</script>

<div id="toasts" class="toast-stack" aria-live="polite">
	{#each $toasts as t (t.id)}
		<div
			class="toast show"
			class:error={t.type === 'error'}
			class:success={t.type === 'success'}
			class:warning={t.type === 'warning'}
		>
			{t.message}
		</div>
	{/each}
</div>

<style>
	.toast-stack {
		position: fixed;
		top: 20px;
		right: 20px;
		z-index: 10000;
		display: flex;
		flex-direction: column;
		gap: 10px;
		pointer-events: none;
	}
	.toast {
		background: var(--bg-card, #fff);
		color: var(--text-main, #111);
		border: 1px solid var(--border-color, #e0dfdb);
		border-radius: 12px;
		padding: 12px 16px;
		box-shadow: var(--shadow-soft);
		font-weight: 600;
		font-size: 0.9rem;
		opacity: 0;
		transform: translateY(-8px);
		transition: 0.25s ease;
		max-width: min(360px, 90vw);
	}
	.toast.show {
		opacity: 1;
		transform: translateY(0);
	}
	.toast.error {
		background: #fef2f2;
		color: #dc2626;
		border-color: #fecaca;
	}
	.toast.success {
		background: #ecfdf5;
		color: #047857;
		border-color: #a7f3d0;
	}
	.toast.warning {
		background: #fffbeb;
		color: #b45309;
		border-color: #fde68a;
	}
</style>
