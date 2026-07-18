<script lang="ts">
	import type { Language } from '$lib/services/languages';

	type Props = {
		languages: Language[];
		value?: string;
		values?: string[];
		label?: string;
		multiple?: boolean;
		onchange?: (value: string | string[]) => void;
	};

	let {
		languages,
		value = '',
		values = [],
		label = 'Language',
		multiple = false,
		onchange
	}: Props = $props();

	let open = $state(false);
	let query = $state('');

	const filtered = $derived(
		languages.filter((lang) => {
			const q = query.trim().toLowerCase();
			return !q || lang.name_en.toLowerCase().includes(q) || lang.code.toLowerCase().includes(q);
		})
	);

	const current = $derived(languages.find((lang) => lang.code === value));

	function choose(code: string) {
		if (multiple) {
			const next = values.includes(code) ? values.filter((item) => item !== code) : [...values, code];
			onchange?.(next);
		} else {
			onchange?.(code);
			open = false;
		}
	}
</script>

<div class="language-select">
	<span class="field-label">{label}</span>
	<button class="trigger" type="button" aria-expanded={open} onclick={() => (open = !open)}>
		{#if multiple}
			<span>{values.length ? `${values.length} selected` : 'Select languages'}</span>
		{:else if current}
			<span>{current.flag} {current.name_en}</span>
		{:else}
			<span>Select language</span>
		{/if}
		<i class="fas fa-chevron-down"></i>
	</button>

	{#if open}
		<div class="panel">
			<input bind:value={query} placeholder="Search languages…" aria-label="Search languages" />
			<div class="list">
				{#each filtered as lang}
					<button
						type="button"
						class:selected={multiple ? values.includes(lang.code) : value === lang.code}
						onclick={() => choose(lang.code)}
					>
						<span>{lang.flag}</span>
						<span class="name">{lang.name_en}</span>
						<small>{lang.code}</small>
						{#if multiple && values.includes(lang.code)}
							<i class="fas fa-check"></i>
						{/if}
					</button>
				{/each}
			</div>
		</div>
	{/if}

	{#if multiple && values.length}
		<div class="pills">
			{#each values as code}
				{@const lang = languages.find((item) => item.code === code)}
				<button type="button" onclick={() => choose(code)}>
					{lang?.flag} {lang?.name_en || code} <i class="fas fa-xmark"></i>
				</button>
			{/each}
		</div>
	{/if}
</div>

<style>
	.language-select {
		position: relative;
		display: grid;
		gap: 6px;
	}
	.field-label {
		font-weight: 600;
		font-size: 0.9rem;
	}
	.trigger {
		padding: 12px 14px;
		border-radius: 12px;
		border: 1px solid var(--border-color);
		background: var(--bg-page);
		color: var(--text-main);
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 10px;
		cursor: pointer;
		font: inherit;
	}
	.panel {
		position: absolute;
		top: calc(100% + 8px);
		left: 0;
		right: 0;
		min-width: 290px;
		z-index: 100;
		background: var(--bg-card);
		border: 1px solid var(--border-color);
		border-radius: 14px;
		padding: 10px;
		box-shadow: var(--shadow-lift);
	}
	.panel > input {
		width: 100%;
		padding: 10px 12px;
		border: 1px solid var(--border-color);
		border-radius: 10px;
		background: var(--bg-page);
		color: var(--text-main);
		margin-bottom: 8px;
	}
	.list {
		max-height: 300px;
		overflow: auto;
		display: grid;
		gap: 3px;
	}
	.list button {
		border: 0;
		background: transparent;
		color: var(--text-main);
		display: grid;
		grid-template-columns: 26px 1fr auto 18px;
		align-items: center;
		gap: 8px;
		padding: 9px;
		border-radius: 9px;
		cursor: pointer;
		text-align: left;
	}
	.list button:hover,
	.list button.selected {
		background: var(--bg-soft);
	}
	.name {
		font-weight: 600;
	}
	small {
		color: var(--text-muted);
	}
	.pills {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		margin-top: 4px;
	}
	.pills button {
		border: 1px solid var(--border-color);
		border-radius: 999px;
		background: var(--bg-soft);
		color: var(--text-main);
		padding: 5px 9px;
		cursor: pointer;
	}
</style>
