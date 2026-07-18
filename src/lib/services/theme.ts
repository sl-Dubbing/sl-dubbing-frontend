// # FILE frontend/sl-dubbing-frontend-main/src/lib/services/theme.ts
// # AR Light/dark theme helpers (legacy GlotixTheme)

const STORAGE_KEY = 'glotix_theme';

// # FN resolvePreferredTheme
// # AR Resolve system / light / dark preference
// # KW عام,general
export function resolvePreferredTheme(): 'light' | 'dark' {
	let mode = 'system';
	try {
		mode = localStorage.getItem(STORAGE_KEY) || 'system';
	} catch {
		/* ignore */
	}
	if (mode === 'light' || mode === 'dark') return mode;
	return typeof window !== 'undefined' &&
		window.matchMedia &&
		window.matchMedia('(prefers-color-scheme: dark)').matches
		? 'dark'
		: 'light';
}

// # FN applyThemeMode
// # AR Apply theme to <html data-theme>
// # KW عام,general
export function applyThemeMode(mode: string): 'light' | 'dark' {
	const root = document.documentElement;
	const resolved = mode === 'light' || mode === 'dark' ? mode : resolvePreferredTheme();
	root.setAttribute('data-theme', resolved);
	root.style.colorScheme = resolved;
	return resolved;
}

// # FN initThemeFromStorage
// # AR Boot theme from localStorage
// # KW عام,general
export function initThemeFromStorage(): void {
	let stored = 'system';
	try {
		stored = localStorage.getItem(STORAGE_KEY) || 'system';
	} catch {
		/* ignore */
	}
	if (stored === 'light' || stored === 'dark') {
		applyThemeMode(stored);
	} else {
		const auto = resolvePreferredTheme();
		document.documentElement.setAttribute('data-theme', auto);
		document.documentElement.style.colorScheme = auto;
	}
}

// # FN cycleThemeMode
// # AR Toggle light ↔ dark
// # KW عام,general
export function cycleThemeMode(): { mode: 'light' | 'dark'; applied: 'light' | 'dark' } {
	const current =
		(document.documentElement.getAttribute('data-theme') as 'light' | 'dark' | null) ||
		resolvePreferredTheme();
	const next = current === 'dark' ? 'light' : 'dark';
	try {
		localStorage.setItem(STORAGE_KEY, next);
	} catch {
		/* ignore */
	}
	applyThemeMode(next);
	return { mode: next, applied: next };
}
