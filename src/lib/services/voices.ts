// # FILE frontend/sl-dubbing-frontend-main/src/lib/services/voices.ts
// # AR Premium and user voice catalog plus R2 sample upload
// # KW صوت,استنساخ,voice,clone,sample,رفع,upload,R2

import { apiFetch, parseJsonSafe } from '$lib/services/api';
import { getSupabase } from '$lib/services/supabase';

export type Voice = {
	id: string;
	name: string;
	sample_url: string;
	sample_text?: string;
	avatar_url?: string;
	engine?: string;
	source: 'quick' | 'premium' | 'saved' | 'library' | 'upload' | 'video' | 'default';
};

// # FN loadPremiumVoices
// # AR Fetch public premium voices from Supabase voices table
// # KW صوت,استنساخ,voice,clone,sample
export async function loadPremiumVoices(): Promise<Voice[]> {
	const supabase = getSupabase();
	if (!supabase) return [];
	try {
		const { data, error } = await supabase.from('voices').select('*').order('created_at');
		if (error || !data) return [];
		return data.map((voice) => ({
			id: String(voice.id),
			name: String(voice.name || 'Premium Voice'),
			sample_url: String(voice.sample_url || ''),
			sample_text: String(voice.sample_text || ''),
			avatar_url: String(voice.avatar_url || ''),
			engine: String(voice.engine || ''),
			source: 'premium' as const
		}));
	} catch {
		return [];
	}
}

// # FN fetchUserVoiceClonesFromApi
// # AR Fetch authenticated user's saved voice library
// # KW صوت,استنساخ,voice,clone,sample
export async function loadUserVoiceClones(): Promise<Voice[]> {
	try {
		const res = await apiFetch('/api/user/voice-clones');
		const data = await parseJsonSafe<{
			clones?: Array<Record<string, unknown>>;
		}>(res);
		if (!res.ok || !Array.isArray(data?.clones)) return [];
		return data.clones.map((voice) => ({
			id: String(voice.id || ''),
			name: String(voice.name || 'My Voice'),
			sample_url: String(voice.sample_url || ''),
			sample_text: String(voice.sample_text || ''),
			source: 'library' as const
		}));
	} catch {
		return [];
	}
}

// # FN fetchSavedVoiceProfileFromApi
// # AR Fetch the user's default saved voice profile
// # KW صوت,استنساخ,voice,clone,sample
export async function loadSavedVoice(): Promise<Voice | null> {
	try {
		const res = await apiFetch('/api/user/saved-voice');
		const data = await parseJsonSafe<{
			saved?: boolean;
			sample_url?: string;
			name?: string;
		}>(res);
		if (!res.ok || !data?.saved || !data.sample_url) return null;
		return {
			id: 'saved',
			name: data.name || 'My Saved Voice',
			sample_url: data.sample_url,
			source: 'saved'
		};
	} catch {
		return null;
	}
}

// # FN uploadVoiceSample
// # AR Upload a browser audio sample to an authenticated R2 grant
// # KW صوت,استنساخ,voice,clone,sample,رفع,upload,R2
export async function uploadVoiceSample(file: Blob, filename = 'voice-sample.webm'): Promise<string> {
	const contentType = file.type || 'audio/webm';
	const grantRes = await apiFetch('/api/upload-url', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ filename, content_type: contentType, category: 'voice-clones' })
	});
	const grant = await parseJsonSafe<{
		upload_url?: string;
		put_url?: string;
		url?: string;
		get_url?: string;
		file_url?: string;
	}>(grantRes);
	if (!grantRes.ok) throw new Error('Could not create voice upload');
	const putUrl = grant?.upload_url || grant?.put_url || grant?.url;
	if (!putUrl) throw new Error('No voice upload URL returned');
	const put = await fetch(putUrl, {
		method: 'PUT',
		headers: { 'Content-Type': contentType },
		body: file
	});
	if (!put.ok) throw new Error('Voice upload failed');
	const sampleUrl = grant?.get_url || grant?.file_url || grant?.url;
	if (!sampleUrl) throw new Error('No voice sample URL returned');
	return sampleUrl;
}

// # FN persistVoiceCloneToLibrary
// # AR Save one uploaded sample in the user's voice clone library
// # KW صوت,استنساخ,voice,clone,sample
export async function saveVoiceClone(
	name: string,
	sampleUrl: string,
	sampleText = ''
): Promise<void> {
	const res = await apiFetch('/api/user/voice-clones', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			name: name.trim() || 'My Voice',
			sample_url: sampleUrl,
			sample_text: sampleText.trim()
		})
	});
	const data = await parseJsonSafe<{ error?: string }>(res);
	if (!res.ok) throw new Error(data?.error || 'Could not save voice');
}
