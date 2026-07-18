// # FILE frontend/sl-dubbing-frontend-main/src/lib/stores/auth.ts
// # AR Auth + credits session store

import { writable, get } from 'svelte/store';
import type { Session, User } from '@supabase/supabase-js';
import { browser } from '$app/environment';
import { DEFAULT_MENU_AVATAR } from '$lib/config';
import { apiBase, parseJsonSafe } from '$lib/services/api';
import { getSupabase } from '$lib/services/supabase';
import { parseJwtSub } from '$lib/services/jwt';
import { showToast } from '$lib/stores/toast';
import type { MenuUser } from '$lib/types/user';

export type AuthState = {
	ready: boolean;
	session: Session | null;
	user: MenuUser | null;
	apiUnreachable: boolean;
};

const initial: AuthState = {
	ready: false,
	session: null,
	user: null,
	apiUnreachable: false
};

export const auth = writable<AuthState>(initial);

// # FN buildMenuUserProfileFromSupabaseUser
// # AR Map Supabase user → menu profile
// # KW مصادقة,auth,JWT,supabase
export function buildMenuUserProfileFromSupabaseUser(su: User | null | undefined): MenuUser | null {
	if (!su?.id) return null;
	const meta = (su.user_metadata || {}) as Record<string, string | undefined>;
	const name =
		meta.full_name ||
		meta.name ||
		meta.preferred_username ||
		(su.email && String(su.email).split('@')[0]) ||
		'User';
	const avatarUrl =
		meta.avatar_url ||
		meta.picture ||
		'https://ui-avatars.com/api/?name=' +
			encodeURIComponent(name) +
			'&size=128&background=334155&color=fff';
	return { id: su.id, name: String(name), email: su.email || '', avatarUrl: String(avatarUrl), credits: '...' };
}

function extractCredits(payload: unknown): number | null {
	if (!payload || typeof payload !== 'object') return null;
	const d = payload as Record<string, unknown>;
	const c = d.credits ?? d.character_credits ?? d.balance;
	if (typeof c === 'number' && Number.isFinite(c)) return c;
	if (typeof c === 'string' && c.trim() !== '' && !Number.isNaN(Number(c))) return Number(c);
	return null;
}

// # FN clearSessionAndGuestUI
// # AR Clear tokens + guest menu state
// # KW مصادقة,auth,JWT,supabase
export async function clearSessionAndGuestUI(message?: string): Promise<void> {
	try {
		localStorage.removeItem('token');
		localStorage.removeItem('sl_user_cache');
	} catch {
		/* ignore */
	}
	try {
		for (let i = sessionStorage.length - 1; i >= 0; i--) {
			const k = sessionStorage.key(i);
			if (k && k.indexOf('sl_user_inited_') === 0) sessionStorage.removeItem(k);
		}
	} catch {
		/* ignore */
	}
	try {
		const supa = getSupabase();
		if (supa?.auth?.signOut) await supa.auth.signOut();
	} catch {
		/* ignore */
	}
	auth.update((s) => ({ ...s, session: null, user: null, ready: true }));
	if (message) showToast(message, 'error');
}

async function fetchCreditsForSession(session: Session, baseUser: MenuUser): Promise<void> {
	const userId = String(session.user.id);
	const initKey = 'sl_user_inited_' + userId;
	const headers = {
		Authorization: `Bearer ${session.access_token}`,
		'X-User-Id': userId
	};
	const base = apiBase();

	if (!sessionStorage.getItem(initKey)) {
		try {
			const initRes = await fetch(`${base}/api/user/init`, { method: 'POST', headers });
			if (initRes.status === 401) {
				await clearSessionAndGuestUI('Session expired — please sign in again');
				return;
			}
			if (initRes.ok) sessionStorage.setItem(initKey, '1');
		} catch {
			auth.update((s) => ({ ...s, apiUnreachable: true }));
		}
	}

	try {
		const res = await fetch(`${base}/api/user/credits`, { headers });
		if (res.status === 401) {
			await clearSessionAndGuestUI('Session expired — please sign in again');
			return;
		}
		const d = await parseJsonSafe(res);
		const cred = extractCredits(d);
		const merged = { ...baseUser };
		if (cred !== null) merged.credits = cred;
		auth.update((s) => ({
			...s,
			user: merged,
			apiUnreachable: false,
			ready: true
		}));
		try {
			const cached = JSON.parse(localStorage.getItem('sl_user_cache') || '{}') as Record<string, unknown>;
			cached.credits = merged.credits;
			cached.id = userId;
			cached.name = merged.name;
			cached.avatar = merged.avatarUrl;
			cached.email = merged.email;
			localStorage.setItem('sl_user_cache', JSON.stringify(cached));
		} catch {
			/* ignore */
		}
	} catch {
		auth.update((s) => ({
			...s,
			user: { ...baseUser, credits: 'Error' },
			apiUnreachable: true,
			ready: true
		}));
	}
}

