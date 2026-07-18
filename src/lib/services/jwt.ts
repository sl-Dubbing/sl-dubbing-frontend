// # FILE frontend/sl-dubbing-frontend-main/src/lib/services/jwt.ts
// # AR JWT helpers for X-User-Id header

// # FN decodeJwtPayloadPartToUtf8
// # AR Decode base64url JWT payload as UTF-8
// # KW مصادقة,auth,JWT,supabase
export function decodeJwtPayloadPartToUtf8(b64: string): string {
	let b64norm = b64.replace(/-/g, '+').replace(/_/g, '/');
	while (b64norm.length % 4) b64norm += '=';
	const binary = atob(b64norm);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
	if (typeof TextDecoder !== 'undefined') {
		return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
	}
	return binary;
}

// # FN parseJwtSub
// # AR Extract sub claim from access token
// # KW مصادقة,auth,JWT,supabase
export function parseJwtSub(token: string | null | undefined): string | null {
	if (!token || typeof token !== 'string') return null;
	try {
		const parts = token.split('.');
		if (parts.length < 2) return null;
		const payload = JSON.parse(decodeJwtPayloadPartToUtf8(parts[1])) as { sub?: string };
		return payload.sub ? String(payload.sub) : null;
	} catch {
		return null;
	}
}
