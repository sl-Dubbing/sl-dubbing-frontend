// # FILE frontend/sl-dubbing-frontend-main/js/languages.js
// # AR JavaScript — languages
// # KW لغة,language
// # CONVENTION — FN/AR/KW + # block كل ~6 أسطر — FUNCTION_INDEX.md DOMAIN_INDEX.md
// js/languages.js — ElevenLabs-synced languages (fallback + live GET /api/languages)
// Display order = global web convention: English name A–Z (localeCompare 'en'),
// with stable regional-variant priority inside each language family.
// After load, syncLanguagesFromElevenLabs() replaces window.LANGUAGES when API responds.
(function (global) {
  'use strict';

  /** Preferred locale rank inside a language family (lower = earlier). */
  const LOCALE_PRIORITY = {
    ar: { ar: 0, 'ar-sa': 1, 'ar-ae': 2 },
    en: { 'en-us': 0, 'en-gb': 1, 'en-au': 2, 'en-ca': 3 },
    es: { 'es-es': 0, 'es-mx': 1 },
    fr: { 'fr-fr': 0, 'fr-ca': 1 },
    pt: { 'pt-br': 0, 'pt-pt': 1 },
  };

  // # FN compareLanguagesGlobal
  // # KW لغة,language,dialect
  /** Compare for global UI lists (A–Z English group/name + locale priority). */
  function compareLanguagesGlobal(a, b) {
    const ga = String(a?.group || a?.name_en || '').trim();
    const gb = String(b?.group || b?.name_en || '').trim();
    const byGroup = ga.localeCompare(gb, 'en', { sensitivity: 'base' });
    // # guard — رفض/خروج
    if (byGroup !== 0) return byGroup;

    const base = String(a?.base_lang || '').toLowerCase();
    // # block — فرع شرطي
    const map = LOCALE_PRIORITY[base];
    const pa = map && map[a?.code] != null ? map[a.code] : 50;
    const pb = map && map[b?.code] != null ? map[b.code] : 50;
    // # guard — رفض/خروج
    if (pa !== pb) return pa - pb;

    const byName = String(a?.name_en || '').localeCompare(String(b?.name_en || ''), 'en', {
      sensitivity: 'base',
    // # block — فرع شرطي
    });
    // # guard — رفض/خروج
    if (byName !== 0) return byName;
    return String(a?.code || '').localeCompare(String(b?.code || ''), 'en');
  }

  // # FN sortLanguagesGlobal
  // # KW لغة,language,dialect
  function sortLanguagesGlobal(list) {
    // # guard — رفض/خروج
    if (!Array.isArray(list)) return [];
    return list.slice().sort(compareLanguagesGlobal);
  }

  global.compareLanguagesGlobal = compareLanguagesGlobal;
  global.sortLanguagesGlobal = sortLanguagesGlobal;

  const FALLBACK_LANGUAGES = [
    { code: 'ar',    flag: '🇸🇦', name_en: 'Arabic',                 name_ar: 'العربية',               base_lang: 'ar', dialect: 'الفصحى',     category: 'ElevenLabs', popular: true,  supports_clone: true, group: 'Arabic' },
    { code: 'ar-sa', flag: '🇸🇦', name_en: 'Arabic (Saudi Arabia)',  name_ar: 'العربية السعودية',      base_lang: 'ar', dialect: 'السعودية',  category: 'ElevenLabs', popular: true,  supports_clone: true, group: 'Arabic' },
    { code: 'ar-ae', flag: '🇦🇪', name_en: 'Arabic (UAE)',           name_ar: 'العربية الإماراتية',    base_lang: 'ar', dialect: 'الإماراتية', category: 'ElevenLabs', popular: false, supports_clone: true, group: 'Arabic' },
    { code: 'bg',    flag: '🇧🇬', name_en: 'Bulgarian',              name_ar: 'البلغارية',             base_lang: 'bg', dialect: '', category: 'ElevenLabs', popular: false, supports_clone: true, group: 'Bulgarian' },
    { code: 'zh',    flag: '🇨🇳', name_en: 'Chinese',                name_ar: 'الصينية',               base_lang: 'zh', dialect: '', category: 'ElevenLabs', popular: true,  supports_clone: true, group: 'Chinese' },
    { code: 'hr',    flag: '🇭🇷', name_en: 'Croatian',               name_ar: 'الكرواتية',             base_lang: 'hr', dialect: '', category: 'ElevenLabs', popular: false, supports_clone: true, group: 'Croatian' },
    { code: 'cs',    flag: '🇨🇿', name_en: 'Czech',                  name_ar: 'التشيكية',              base_lang: 'cs', dialect: '', category: 'ElevenLabs', popular: false, supports_clone: true, group: 'Czech' },
    { code: 'da',    flag: '🇩🇰', name_en: 'Danish',                 name_ar: 'الدنماركية',            base_lang: 'da', dialect: '', category: 'ElevenLabs', popular: false, supports_clone: true, group: 'Danish' },
    { code: 'nl',    flag: '🇳🇱', name_en: 'Dutch',                  name_ar: 'الهولندية',             base_lang: 'nl', dialect: '', category: 'ElevenLabs', popular: false, supports_clone: true, group: 'Dutch' },
    { code: 'en-us', flag: '🇺🇸', name_en: 'English (USA)',          name_ar: 'الإنجليزية الأمريكية',  base_lang: 'en', dialect: 'American English (spoken)', category: 'ElevenLabs', popular: true,  supports_clone: true, group: 'English' },
    { code: 'en-gb', flag: '🇬🇧', name_en: 'English (UK)',           name_ar: 'الإنجليزية البريطانية', base_lang: 'en', dialect: 'British English (spoken)',  category: 'ElevenLabs', popular: true,  supports_clone: true, group: 'English' },
    { code: 'en-au', flag: '🇦🇺', name_en: 'English (Australia)',    name_ar: 'الإنجليزية الأسترالية', base_lang: 'en', dialect: 'Australian English (spoken)', category: 'ElevenLabs', popular: false, supports_clone: true, group: 'English' },
    { code: 'en-ca', flag: '🇨🇦', name_en: 'English (Canada)',       name_ar: 'الإنجليزية الكندية',    base_lang: 'en', dialect: 'Canadian English (spoken)', category: 'ElevenLabs', popular: false, supports_clone: true, group: 'English' },
    { code: 'fil',   flag: '🇵🇭', name_en: 'Filipino',               name_ar: 'الفلبينية',             base_lang: 'fil', dialect: '', category: 'ElevenLabs', popular: false, supports_clone: true, group: 'Filipino' },
    { code: 'fi',    flag: '🇫🇮', name_en: 'Finnish',                name_ar: 'الفنلندية',             base_lang: 'fi', dialect: '', category: 'ElevenLabs', popular: false, supports_clone: true, group: 'Finnish' },
    { code: 'fr-fr', flag: '🇫🇷', name_en: 'French (France)',        name_ar: 'الفرنسية (فرنسا)',      base_lang: 'fr', dialect: 'Parisian French (spoken)', category: 'ElevenLabs', popular: true,  supports_clone: true, group: 'French' },
    { code: 'fr-ca', flag: '🇨🇦', name_en: 'French (Canada)',        name_ar: 'الفرنسية (كندا)',       base_lang: 'fr', dialect: 'Canadian French (Québécois)', category: 'ElevenLabs', popular: false, supports_clone: true, group: 'French' },
    { code: 'de',    flag: '🇩🇪', name_en: 'German',                 name_ar: 'الألمانية',             base_lang: 'de', dialect: '', category: 'ElevenLabs', popular: true,  supports_clone: true, group: 'German' },
    { code: 'el',    flag: '🇬🇷', name_en: 'Greek',                  name_ar: 'اليونانية',             base_lang: 'el', dialect: '', category: 'ElevenLabs', popular: false, supports_clone: true, group: 'Greek' },
    { code: 'hu',    flag: '🇭🇺', name_en: 'Hungarian',              name_ar: 'المجرية',               base_lang: 'hu', dialect: '', category: 'ElevenLabs', popular: false, supports_clone: true, group: 'Hungarian' },
    { code: 'hi',    flag: '🇮🇳', name_en: 'Hindi',                  name_ar: 'الهندية',               base_lang: 'hi', dialect: '', category: 'ElevenLabs', popular: true,  supports_clone: true, group: 'Hindi' },
    { code: 'id',    flag: '🇮🇩', name_en: 'Indonesian',             name_ar: 'الإندونيسية',           base_lang: 'id', dialect: '', category: 'ElevenLabs', popular: false, supports_clone: true, group: 'Indonesian' },
    { code: 'it',    flag: '🇮🇹', name_en: 'Italian',                name_ar: 'الإيطالية',             base_lang: 'it', dialect: '', category: 'ElevenLabs', popular: true,  supports_clone: true, group: 'Italian' },
    { code: 'ja',    flag: '🇯🇵', name_en: 'Japanese',               name_ar: 'اليابانية',             base_lang: 'ja', dialect: '', category: 'ElevenLabs', popular: true,  supports_clone: true, group: 'Japanese' },
    { code: 'ko',    flag: '🇰🇷', name_en: 'Korean',                 name_ar: 'الكورية',               base_lang: 'ko', dialect: '', category: 'ElevenLabs', popular: true,  supports_clone: true, group: 'Korean' },
    { code: 'ms',    flag: '🇲🇾', name_en: 'Malay',                  name_ar: 'الماليزية',             base_lang: 'ms', dialect: '', category: 'ElevenLabs', popular: false, supports_clone: true, group: 'Malay' },
    { code: 'no',    flag: '🇳🇴', name_en: 'Norwegian',              name_ar: 'النرويجية',             base_lang: 'no', dialect: '', category: 'ElevenLabs', popular: false, supports_clone: true, group: 'Norwegian' },
    { code: 'pl',    flag: '🇵🇱', name_en: 'Polish',                 name_ar: 'البولندية',             base_lang: 'pl', dialect: '', category: 'ElevenLabs', popular: false, supports_clone: true, group: 'Polish' },
    { code: 'pt-br', flag: '🇧🇷', name_en: 'Portuguese (Brazil)',    name_ar: 'البرتغالية (البرازيل)', base_lang: 'pt', dialect: 'Brazilian Portuguese (spoken)', category: 'ElevenLabs', popular: true,  supports_clone: true, group: 'Portuguese' },
    { code: 'pt-pt', flag: '🇵🇹', name_en: 'Portuguese (Portugal)',  name_ar: 'البرتغالية (البرتغال)', base_lang: 'pt', dialect: 'European Portuguese (spoken)', category: 'ElevenLabs', popular: false, supports_clone: true, group: 'Portuguese' },
    { code: 'ro',    flag: '🇷🇴', name_en: 'Romanian',               name_ar: 'الرومانية',             base_lang: 'ro', dialect: '', category: 'ElevenLabs', popular: false, supports_clone: true, group: 'Romanian' },
    { code: 'ru',    flag: '🇷🇺', name_en: 'Russian',                name_ar: 'الروسية',               base_lang: 'ru', dialect: '', category: 'ElevenLabs', popular: true,  supports_clone: true, group: 'Russian' },
    { code: 'sk',    flag: '🇸🇰', name_en: 'Slovak',                 name_ar: 'السلوفاكية',            base_lang: 'sk', dialect: '', category: 'ElevenLabs', popular: false, supports_clone: true, group: 'Slovak' },
    { code: 'es-es', flag: '🇪🇸', name_en: 'Spanish (Spain)',        name_ar: 'الإسبانية (إسبانيا)',   base_lang: 'es', dialect: 'Castilian Spanish (Spain)', category: 'ElevenLabs', popular: true,  supports_clone: true, group: 'Spanish' },
    { code: 'es-mx', flag: '🇲🇽', name_en: 'Spanish (Mexico)',       name_ar: 'الإسبانية (المكسيك)',   base_lang: 'es', dialect: 'Mexican Spanish (spoken)', category: 'ElevenLabs', popular: true,  supports_clone: true, group: 'Spanish' },
    { code: 'sv',    flag: '🇸🇪', name_en: 'Swedish',                name_ar: 'السويدية',              base_lang: 'sv', dialect: '', category: 'ElevenLabs', popular: false, supports_clone: true, group: 'Swedish' },
    { code: 'ta',    flag: '🇮🇳', name_en: 'Tamil',                  name_ar: 'التاميلية',             base_lang: 'ta', dialect: '', category: 'ElevenLabs', popular: false, supports_clone: true, group: 'Tamil' },
    { code: 'tr',    flag: '🇹🇷', name_en: 'Turkish',                name_ar: 'التركية',               base_lang: 'tr', dialect: '', category: 'ElevenLabs', popular: true,  supports_clone: true, group: 'Turkish' },
    { code: 'uk',    flag: '🇺🇦', name_en: 'Ukrainian',              name_ar: 'الأوكرانية',            base_lang: 'uk', dialect: '', category: 'ElevenLabs', popular: false, supports_clone: true, group: 'Ukrainian' },
    { code: 'vi',    flag: '🇻🇳', name_en: 'Vietnamese',             name_ar: 'الفيتنامية',            base_lang: 'vi', dialect: '', category: 'ElevenLabs', popular: false, supports_clone: true, group: 'Vietnamese' },
  ];

  global.LANGUAGES = sortLanguagesGlobal(FALLBACK_LANGUAGES);
  global.SHARED_LANGUAGES = global.LANGUAGES;
  global.LANG_CATALOG_META = { source: 'fallback', model_id: 'eleven_flash_v2_5', synced: false };

  global.LANG_FLAG_COUNTRY = {
    ar: 'sa', bg: 'bg', zh: 'cn', hr: 'hr', cs: 'cz', da: 'dk', nl: 'nl',
    en: 'us', fil: 'ph', fi: 'fi', fr: 'fr', de: 'de', el: 'gr', hu: 'hu',
    hi: 'in', id: 'id', it: 'it', ja: 'jp', ko: 'kr', ms: 'my', no: 'no',
    pl: 'pl', pt: 'pt', ro: 'ro', ru: 'ru', sk: 'sk', es: 'es', sv: 'se',
    ta: 'in', tr: 'tr', uk: 'ua', vi: 'vn',
  };

  // # FN buildLanguageDropdown
  // # AR اللغات واللهجات (buildLanguageDropdown)
  // # KW لغة,language,dialect
  function buildLanguageDropdown(selectEl, selectedCode = 'ar') {
    // # guard — رفض/خروج
    if (!selectEl || !global.LANGUAGES) return;
    selectEl.innerHTML = '';
    global.LANGUAGES.forEach((lang) => {
      const opt = document.createElement('option');
      opt.value = lang.code;
      // # block — فرع شرطي
      opt.textContent = `${lang.flag} ${lang.name_en}`;
      // # شرط
      if (lang.code === selectedCode) opt.selected = true;
      selectEl.appendChild(opt);
    });
  }
  global.buildLanguageDropdown = buildLanguageDropdown;

  global.getLanguageConfig = function (code) {
    const lang = global.LANGUAGES.find((l) => l.code === code);
    if (!lang) return null;
    return {
      target_language: lang.base_lang,
      dialect: lang.dialect || '',
      display_name: lang.name_en,
      display_name_ar: lang.name_ar,
      flag: lang.flag,
      category: lang.category || 'ElevenLabs',
      supports_clone: !!lang.supports_clone,
      is_arabic_dialect: lang.base_lang === 'ar' && lang.code !== 'ar',
      is_msa: lang.code === 'ar',
    };
  };

  global.getLanguagesByCategory = function () {
    const groups = {};
    for (const lang of global.LANGUAGES) {
      const cat = lang.group || lang.category || 'ElevenLabs';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(lang);
    }
    return groups;
  };

  global.getArabicDialects = function () {
    return global.LANGUAGES.filter((l) => l.base_lang === 'ar' && l.code !== 'ar');
  };

  global.getCloneableLanguages = function () {
    return global.LANGUAGES.filter((l) => l.supports_clone);
  };

  // # FN _apiBase
  // # AR اللغات واللهجات (_apiBase)
  // # KW لغة,language,dialect
  function _apiBase() {
    const base = (global.APP_CONFIG && global.APP_CONFIG.API_BASE) || '';
    return String(base).replace(/\/$/, '');
  }

  // # FN _normalizeRemoteLang
  // # AR اللغات واللهجات (_normalizeRemoteLang)
  // # KW لغة,language,dialect
  function _normalizeRemoteLang(l) {
    const base = (l.base_lang || (l.code || '').split('-')[0] || '').toLowerCase();
    const nameEn = l.name_en || l.name || l.code;
    return {
      code: l.code,
      flag: l.flag || '🏳️',
      // # block — إرجاع نتيجة
      name_en: nameEn,
      name_ar: l.name_ar || nameEn,
      base_lang: base,
      dialect: l.dialect || '',
      category: l.category || 'ElevenLabs',
      popular: !!l.popular,
      // # block — معالجة صوت/استنساخ
      supports_clone: l.supports_clone !== false,
      group: l.group || (nameEn.includes('(') ? nameEn.split('(')[0].trim() : nameEn),
    };
  }

  /** Pull live catalog from backend (which syncs ElevenLabs /v1/models). */
  // # FN syncLanguagesFromElevenLabs
  // # AR اللغات واللهجات (syncLanguagesFromElevenLabs)
  // # KW لغة,language,dialect
  async function syncLanguagesFromElevenLabs(options) {
    const opts = options || {};
    const qs = opts.refresh ? '?refresh=1' : '';
    const url = `${_apiBase()}/api/languages${qs}`;
    // # try — عملية قد تفشل
    try {
      // # HTTP — طلب API
      const res = await fetch(url, { credentials: 'omit', cache: 'no-store' });
      // # guard — رفض/خروج
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      // # guard — رفض/خروج
      if (!data || !Array.isArray(data.languages) || !data.languages.length) {
        throw new Error('empty languages');
      }
      global.LANGUAGES = sortLanguagesGlobal(data.languages.map(_normalizeRemoteLang));
      // # block — parse/serialize JSON
      global.SHARED_LANGUAGES = global.LANGUAGES;
      // # شرط
      if (data.flag_country && typeof data.flag_country === 'object') {
        global.LANG_FLAG_COUNTRY = Object.assign({}, global.LANG_FLAG_COUNTRY, data.flag_country);
      }
      global.LANG_CATALOG_META = {
        source: data.source || 'elevenlabs',
        // # block — معالجة أخطاء
        model_id: data.model_id || '',
        count: data.count || global.LANGUAGES.length,
        synced: true,
        synced_at: data.synced_at || Date.now(),
      };
      global.dispatchEvent?.(new CustomEvent('glotix:languages-ready', { detail: global.LANG_CATALOG_META }));
      // # block — تنفيذ منطق — راجع الأسطر التالية
      document.dispatchEvent(new CustomEvent('glotix:languages-ready', { detail: global.LANG_CATALOG_META }));
      return global.LANGUAGES;
    } catch (err) {
      console.warn('[languages] ElevenLabs sync skipped — using fallback:', err);
      global.LANG_CATALOG_META = { source: 'fallback', model_id: 'eleven_flash_v2_5', synced: false };
      document.dispatchEvent(new CustomEvent('glotix:languages-ready', { detail: global.LANG_CATALOG_META }));
      // # block — معالجة أخطاء
      return global.LANGUAGES;
    }
  }
  global.syncLanguagesFromElevenLabs = syncLanguagesFromElevenLabs;

  // Kick off sync as soon as config is available (or immediately if already set)
  // # FN _bootSync
  // # AR اللغات واللهجات (_bootSync)
  // # KW لغة,language,dialect
  function _bootSync() {
    syncLanguagesFromElevenLabs();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _bootSync);
  } else {
    _bootSync();
  }
})(typeof window !== 'undefined' ? window : globalThis);
