// # FILE frontend/sl-dubbing-frontend-main/src/lib/services/srt.ts
// # AR Pure SRT parse/format helpers and API translation
// # KW تفريغ,srt,مترجم,ترجمة

import { apiFetch, parseJsonSafe } from '$lib/services/api';

export type ScriptSegment = {
	id: number | string;
	start: number;
	end: number;
	text: string;
	speaker: number | string;
};

// # FN formatSrtTimestamp
// # AR Format seconds as an SRT timestamp
// # KW عام,general
export function formatSrtTimestamp(seconds: number): string {
	const value = Math.max(0, Number(seconds) || 0);
	const hours = Math.floor(value / 3600);
	const minutes = Math.floor((value % 3600) / 60);
	const whole = Math.floor(value % 60);
	const milliseconds = Math.round((value - Math.floor(value)) * 1000);
	const pad = (part: number, width: number) => String(part).padStart(width, '0');
	return `${pad(hours, 2)}:${pad(minutes, 2)}:${pad(whole, 2)},${pad(milliseconds, 3)}`;
}

// # FN parseSrtTimestamp
// # AR Parse one SRT timestamp into seconds
// # KW عام,general
export function parseSrtTimestamp(raw: string): number {
	const match = raw.trim().match(/^(\d{1,2}):(\d{2}):(\d{2})[,.](\d{1,3})$/);
	if (!match) return 0;
	const ms = parseInt((match[4] + '000').slice(0, 3), 10);
	return (
		parseInt(match[1], 10) * 3600 +
		parseInt(match[2], 10) * 60 +
		parseInt(match[3], 10) +
		ms / 1000
	);
}

// # FN parseSrtText
// # AR Convert SRT text to editable segments
// # KW تفريغ,srt
export function parseSrtText(text: string): ScriptSegment[] {
	const output: ScriptSegment[] = [];
	const blocks = String(text || '')
		.replace(/\r\n/g, '\n')
		.split(/\n\s*\n/);
	for (const [index, block] of blocks.entries()) {
		const lines = block
			.split('\n')
			.map((line) => line.trim())
			.filter(Boolean);
		if (lines.length < 2) continue;
		const offset = /^\d+$/.test(lines[0]) ? 1 : 0;
		const time = (lines[offset] || '').match(
			/(\d{1,2}:\d{2}:\d{2}[,.]\d{1,3})\s*-->\s*(\d{1,2}:\d{2}:\d{2}[,.]\d{1,3})/
		);
		if (!time) continue;
		const body = lines.slice(offset + 1).join('\n').trim();
		if (!body) continue;
		output.push({
			id: index,
			start: parseSrtTimestamp(time[1]),
			end: parseSrtTimestamp(time[2]),
			text: body,
			speaker: 0
		});
	}
	return output;
}

export function cloneSegments(segments: ScriptSegment[]): ScriptSegment[] {
	return segments
		.map((segment, index) => ({
			id: segment.id ?? index,
			start: Number(segment.start) || 0,
			end: Number(segment.end) || 0,
			text: String(segment.text || '').trim(),
			speaker: segment.speaker ?? 0
		}))
		.filter((segment) => segment.text);
}

// # FN translateSegmentsLiteralApi
// # AR Translate reviewed cues literally through the backend
// # KW مترجم,ترجمة,srt
export async function translateSegmentsLiteralApi(
	segments: ScriptSegment[],
	targetLanguage: string
): Promise<ScriptSegment[]> {
	const res = await apiFetch('/api/dub/translate-segments', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			segments: cloneSegments(segments),
			target_language: targetLanguage,
			style: 'literal'
		})
	});
	const data = await parseJsonSafe<{
		success?: boolean;
		segments?: ScriptSegment[];
		error?: string;
	}>(res);
	if (!res.ok || !data?.success) {
		throw new Error(data?.error || 'Literal translate failed');
	}
	return cloneSegments(data.segments || []);
}
