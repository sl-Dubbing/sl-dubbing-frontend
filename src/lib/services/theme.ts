// # FILE frontend/sl-dubbing-frontend-main/src/lib/services/theme.ts
// # AR Light/dark theme helpers

const KEY = 'glotix_theme';

function storedMode(): string {
	try { return localStorage.getItem(KEY) || 'system'; } catch { return 'system'; }
}

function systemPrefersDark(): boolean {
	return typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches;
}

export function resolvePreferredTheme(): 'light' | 'dark' {
	const mode = storedMode();
	if (mode === 'light' || mode === 'dark') return mode;
	return systemPrefersDark() ? 'dark' : 'light';
}

export function applyThemeMode(mode: string): 'light' | 'dark' {
	const resolved = mode === 'light' || mode === 'dark' ? mode : resolvePreferredTheme();
	const root = document.documentElement;
	root.setAttribute('data-theme', resolved);
	root.style.colorScheme = resolved;
	return resolved;
}

export const initThemeFromStorage = () => applyThemeMode(storedMode());

export function cycleThemeMode(): 'light' | 'dark' {
	const next = resolvePreferredTheme() === 'dark' ? 'light' : 'dark';
	try { localStorage.setItem(KEY, next); } catch { /* ignore */ }
	return applyThemeMode(next);
}
