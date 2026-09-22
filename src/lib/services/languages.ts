// # FILE frontend/sl-dubbing-frontend-main/src/lib/services/languages.ts
// # AR Typed language catalog with backend sync and stable A-Z sorting
// # KW لغة,language,dialect

import { apiFetch, parseJsonSafe } from '$lib/services/api';

export type Language = {
	code: string;
	flag: string;
	name_en: string;
	name_ar?: string;
	base_lang: string;
	dialect?: string;
	popular?: boolean;
	supports_clone?: boolean;
	group?: string;
};

const FALLBACK: Language[] = [
	['ar', '🇸🇦', 'Arabic', 'ar', 'Modern Standard Arabic'],
	['ar-sa', '🇸🇦', 'Arabic (Saudi Arabia)', 'ar', 'Saudi Arabic'],
	['ar-ae', '🇦🇪', 'Arabic (UAE)', 'ar', 'Emirati Arabic'],
	['ar-eg', '🇪🇬', 'Arabic (Egypt)', 'ar', 'Egyptian Arabic'],
	['ar-ma', '🇲🇦', 'Arabic (Morocco)', 'ar', 'Moroccan Arabic'],
	['ar-dz', '🇩🇿', 'Arabic (Algeria)', 'ar', 'Algerian Arabic'],
	['ar-tn', '🇹🇳', 'Arabic (Tunisia)', 'ar', 'Tunisian Arabic'],
	['ar-iq', '🇮🇶', 'Arabic (Iraq)', 'ar', 'Iraqi Arabic'],
	['ar-jo', '🇯🇴', 'Arabic (Jordan)', 'ar', 'Jordanian Arabic'],
	['ar-lb', '🇱🇧', 'Arabic (Lebanon)', 'ar', 'Lebanese Arabic'],
	['ar-kw', '🇰🇼', 'Arabic (Kuwait)', 'ar', 'Kuwaiti Arabic'],
	['ar-qa', '🇶🇦', 'Arabic (Qatar)', 'ar', 'Qatari Arabic'],
	['ar-bh', '🇧🇭', 'Arabic (Bahrain)', 'ar', 'Bahraini Arabic'],
	['bg', '🇧🇬', 'Bulgarian', 'bg', ''],
	['zh', '🇨🇳', 'Chinese', 'zh', ''],
	['hr', '🇭🇷', 'Croatian', 'hr', ''],
	['cs', '🇨🇿', 'Czech', 'cs', ''],
	['da', '🇩🇰', 'Danish', 'da', ''],
	['nl', '🇳🇱', 'Dutch', 'nl', ''],
	['en-us', '🇺🇸', 'English (USA)', 'en', 'American English'],
	['en-gb', '🇬🇧', 'English (UK)', 'en', 'British English'],
	['en-au', '🇦🇺', 'English (Australia)', 'en', 'Australian English'],
	['fil', '🇵🇭', 'Filipino', 'fil', ''],
	['fi', '🇫🇮', 'Finnish', 'fi', ''],
	['fr-fr', '🇫🇷', 'French (France)', 'fr', 'Parisian French'],
	['fr-ca', '🇨🇦', 'French (Canada)', 'fr', 'Canadian French'],
	['de', '🇩🇪', 'German', 'de', ''],
	['el', '🇬🇷', 'Greek', 'el', ''],
	['hi', '🇮🇳', 'Hindi', 'hi', ''],
	['hu', '🇭🇺', 'Hungarian', 'hu', ''],
	['id', '🇮🇩', 'Indonesian', 'id', ''],
	['it', '🇮🇹', 'Italian', 'it', ''],
	['ja', '🇯🇵', 'Japanese', 'ja', ''],
	['ko', '🇰🇷', 'Korean', 'ko', ''],
	['ms', '🇲🇾', 'Malay', 'ms', ''],
	['no', '🇳🇴', 'Norwegian', 'no', ''],
	['pl', '🇵🇱', 'Polish', 'pl', ''],
	['pt-br', '🇧🇷', 'Portuguese (Brazil)', 'pt', 'Brazilian Portuguese'],
	['pt-pt', '🇵🇹', 'Portuguese (Portugal)', 'pt', 'European Portuguese'],
	['ro', '🇷🇴', 'Romanian', 'ro', ''],
	['ru', '🇷🇺', 'Russian', 'ru', ''],
	['sk', '🇸🇰', 'Slovak', 'sk', ''],
	['es-es', '🇪🇸', 'Spanish (Spain)', 'es', 'Castilian Spanish'],
	['es-mx', '🇲🇽', 'Spanish (Mexico)', 'es', 'Mexican Spanish'],
	['es-ar', '🇦🇷', 'Spanish (Argentina)', 'es', 'Rioplatense Spanish'],
	['es-co', '🇨🇴', 'Spanish (Colombia)', 'es', 'Colombian Spanish'],
	['sv', '🇸🇪', 'Swedish', 'sv', ''],
	['ta', '🇮🇳', 'Tamil', 'ta', ''],
	['th', '🇹🇭', 'Thai', 'th', ''],
	['tr', '🇹🇷', 'Turkish', 'tr', ''],
	['uk', '🇺🇦', 'Ukrainian', 'uk', ''],
	['ur', '🇵🇰', 'Urdu', 'ur', ''],
	['vi', '🇻🇳', 'Vietnamese', 'vi', ''],
	['he', '🇮🇱', 'Hebrew', 'he', ''],
	['fa', '🇮🇷', 'Persian', 'fa', ''],
	['bn', '🇧🇩', 'Bengali', 'bn', ''],
	['sw', '🇰🇪', 'Swahili', 'sw', '']
].map(([code, flag, name_en, base_lang, dialect]) => ({
	code,
	flag,
	name_en,
	base_lang,
	dialect,
	supports_clone: true,
	group: name_en.split(' (')[0]
}));

// # FN compareLanguagesGlobal
// # AR Sort language names A-Z with stable locale order
// # KW لغة,language,dialect
export function compareLanguagesGlobal(a: Language, b: Language): number {
	const group = (a.group || a.name_en).localeCompare(b.group || b.name_en, 'en', {
		sensitivity: 'base'
	});
	if (group !== 0) return group;
	return a.name_en.localeCompare(b.name_en, 'en', { sensitivity: 'base' });
}

export const fallbackLanguages = FALLBACK.slice().sort(compareLanguagesGlobal);

function normalizeRemoteLanguage(raw: Partial<Language>): Language | null {
	if (!raw.code) return null;
	const name = raw.name_en || raw.code;
	return {
		code: raw.code,
		flag: raw.flag || '🏳️',
		name_en: name,
		name_ar: raw.name_ar || name,
		base_lang: raw.base_lang || raw.code.split('-')[0],
		dialect: raw.dialect || '',
		popular: !!raw.popular,
		supports_clone: raw.supports_clone !== false,
		group: raw.group || name.split(' (')[0]
	};
}

// # FN syncLanguagesFromElevenLabs
// # AR Fetch live backend language catalog and fall back locally
// # KW لغة,language,dialect
export async function loadLanguages(): Promise<Language[]> {
	try {
		const res = await apiFetch('/api/languages', { auth: false, cache: 'no-store' });
		const data = await parseJsonSafe<{ languages?: Partial<Language>[] }>(res);
		const languages = (data?.languages || [])
			.map(normalizeRemoteLanguage)
			.filter((item): item is Language => !!item)
			.sort(compareLanguagesGlobal);
		return languages.length ? languages : fallbackLanguages;
	} catch {
		return fallbackLanguages;
	}
}

export function findLanguage(list: Language[], code: string): Language | undefined {
	return list.find((item) => item.code === code);
}