// # FN syncAuthSessionAndCreditsToUi
// # AR Sync Supabase session + credits into the auth store
// # KW نقاط,credits,billing,خصم,مصادقة,auth,JWT,supabase
export async function syncAuthSessionAndCreditsToUi(): Promise<void> {
	if (!browser) return;
	const supa = getSupabase();
	if (!supa) {
		auth.update((s) => ({ ...s, ready: true, user: null, session: null }));
		return;
	}

	let {
		data: { session }
	} = await supa.auth.getSession();

	if (!session) {
		const cachedToken = localStorage.getItem('token');
		const cachedSub = cachedToken ? parseJwtSub(cachedToken) : null;
		if (cachedToken && cachedSub) {
			session = {
				access_token: cachedToken,
				user: { id: cachedSub, user_metadata: {}, email: '' }
			} as Session;
		}
	}

	if (!session) {
		auth.set({ ready: true, session: null, user: null, apiUnreachable: false });
		return;
	}

	if (typeof location !== 'undefined' && location.hash.includes('access_token')) {
		try {
			history.replaceState(null, '', location.pathname + location.search);
		} catch {
			/* ignore */
		}
	}

	localStorage.setItem('token', session.access_token);
	const baseUser = buildMenuUserProfileFromSupabaseUser(session.user);
	if (baseUser) {
		try {
			const cached = JSON.parse(localStorage.getItem('sl_user_cache') || '{}') as {
				name?: string;
				avatar?: string;
			};
			if (cached.name) baseUser.name = cached.name;
			if (cached.avatar) baseUser.avatarUrl = cached.avatar;
		} catch {
			/* ignore */
		}
		auth.update((s) => ({ ...s, session, user: baseUser }));
	}

	if (baseUser) await fetchCreditsForSession(session, baseUser);
	else auth.update((s) => ({ ...s, ready: true, session }));
}

// # FN refreshUserCreditsInMenu
// # AR Refresh credit balance after jobs
// # KW نقاط,credits,billing,خصم
export async function refreshUserCreditsInMenu(): Promise<number | null> {
	const state = get(auth);
	const session = state.session;
	if (!session?.access_token || !state.user) {
		await syncAuthSessionAndCreditsToUi();
		return null;
	}
	await fetchCreditsForSession(session, state.user);
	const next = get(auth).user?.credits;
	return typeof next === 'number' ? next : null;
}

// # FN checkApiConnection
// # AR Probe /api/status for connection badge
// # KW حالة,status
export async function checkApiConnection(): Promise<void> {
	if (!browser) return;
	try {
		const res = await fetch(`${apiBase()}/api/status`, { method: 'GET' });
		auth.update((s) => ({ ...s, apiUnreachable: !res.ok }));
		if (res.ok) {
			document.documentElement.classList.remove('api-unreachable');
		} else {
			document.documentElement.classList.add('api-unreachable');
		}
	} catch {
		auth.update((s) => ({ ...s, apiUnreachable: true }));
		document.documentElement.classList.add('api-unreachable');
	}
}

export function getDefaultAvatar(): string {
	return DEFAULT_MENU_AVATAR;
}
