// # FILE frontend/sl-dubbing-frontend-main/src/lib/services/api.ts
// # AR Thin fetch wrapper with auth headers, JSON helpers, and robust retry logic

import { normalizeApiBaseUrl } from '$lib/config';
import { getApiAuthHeaders, refreshApiAuthHeadersFromSupabase } from '$lib/services/auth-headers';

// # FN apiBase
// # AR Guarantee no trailing slash for consistent route concatenation
export function apiBase(): string {
	return normalizeApiBaseUrl().replace(/\/+$/, '');
}

export type ApiFetchOptions = RequestInit & {
	auth?: boolean;
	retryOn401?: boolean;
};

// # FN apiFetch
// # AR fetch against API_BASE with optional Bearer headers and safe 401 retries
// # KW عام,general,مصادقة,auth
export async function apiFetch(path: string, options: ApiFetchOptions = {}): Promise<Response> {
	const { auth = true, retryOn401 = true, headers: initHeaders, ...rest } = options;
	
	// # guard — normalize path to prevent //api/dub routing bugs
	const normalizedPath = path.startsWith('/') ? path : `/${path}`;
	const url = path.startsWith('http') ? path : `${apiBase()}${normalizedPath}`;
	
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
		// # guard — prevent connection leak; eagerly discard the unread 401 body
		await res.text().catch(() => {});
		
		// # guard — Cannot reliably replay a consumed stream; fail fast to prevent TypeError
		if (rest.body instanceof ReadableStream) {
			console.warn('[apiFetch] Cannot retry 401 because request body is a locked stream');
			return res;
		}

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
	// # guard — return early if response is clearly empty (e.g. 204 No Content)
	if (res.status === 204 || res.headers.get('content-length') === '0') {
		return null;
	}
	try {
		return (await res.json()) as T;
	} catch {
		return null;
	}
}