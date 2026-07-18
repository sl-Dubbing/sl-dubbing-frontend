// # FILE frontend/sl-dubbing-frontend-main/src/lib/services/auth-headers.ts
// # AR Build Authorization + X-User-Id headers for API calls

import type { AuthHeaders } from '$lib/types/user';
import { parseJwtSub } from '$lib/services/jwt';
import { getSupabase } from '$lib/services/supabase';

// # FN getApiAuthHeaders
// # AR Read token from localStorage and build API auth headers
// # KW مصادقة,auth,JWT,supabase
export function getApiAuthHeaders(): AuthHeaders | null {
	if (typeof localStorage === 'undefined') return null;
	const token = (localStorage.getItem('token') || '').trim();
	if (!token) return null;
	const userId = parseJwtSub(token);
	if (!userId) return null;
	return {
		Authorization: 'Bearer ' + token,
		'X-User-Id': userId
	};
}

// # FN refreshApiAuthHeadersFromSupabase
// # AR Refresh session from Supabase then rebuild headers
// # KW مصادقة,auth,JWT,supabase
export async function refreshApiAuthHeadersFromSupabase(): Promise<AuthHeaders | null> {
	const supa = getSupabase();
	if (!supa?.auth?.getSession) return getApiAuthHeaders();
	try {
		const {
			data: { session }
		} = await supa.auth.getSession();
		if (!session?.access_token || !session?.user?.id) return getApiAuthHeaders();
		localStorage.setItem('token', session.access_token);
		try {
			const cached = JSON.parse(localStorage.getItem('sl_user_cache') || '{}') as Record<
				string,
				unknown
			>;
			localStorage.setItem(
				'sl_user_cache',
				JSON.stringify({
					...cached,
					id: String(session.user.id),
					email: session.user.email || cached.email || ''
				})
			);
		} catch {
			localStorage.setItem(
				'sl_user_cache',
				JSON.stringify({
					id: String(session.user.id),
					email: session.user.email || ''
				})
			);
		}
		return {
			Authorization: 'Bearer ' + session.access_token,
			'X-User-Id': String(session.user.id)
		};
	} catch {
		return getApiAuthHeaders();
	}
}
