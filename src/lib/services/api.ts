// # FILE frontend/sl-dubbing-frontend-main/src/lib/services/api.ts
// # AR Thin fetch wrapper with auth headers and JSON helpers

import { normalizeApiBaseUrl } from '$lib/config';
import { getApiAuthHeaders, refreshApiAuthHeadersFromSupabase } from '$lib/services/auth-headers';

export function apiBase(): string {
	return normalizeApiBaseUrl();
}

export type ApiFetchOptions = RequestInit & {
	auth?: boolean;
	retryOn401?: boolean;
};

// # FN apiFetch
// # AR fetch against API_BASE with optional Bearer headers
// # KW عام,general,مصادقة,auth
export async function apiFetch(path: string, options: ApiFetchOptions = {}): Promise<Response> {
	const { auth = true, retryOn401 = true, headers: initHeaders, ...rest } = options;
	const url = path.startsWith('http') ? path : `${apiBase()}${path.startsWith('/') ? '' : '/'}${path}`;
	const headers = new Headers(initHeaders || {});
	if (auth) {
		const h = (await refreshApiAuthHeadersFromSupabase()) || getApiAuthHeaders();
		if (h) {
			headers.set('Authorization', h.Authorization);
			headers.set('X-User-Id', h['X-User-Id']);
		}
	}
	let res = await fetch(url, { ...rest, headers });
	if (auth && retryOn401 && res.status === 401) {
		const refreshed = await refreshApiAuthHeadersFromSupabase();
		if (refreshed) {
			headers.set('Authorization', refreshed.Authorization);
			headers.set('X-User-Id', refreshed['X-User-Id']);
			res = await fetch(url, { ...rest, headers });
		}
	}
	return res;
}

// # FN parseJsonSafe
// # AR Parse JSON body; return null on failure
// # KW عام,general
export async function parseJsonSafe<T = unknown>(res: Response): Promise<T | null> {
	try {
		return (await res.json()) as T;
	} catch {
		return null;
	}
}
