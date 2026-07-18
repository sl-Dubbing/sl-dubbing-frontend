// # FILE frontend/sl-dubbing-frontend-main/src/lib/services/supabase.ts
// # AR Singleton Supabase browser client (PKCE)

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { browser } from '$app/environment';
import { appConfig } from '$lib/config';

let client: SupabaseClient | null = null;

// # FN getSupabase
// # AR Return singleton Supabase client or null off-browser / misconfigured
// # KW مصادقة,auth,JWT,supabase
export function getSupabase(): SupabaseClient | null {
	if (!browser) return null;
	if (client) return client;
	const url = appConfig.SUPABASE_URL;
	const key = appConfig.SUPABASE_KEY;
	if (!url || !key) {
		console.error('[shared] PUBLIC_SUPABASE_URL and PUBLIC_SUPABASE_KEY are required');
		return null;
	}
	client = createClient(url, key, {
		auth: {
			flowType: 'pkce',
			detectSessionInUrl: true,
			persistSession: true
		}
	});
	return client;
}
