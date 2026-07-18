// # FILE frontend/sl-dubbing-frontend-main/src/lib/config.ts
// # AR App runtime config from PUBLIC_* env (mirrors legacy js/config.js)

import { browser } from '$app/environment';
import {
	PUBLIC_API_BASE,
	PUBLIC_DUB_USE_SSE,
	PUBLIC_SUPABASE_KEY,
	PUBLIC_SUPABASE_URL,
	PUBLIC_USE_GO_GATEWAY,
	PUBLIC_VOICE_CLONE_CREDIT_COST
} from '$env/static/public';

export type AppConfig = {
	USE_GO_GATEWAY: boolean;
	API_BASE: string;
	SUPABASE_URL: string;
	SUPABASE_KEY: string;
	DUB_USE_SSE: boolean;
	VOICE_CLONE_CREDIT_COST: number;
};

function asBool(v: string | undefined, fallback = false): boolean {
	if (v == null || v === '') return fallback;
	return v === 'true' || v === '1';
}

const DEFAULT_API_BASE = 'https://glotix-api-production.up.railway.app';
const DEFAULT_SUPABASE_URL = 'https://ckjkkxrlgisjdolwddfg.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY =
	'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNramtreHJsZ2lzamRvbHdkZGZnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0NjU0OTUsImV4cCI6MjA5MzA0MTQ5NX0.F-4TbmO6_7plPm8NBr_6djCv6gtEPpWFw9J7m8vTs6M';

export const appConfig: AppConfig = {
	USE_GO_GATEWAY: asBool(PUBLIC_USE_GO_GATEWAY, false),
	API_BASE: PUBLIC_API_BASE || DEFAULT_API_BASE,
	SUPABASE_URL: PUBLIC_SUPABASE_URL || DEFAULT_SUPABASE_URL,
	SUPABASE_KEY: PUBLIC_SUPABASE_KEY || DEFAULT_SUPABASE_ANON_KEY,
	DUB_USE_SSE: asBool(PUBLIC_DUB_USE_SSE, true),
	VOICE_CLONE_CREDIT_COST: Number(PUBLIC_VOICE_CLONE_CREDIT_COST || 100) || 100
};

// # FN normalizeApiBaseUrl
// # AR Normalize API base; empty / Go gateway → current origin
// # KW عام,general
export function normalizeApiBaseUrl(): string {
	const raw = appConfig.API_BASE;
	if (raw === '' || appConfig.USE_GO_GATEWAY) {
		if (browser && typeof location !== 'undefined') {
			return String(location.origin || '').replace(/\/$/, '');
		}
		return '';
	}
	return String(raw || DEFAULT_API_BASE)
		.replace(/\/$/, '')
		.replace(/([^:]\/)\/+/g, '$1');
}

export const DEFAULT_MENU_AVATAR =
	'https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y';
