<script lang="ts">
	import { parseSrtText, type ScriptSegment } from '$lib/services/srt';
	import { showToast } from '$lib/stores/toast';

	type Props = {
		segments?: ScriptSegment[];
		busy?: boolean;
		status?: string;
		onchange?: (segments: ScriptSegment[]) => void;
		onextract?: () => void | Promise<void>;
	};

	let { segments = [], busy = false, status = '', onchange, onextract }: Props = $props();
	let zoom = $state(1);

	function emit(next: ScriptSegment[]) {
		onchange?.(next.map((segment, index) => ({ ...segment, id: index })));
	}

	function update(index: number, field: 'start' | 'end' | 'text', value: string | number) {
		emit(
			segments.map((segment, i) =>
				i === index
					? {
							...segment,
							[field]: field === 'text' ? String(value) : Number(value) || 0
						}
					: segment
			)
		);
	}

	function remove(index: number) {
		emit(segments.filter((_, i) => i !== index));
	}

	function addCue() {
		const last = segments.at(-1);
		const start = Number(last?.end) || 0;
		emit([...segments, { id: segments.length, start, end: start + 2, text: '', speaker: 0 }]);
	}

	async function loadSrt(event: Event) {
		const input = event.target as HTMLInputElement;
		const file = input.files?.[0];
		input.value = '';
		if (!file) return;
		try {
			const parsed = parseSrtText(await file.text());
			if (!parsed.length) throw new Error('Could not parse SRT file');
			emit(parsed);
			showToast(`Loaded ${parsed.length} cue(s) from SRT`, 'success');
		} catch (error) {
			showToast(error instanceof Error ? error.message : 'Failed to read SRT', 'error');
		}
	}
</script>

<section class="srt-panel card-panel">
	<header>
		<div>
			<h2>Script editor</h2>
			<span class="muted">{segments.length} cue{segments.length === 1 ? '' : 's'}</span>
		</div>
		<div class="tools">
			<button
				type="button"
				class="icon"
				aria-label="Zoom script out"
				onclick={() => (zoom = Math.max(0.75, zoom - 0.1))}
			>
				<i class="fas fa-minus"></i>
			</button>
			<span>{Math.round(zoom * 100)}%</span>
			<button
				type="button"
				class="icon"
				aria-label="Zoom script in"
				onclick={() => (zoom = Math.min(1.85, zoom + 0.1))}
			>
				<i class="fas fa-plus"></i>
			</button>
		</div>
	</header>

	<div class="toolbar">
		<button class="btn-outline" type="button" disabled={busy} onclick={onextract}>
			<i class="fas fa-wand-magic-sparkles"></i> Extract Script
		</button>
		<label class="btn-outline file-button">
			<i class="fas fa-file-arrow-up"></i> Load SRT
			<input type="file" accept=".srt,text/plain" onchange={loadSrt} />
		</label>
		<button class="btn-outline" type="button" onclick={addCue}>
			<i class="fas fa-plus"></i> Add cue
		</button>
		<button class="btn-outline danger" type="button" onclick={() => emit([])}>Clear</button>
	</div>

	{#if status}
		<p class="status">{status}</p>
	{/if}

	<div class="segments" style={`--srt-font-scale:${zoom}`}>
		{#if segments.length === 0}
			<div class="empty">No cues yet — extract the script or load an .srt file.</div>
		{:else}
			{#each segments as segment, index (segment.id)}
				<div class="cue">
					<div class="cue-meta">
						<strong>#{index + 1}</strong>
						<input
							aria-label={`Cue ${index + 1} start seconds`}
							type="number"
							step="0.01"
							min="0"
							value={segment.start}
							onchange={(event) =>
								update(index, 'start', (event.currentTarget as HTMLInputElement).value)}
						/>
						<span>→</span>
						<input
							aria-label={`Cue ${index + 1} end seconds`}
							type="number"
							step="0.01"
							min="0"
							value={segment.end}
							onchange={(event) =>
								update(index, 'end', (event.currentTarget as HTMLInputElement).value)}
						/>
						<button type="button" class="remove" aria-label="Remove cue" onclick={() => remove(index)}>
							<i class="fas fa-xmark"></i>
						</button>
					</div>
					<textarea
						rows="2"
						value={segment.text}
						oninput={(event) =>
							update(index, 'text', (event.currentTarget as HTMLTextAreaElement).value)}
					></textarea>
				</div>
			{/each}
		{/if}
	</div>
</section>

<style>
	.srt-panel {
		min-height: 0;
		display: grid;
		gap: 12px;
	}
	header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
	}
	h2 {
		font-size: 1rem;
		margin: 0;
	}
	.tools,
	.toolbar {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 7px;
	}
	.icon,
	.remove {
		border: 1px solid var(--border-color);
		background: var(--bg-soft);
		color: var(--text-main);
		border-radius: 8px;
		width: 30px;
		height: 30px;
		cursor: pointer;
	}
	.file-button {
		position: relative;
		cursor: pointer;
	}
	.file-button input {
		position: absolute;
		inset: 0;
		opacity: 0;
		cursor: pointer;
	}
	.status {
		margin: 0;
		color: var(--accent-blue);
		font-size: 0.85rem;
	}
	.segments {
		max-height: 500px;
		overflow: auto;
		display: grid;
		gap: 8px;
		font-size: calc(1rem * var(--srt-font-scale));
	}
	.empty {
		padding: 30px 10px;
		text-align: center;
		color: var(--text-muted);
	}
	.cue {
		border: 1px solid var(--border-color);
		border-radius: 12px;
		padding: 10px;
		background: var(--bg-page);
	}
	.cue-meta {
		display: grid;
		grid-template-columns: auto minmax(70px, 110px) auto minmax(70px, 110px) 30px;
		gap: 6px;
		align-items: center;
		margin-bottom: 7px;
	}
	.cue input,
	.cue textarea {
		width: 100%;
		border: 1px solid var(--border-color);
		border-radius: 8px;
		padding: 7px 8px;
		background: var(--bg-card);
		color: var(--text-main);
		font: inherit;
	}
	.danger,
	.remove {
		color: var(--error);
	}
	@media (max-width: 600px) {
		.cue-meta {
			grid-template-columns: auto 1fr auto 1fr auto;
		}
	}
</style>
