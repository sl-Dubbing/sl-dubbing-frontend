// # FILE frontend/sl-dubbing-frontend-main/src/lib/services/auth-headers.ts
// # AR Build Authorization + X-User-Id headers for API calls

import type { AuthHeaders } from '$lib/types/user';
import { parseJwtSub, readGlotixToken, writeGlotixToken } from '$lib/services/jwt';
import { getSupabase } from '$lib/services/supabase';

function buildHeaders(token: string, userId: string): AuthHeaders {
	return { Authorization: 'Bearer ' + token, 'X-User-Id': userId };
}

export function getApiAuthHeaders(): AuthHeaders | null {
	const token = readGlotixToken();
	if (!token) return null;
	const userId = parseJwtSub(token);
	return userId ? buildHeaders(token, userId) : null;
}

function persistUserCache(id: string, email: string): void {
	try {
		const cached = JSON.parse(localStorage.getItem('sl_user_cache') || '{}') as Record<string, unknown>;
		localStorage.setItem('sl_user_cache', JSON.stringify({ ...cached, id, email: email || cached.email || '' }));
	} catch {
		localStorage.setItem('sl_user_cache', JSON.stringify({ id, email }));
	}
}

export async function refreshApiAuthHeadersFromSupabase(): Promise<AuthHeaders | null> {
	const supa = getSupabase();
	if (!supa?.auth?.getSession) return getApiAuthHeaders();
	try {
		const { data: { session } } = await supa.auth.getSession();
		if (!session?.access_token || !session?.user?.id) return getApiAuthHeaders();
		writeGlotixToken(session.access_token);
		persistUserCache(String(session.user.id), session.user.email || '');
		return buildHeaders(session.access_token, String(session.user.id));
	} catch {
		return getApiAuthHeaders();
	}
}
