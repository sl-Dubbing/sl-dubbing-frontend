// js/languages.js — Glotix Dubbing Supported Languages (V2.0)
// ─────────────────────────────────────────────────────────────────────
// Single source of truth — replaces both old languages.js + languages-data.js
//
// Each entry:
//   code             - unique identifier (used for UI selection + localStorage)
//   flag             - emoji flag
//   name_en          - English display name (UI shows this)
//   name_ar          - Arabic name (kept for Arabic-keyword search support)
//   base_lang        - sent as `target_language` to /dub API (e.g. "ar", "en")
//   dialect          - sent as `dialect` to /dub API (Arabic-only; empty for non-Arabic)
//   category         - "Arabic" | "European" | "Asian" | "African" | "Indian" | "Americas"
//   popular          - shown at top of list
//   supports_clone   - true if F5-TTS or XTTS can clone voices for this language
//
// Categories help the future UI group items. lang-picker.js currently
// ignores category — adding it now costs nothing and is forward-compatible.
// ─────────────────────────────────────────────────────────────────────

window.LANGUAGES = [
    // ═════════════════════════════════════════════════════════════════
    // 🌍 ARABIC — Modern Standard + 18 dialects
    // ═════════════════════════════════════════════════════════════════
    // For narration / news / formal voiceovers
    { code: 'ar',       flag: '🌍', name_en: 'Arabic (Standard/MSA)',  name_ar: 'العربية الفصحى',        base_lang: 'ar', dialect: 'الفصحى',     category: 'Arabic', popular: true,  supports_clone: true,
      note: 'Modern Standard Arabic — for narration, news, documentaries, formal voiceovers' },

    // Gulf dialects
    { code: 'ar-sa',    flag: '🇸🇦', name_en: 'Arabic (Saudi)',         name_ar: 'العربية (السعودية)',    base_lang: 'ar', dialect: 'السعودية',    category: 'Arabic', popular: true,  supports_clone: true },
    { code: 'ar-ae',    flag: '🇦🇪', name_en: 'Arabic (Emirati)',       name_ar: 'العربية (الإمارات)',    base_lang: 'ar', dialect: 'الإماراتية',   category: 'Arabic', popular: true,  supports_clone: true },
    { code: 'ar-kw',    flag: '🇰🇼', name_en: 'Arabic (Kuwaiti)',       name_ar: 'العربية (الكويت)',     base_lang: 'ar', dialect: 'الكويتية',    category: 'Arabic', popular: false, supports_clone: true },
    { code: 'ar-qa',    flag: '🇶🇦', name_en: 'Arabic (Qatari)',        name_ar: 'العربية (قطر)',        base_lang: 'ar', dialect: 'القطرية',     category: 'Arabic', popular: false, supports_clone: true },
    { code: 'ar-bh',    flag: '🇧🇭', name_en: 'Arabic (Bahraini)',      name_ar: 'العربية (البحرين)',    base_lang: 'ar', dialect: 'البحرينية',   category: 'Arabic', popular: false, supports_clone: true },
    { code: 'ar-om',    flag: '🇴🇲', name_en: 'Arabic (Omani)',         name_ar: 'العربية (عُمان)',       base_lang: 'ar', dialect: 'العمانية',    category: 'Arabic', popular: false, supports_clone: true },
    { code: 'ar-ye',    flag: '🇾🇪', name_en: 'Arabic (Yemeni)',        name_ar: 'العربية (اليمن)',      base_lang: 'ar', dialect: 'اليمنية',     category: 'Arabic', popular: false, supports_clone: true },

    // Egyptian / Sudanese
    { code: 'ar-eg',    flag: '🇪🇬', name_en: 'Arabic (Egyptian)',      name_ar: 'العربية (مصر)',        base_lang: 'ar', dialect: 'المصرية',     category: 'Arabic', popular: true,  supports_clone: true,
      note: 'Most widely understood Arabic dialect — common for entertainment dubbing' },
    { code: 'ar-sd',    flag: '🇸🇩', name_en: 'Arabic (Sudanese)',      name_ar: 'العربية (السودان)',    base_lang: 'ar', dialect: 'السودانية',   category: 'Arabic', popular: false, supports_clone: true },

    // Levantine
    { code: 'ar-lb',    flag: '🇱🇧', name_en: 'Arabic (Lebanese)',      name_ar: 'العربية (لبنان)',      base_lang: 'ar', dialect: 'اللبنانية',   category: 'Arabic', popular: true,  supports_clone: true },
    { code: 'ar-sy',    flag: '🇸🇾', name_en: 'Arabic (Syrian)',        name_ar: 'العربية (سوريا)',      base_lang: 'ar', dialect: 'السورية',     category: 'Arabic', popular: false, supports_clone: true },
    { code: 'ar-jo',    flag: '🇯🇴', name_en: 'Arabic (Jordanian)',     name_ar: 'العربية (الأردن)',     base_lang: 'ar', dialect: 'الأردنية',    category: 'Arabic', popular: false, supports_clone: true },
    { code: 'ar-ps',    flag: '🇵🇸', name_en: 'Arabic (Palestinian)',   name_ar: 'العربية (فلسطين)',     base_lang: 'ar', dialect: 'الفلسطينية',  category: 'Arabic', popular: false, supports_clone: true },

    // Iraqi
    { code: 'ar-iq',    flag: '🇮🇶', name_en: 'Arabic (Iraqi)',         name_ar: 'العربية (العراق)',     base_lang: 'ar', dialect: 'العراقية',    category: 'Arabic', popular: true,  supports_clone: true },

    // Maghrebi
    { code: 'ar-ma',    flag: '🇲🇦', name_en: 'Arabic (Moroccan)',      name_ar: 'العربية (المغرب)',     base_lang: 'ar', dialect: 'المغربية',    category: 'Arabic', popular: false, supports_clone: true },
    { code: 'ar-dz',    flag: '🇩🇿', name_en: 'Arabic (Algerian)',      name_ar: 'العربية (الجزائر)',    base_lang: 'ar', dialect: 'الجزائرية',   category: 'Arabic', popular: false, supports_clone: true },
    { code: 'ar-tn',    flag: '🇹🇳', name_en: 'Arabic (Tunisian)',      name_ar: 'العربية (تونس)',       base_lang: 'ar', dialect: 'التونسية',    category: 'Arabic', popular: false, supports_clone: true },
    { code: 'ar-ly',    flag: '🇱🇾', name_en: 'Arabic (Libyan)',        name_ar: 'العربية (ليبيا)',      base_lang: 'ar', dialect: 'الليبية',     category: 'Arabic', popular: false, supports_clone: true },

    // ═════════════════════════════════════════════════════════════════
    // 🇬🇧 ENGLISH — 5 regional variants
    // ═════════════════════════════════════════════════════════════════
    { code: 'en-us',    flag: '🇺🇸', name_en: 'English (US)',           name_ar: 'الإنجليزية (أمريكا)',   base_lang: 'en', dialect: '', category: 'European', popular: true,  supports_clone: true },
    { code: 'en-gb',    flag: '🇬🇧', name_en: 'English (UK)',           name_ar: 'الإنجليزية (بريطانيا)', base_lang: 'en', dialect: '', category: 'European', popular: true,  supports_clone: true },
    { code: 'en-au',    flag: '🇦🇺', name_en: 'English (Australia)',    name_ar: 'الإنجليزية (أستراليا)', base_lang: 'en', dialect: '', category: 'European', popular: false, supports_clone: true },
    { code: 'en-ca',    flag: '🇨🇦', name_en: 'English (Canada)',       name_ar: 'الإنجليزية (كندا)',    base_lang: 'en', dialect: '', category: 'European', popular: false, supports_clone: true },
    { code: 'en-in',    flag: '🇮🇳', name_en: 'English (India)',        name_ar: 'الإنجليزية (الهند)',    base_lang: 'en', dialect: '', category: 'European', popular: false, supports_clone: true },

    // ═════════════════════════════════════════════════════════════════
    // 🇪🇸 SPANISH
    // ═════════════════════════════════════════════════════════════════
    { code: 'es-es',    flag: '🇪🇸', name_en: 'Spanish (Spain)',        name_ar: 'الإسبانية (إسبانيا)',  base_lang: 'es', dialect: '', category: 'European', popular: true,  supports_clone: true },
    { code: 'es-mx',    flag: '🇲🇽', name_en: 'Spanish (Mexico)',       name_ar: 'الإسبانية (المكسيك)',  base_lang: 'es', dialect: '', category: 'Americas', popular: true,  supports_clone: true },
    { code: 'es-ar',    flag: '🇦🇷', name_en: 'Spanish (Argentina)',    name_ar: 'الإسبانية (الأرجنتين)',base_lang: 'es', dialect: '', category: 'Americas', popular: false, supports_clone: true },
    { code: 'es-co',    flag: '🇨🇴', name_en: 'Spanish (Colombia)',     name_ar: 'الإسبانية (كولومبيا)', base_lang: 'es', dialect: '', category: 'Americas', popular: false, supports_clone: true },

    // ═════════════════════════════════════════════════════════════════
    // 🇫🇷 FRENCH
    // ═════════════════════════════════════════════════════════════════
    { code: 'fr-fr',    flag: '🇫🇷', name_en: 'French (France)',        name_ar: 'الفرنسية (فرنسا)',     base_lang: 'fr', dialect: '', category: 'European', popular: true,  supports_clone: true },
    { code: 'fr-ca',    flag: '🇨🇦', name_en: 'French (Canada)',        name_ar: 'الفرنسية (كندا)',      base_lang: 'fr', dialect: '', category: 'Americas', popular: false, supports_clone: true },
    { code: 'fr-be',    flag: '🇧🇪', name_en: 'French (Belgium)',       name_ar: 'الفرنسية (بلجيكا)',    base_lang: 'fr', dialect: '', category: 'European', popular: false, supports_clone: true },

    // ═════════════════════════════════════════════════════════════════
    // 🇵🇹 PORTUGUESE
    // ═════════════════════════════════════════════════════════════════
    { code: 'pt-br',    flag: '🇧🇷', name_en: 'Portuguese (Brazil)',    name_ar: 'البرتغالية (البرازيل)', base_lang: 'pt', dialect: '', category: 'Americas', popular: true,  supports_clone: true },
    { code: 'pt-pt',    flag: '🇵🇹', name_en: 'Portuguese (Portugal)',  name_ar: 'البرتغالية (البرتغال)', base_lang: 'pt', dialect: '', category: 'European', popular: false, supports_clone: true },

    // ═════════════════════════════════════════════════════════════════
    // 🇨🇳 CHINESE
    // ═════════════════════════════════════════════════════════════════
    { code: 'zh-cn',    flag: '🇨🇳', name_en: 'Chinese (Mandarin)',     name_ar: 'الصينية (الماندرين)',   base_lang: 'zh', dialect: '', category: 'Asian',    popular: true,  supports_clone: true },
    { code: 'zh-tw',    flag: '🇹🇼', name_en: 'Chinese (Taiwan)',       name_ar: 'الصينية (تايوان)',     base_lang: 'zh', dialect: '', category: 'Asian',    popular: false, supports_clone: true },
    { code: 'zh-hk',    flag: '🇭🇰', name_en: 'Chinese (Cantonese)',    name_ar: 'الصينية (الكانتونية)',  base_lang: 'zh', dialect: '', category: 'Asian',    popular: false, supports_clone: false },

    // ═════════════════════════════════════════════════════════════════
    // 🇩🇪 GERMAN
    // ═════════════════════════════════════════════════════════════════
    { code: 'de-de',    flag: '🇩🇪', name_en: 'German (Germany)',       name_ar: 'الألمانية (ألمانيا)',  base_lang: 'de', dialect: '', category: 'European', popular: true,  supports_clone: true },
    { code: 'de-at',    flag: '🇦🇹', name_en: 'German (Austria)',       name_ar: 'الألمانية (النمسا)',   base_lang: 'de', dialect: '', category: 'European', popular: false, supports_clone: true },
    { code: 'de-ch',    flag: '🇨🇭', name_en: 'German (Switzerland)',   name_ar: 'الألمانية (سويسرا)',   base_lang: 'de', dialect: '', category: 'European', popular: false, supports_clone: true },

    // ═════════════════════════════════════════════════════════════════
    // 🌎 OTHER MAJOR LANGUAGES (clone-capable via XTTS)
    // ═════════════════════════════════════════════════════════════════
    { code: 'it-it',    flag: '🇮🇹', name_en: 'Italian',                name_ar: 'الإيطالية',           base_lang: 'it', dialect: '', category: 'European', popular: true,  supports_clone: true },
    { code: 'ru-ru',    flag: '🇷🇺', name_en: 'Russian',                name_ar: 'الروسية',             base_lang: 'ru', dialect: '', category: 'European', popular: true,  supports_clone: true },
    { code: 'tr-tr',    flag: '🇹🇷', name_en: 'Turkish',                name_ar: 'التركية',             base_lang: 'tr', dialect: '', category: 'European', popular: true,  supports_clone: true },
    { code: 'ja-jp',    flag: '🇯🇵', name_en: 'Japanese',               name_ar: 'اليابانية',           base_lang: 'ja', dialect: '', category: 'Asian',    popular: true,  supports_clone: true },
    { code: 'ko-kr',    flag: '🇰🇷', name_en: 'Korean',                 name_ar: 'الكورية',             base_lang: 'ko', dialect: '', category: 'Asian',    popular: true,  supports_clone: true },
    { code: 'hi-in',    flag: '🇮🇳', name_en: 'Hindi',                  name_ar: 'الهندية',             base_lang: 'hi', dialect: '', category: 'Indian',   popular: true,  supports_clone: true },
    { code: 'pl-pl',    flag: '🇵🇱', name_en: 'Polish',                 name_ar: 'البولندية',           base_lang: 'pl', dialect: '', category: 'European', popular: false, supports_clone: true },
    { code: 'nl-nl',    flag: '🇳🇱', name_en: 'Dutch',                  name_ar: 'الهولندية',           base_lang: 'nl', dialect: '', category: 'European', popular: false, supports_clone: true },
    { code: 'cs-cz',    flag: '🇨🇿', name_en: 'Czech',                  name_ar: 'التشيكية',            base_lang: 'cs', dialect: '', category: 'European', popular: false, supports_clone: true },
    { code: 'hu-hu',    flag: '🇭🇺', name_en: 'Hungarian',              name_ar: 'المجرية',             base_lang: 'hu', dialect: '', category: 'European', popular: false, supports_clone: true },

    // ═════════════════════════════════════════════════════════════════
    // 🌐 EDGE-TTS COVERAGE (no clone, but production-grade neural voices)
    // ═════════════════════════════════════════════════════════════════
    { code: 'fa-ir',    flag: '🇮🇷', name_en: 'Persian (Farsi)',        name_ar: 'الفارسية',            base_lang: 'fa', dialect: '', category: 'Asian',    popular: false, supports_clone: false },
    { code: 'ur-pk',    flag: '🇵🇰', name_en: 'Urdu',                   name_ar: 'الأردية',             base_lang: 'ur', dialect: '', category: 'Indian',   popular: false, supports_clone: false },
    { code: 'he-il',    flag: '🇮🇱', name_en: 'Hebrew',                 name_ar: 'العبرية',             base_lang: 'he', dialect: '', category: 'European', popular: false, supports_clone: false },
    { code: 'id-id',    flag: '🇮🇩', name_en: 'Indonesian',             name_ar: 'الإندونيسية',         base_lang: 'id', dialect: '', category: 'Asian',    popular: false, supports_clone: false },
    { code: 'ms-my',    flag: '🇲🇾', name_en: 'Malay',                  name_ar: 'الماليزية',           base_lang: 'ms', dialect: '', category: 'Asian',    popular: false, supports_clone: false },
    { code: 'vi-vn',    flag: '🇻🇳', name_en: 'Vietnamese',             name_ar: 'الفيتنامية',          base_lang: 'vi', dialect: '', category: 'Asian',    popular: false, supports_clone: false },
    { code: 'th-th',    flag: '🇹🇭', name_en: 'Thai',                   name_ar: 'التايلاندية',         base_lang: 'th', dialect: '', category: 'Asian',    popular: false, supports_clone: false },
    { code: 'fil-ph',   flag: '🇵🇭', name_en: 'Filipino',               name_ar: 'الفلبينية',           base_lang: 'fil', dialect: '', category: 'Asian',   popular: false, supports_clone: false },

    // Nordic
    { code: 'sv-se',    flag: '🇸🇪', name_en: 'Swedish',                name_ar: 'السويدية',            base_lang: 'sv', dialect: '', category: 'European', popular: false, supports_clone: false },
    { code: 'no-no',    flag: '🇳🇴', name_en: 'Norwegian',              name_ar: 'النرويجية',           base_lang: 'no', dialect: '', category: 'European', popular: false, supports_clone: false },
    { code: 'da-dk',    flag: '🇩🇰', name_en: 'Danish',                 name_ar: 'الدنماركية',          base_lang: 'da', dialect: '', category: 'European', popular: false, supports_clone: false },
    { code: 'fi-fi',    flag: '🇫🇮', name_en: 'Finnish',                name_ar: 'الفنلندية',           base_lang: 'fi', dialect: '', category: 'European', popular: false, supports_clone: false },
    { code: 'is-is',    flag: '🇮🇸', name_en: 'Icelandic',              name_ar: 'الأيسلندية',          base_lang: 'is', dialect: '', category: 'European', popular: false, supports_clone: false },

    // Slavic / Eastern European
    { code: 'uk-ua',    flag: '🇺🇦', name_en: 'Ukrainian',              name_ar: 'الأوكرانية',          base_lang: 'uk', dialect: '', category: 'European', popular: false, supports_clone: false },
    { code: 'ro-ro',    flag: '🇷🇴', name_en: 'Romanian',               name_ar: 'الرومانية',           base_lang: 'ro', dialect: '', category: 'European', popular: false, supports_clone: false },
    { code: 'bg-bg',    flag: '🇧🇬', name_en: 'Bulgarian',              name_ar: 'البلغارية',           base_lang: 'bg', dialect: '', category: 'European', popular: false, supports_clone: false },
    { code: 'el-gr',    flag: '🇬🇷', name_en: 'Greek',                  name_ar: 'اليونانية',           base_lang: 'el', dialect: '', category: 'European', popular: false, supports_clone: false },
    { code: 'hr-hr',    flag: '🇭🇷', name_en: 'Croatian',               name_ar: 'الكرواتية',           base_lang: 'hr', dialect: '', category: 'European', popular: false, supports_clone: false },
    { code: 'sk-sk',    flag: '🇸🇰', name_en: 'Slovak',                 name_ar: 'السلوفاكية',          base_lang: 'sk', dialect: '', category: 'European', popular: false, supports_clone: false },
    { code: 'sl-si',    flag: '🇸🇮', name_en: 'Slovenian',              name_ar: 'السلوفينية',          base_lang: 'sl', dialect: '', category: 'European', popular: false, supports_clone: false },
    { code: 'sr-rs',    flag: '🇷🇸', name_en: 'Serbian',                name_ar: 'الصربية',             base_lang: 'sr', dialect: '', category: 'European', popular: false, supports_clone: false },
    { code: 'bs-ba',    flag: '🇧🇦', name_en: 'Bosnian',                name_ar: 'البوسنية',            base_lang: 'bs', dialect: '', category: 'European', popular: false, supports_clone: false },
    { code: 'mk-mk',    flag: '🇲🇰', name_en: 'Macedonian',             name_ar: 'المقدونية',           base_lang: 'mk', dialect: '', category: 'European', popular: false, supports_clone: false },
    { code: 'sq-al',    flag: '🇦🇱', name_en: 'Albanian',               name_ar: 'الألبانية',           base_lang: 'sq', dialect: '', category: 'European', popular: false, supports_clone: false },

    // Baltic
    { code: 'et-ee',    flag: '🇪🇪', name_en: 'Estonian',               name_ar: 'الإستونية',           base_lang: 'et', dialect: '', category: 'European', popular: false, supports_clone: false },
    { code: 'lv-lv',    flag: '🇱🇻', name_en: 'Latvian',                name_ar: 'اللاتفية',            base_lang: 'lv', dialect: '', category: 'European', popular: false, supports_clone: false },
    { code: 'lt-lt',    flag: '🇱🇹', name_en: 'Lithuanian',             name_ar: 'الليتوانية',          base_lang: 'lt', dialect: '', category: 'European', popular: false, supports_clone: false },

    // Celtic / Other European
    { code: 'ca-es',    flag: '🇦🇩', name_en: 'Catalan',                name_ar: 'الكاتالونية',         base_lang: 'ca', dialect: '', category: 'European', popular: false, supports_clone: false },
    { code: 'cy-gb',    flag: '🏴󠁧󠁢󠁷󠁬󠁳󠁿', name_en: 'Welsh',                  name_ar: 'الويلزية',            base_lang: 'cy', dialect: '', category: 'European', popular: false, supports_clone: false },
    { code: 'ga-ie',    flag: '🇮🇪', name_en: 'Irish',                  name_ar: 'الأيرلندية',          base_lang: 'ga', dialect: '', category: 'European', popular: false, supports_clone: false },

    // Indian subcontinent
    { code: 'bn-in',    flag: '🇧🇩', name_en: 'Bengali',                name_ar: 'البنغالية',           base_lang: 'bn', dialect: '', category: 'Indian',   popular: false, supports_clone: false },
    { code: 'ta-in',    flag: '🇮🇳', name_en: 'Tamil',                  name_ar: 'التاميلية',           base_lang: 'ta', dialect: '', category: 'Indian',   popular: false, supports_clone: false },
    { code: 'te-in',    flag: '🇮🇳', name_en: 'Telugu',                 name_ar: 'التيلوغوية',          base_lang: 'te', dialect: '', category: 'Indian',   popular: false, supports_clone: false },
    { code: 'mr-in',    flag: '🇮🇳', name_en: 'Marathi',                name_ar: 'الماراتية',           base_lang: 'mr', dialect: '', category: 'Indian',   popular: false, supports_clone: false },
    { code: 'gu-in',    flag: '🇮🇳', name_en: 'Gujarati',               name_ar: 'الغوجاراتية',         base_lang: 'gu', dialect: '', category: 'Indian',   popular: false, supports_clone: false },
    { code: 'kn-in',    flag: '🇮🇳', name_en: 'Kannada',                name_ar: 'الكانادية',           base_lang: 'kn', dialect: '', category: 'Indian',   popular: false, supports_clone: false },
    { code: 'ml-in',    flag: '🇮🇳', name_en: 'Malayalam',              name_ar: 'المالايالامية',       base_lang: 'ml', dialect: '', category: 'Indian',   popular: false, supports_clone: false },
    { code: 'ne-np',    flag: '🇳🇵', name_en: 'Nepali',                 name_ar: 'النيبالية',           base_lang: 'ne', dialect: '', category: 'Indian',   popular: false, supports_clone: false },

    // Central Asian / Caucasus
    { code: 'az-az',    flag: '🇦🇿', name_en: 'Azerbaijani',            name_ar: 'الأذربيجانية',        base_lang: 'az', dialect: '', category: 'Asian',    popular: false, supports_clone: false },
    { code: 'kk-kz',    flag: '🇰🇿', name_en: 'Kazakh',                 name_ar: 'الكازاخستانية',       base_lang: 'kk', dialect: '', category: 'Asian',    popular: false, supports_clone: false },
    { code: 'uz-uz',    flag: '🇺🇿', name_en: 'Uzbek',                  name_ar: 'الأوزبكية',           base_lang: 'uz', dialect: '', category: 'Asian',    popular: false, supports_clone: false },
    { code: 'mn-mn',    flag: '🇲🇳', name_en: 'Mongolian',              name_ar: 'المنغولية',           base_lang: 'mn', dialect: '', category: 'Asian',    popular: false, supports_clone: false },
    { code: 'ka-ge',    flag: '🇬🇪', name_en: 'Georgian',               name_ar: 'الجورجية',            base_lang: 'ka', dialect: '', category: 'Asian',    popular: false, supports_clone: false },

    // Southeast Asian
    { code: 'km-kh',    flag: '🇰🇭', name_en: 'Khmer',                  name_ar: 'الخميرية',            base_lang: 'km', dialect: '', category: 'Asian',    popular: false, supports_clone: false },
    { code: 'lo-la',    flag: '🇱🇦', name_en: 'Lao',                    name_ar: 'اللاوية',             base_lang: 'lo', dialect: '', category: 'Asian',    popular: false, supports_clone: false },
    { code: 'my-mm',    flag: '🇲🇲', name_en: 'Burmese',                name_ar: 'البورمية',            base_lang: 'my', dialect: '', category: 'Asian',    popular: false, supports_clone: false },
    { code: 'si-lk',    flag: '🇱🇰', name_en: 'Sinhala',                name_ar: 'السنهالية',           base_lang: 'si', dialect: '', category: 'Asian',    popular: false, supports_clone: false },

    // African
    { code: 'sw-ke',    flag: '🇰🇪', name_en: 'Swahili',                name_ar: 'السواحلية',           base_lang: 'sw', dialect: '', category: 'African',  popular: false, supports_clone: false },
    { code: 'af-za',    flag: '🇿🇦', name_en: 'Afrikaans',              name_ar: 'الأفريكانية',         base_lang: 'af', dialect: '', category: 'African',  popular: false, supports_clone: false },
    { code: 'zu-za',    flag: '🇿🇦', name_en: 'Zulu',                   name_ar: 'الزولو',              base_lang: 'zu', dialect: '', category: 'African',  popular: false, supports_clone: false },
    { code: 'am-et',    flag: '🇪🇹', name_en: 'Amharic',                name_ar: 'الأمهرية',            base_lang: 'am', dialect: '', category: 'African',  popular: false, supports_clone: false },
    { code: 'so-so',    flag: '🇸🇴', name_en: 'Somali',                 name_ar: 'الصومالية',           base_lang: 'so', dialect: '', category: 'African',  popular: false, supports_clone: false },

    // Misc
    { code: 'ps-af',    flag: '🇦🇫', name_en: 'Pashto',                 name_ar: 'الباشتو',             base_lang: 'ps', dialect: '', category: 'Asian',    popular: false, supports_clone: false },
];

// ═════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS — use these when submitting jobs to the /dub API
// ═════════════════════════════════════════════════════════════════════

/**
 * Get the API payload config for a given language code.
 * Returns null if code is unknown.
 *
 * Example:
 *   const cfg = getLanguageConfig('ar-eg');
 *   // → { target_language: 'ar', dialect: 'المصرية', display_name: 'Arabic (Egyptian)', ... }
 *
 *   // Submitting to /dub:
 *   fetch('/dub/async', {
 *     method: 'POST',
 *     body: JSON.stringify({
 *       media_url: url,
 *       target_language: cfg.target_language,
 *       dialect: cfg.dialect,
 *       voice_mode: cfg.supports_clone ? 'clone' : 'default',
 *       ...
 *     })
 *   });
 */
window.getLanguageConfig = function(code) {
    const lang = window.LANGUAGES.find(l => l.code === code);
    if (!lang) return null;
    return {
        target_language: lang.base_lang,
        dialect: lang.dialect || '',
        display_name: lang.name_en,
        display_name_ar: lang.name_ar,
        flag: lang.flag,
        category: lang.category || 'Other',
        supports_clone: !!lang.supports_clone,
        is_arabic_dialect: lang.base_lang === 'ar' && lang.code !== 'ar',
        is_msa: lang.code === 'ar',
    };
};

/**
 * Group all languages by category. Useful if you want to render
 * the picker with section headers (Arabic / European / Asian / ...).
 */
window.getLanguagesByCategory = function() {
    const groups = {};
    for (const lang of window.LANGUAGES) {
        const cat = lang.category || 'Other';
        if (!groups[cat]) groups[cat] = [];
        groups[cat].push(lang);
    }
    return groups;
};

/**
 * All Arabic dialect codes (excluding MSA). Handy if you build
 * a dedicated "dialect picker" panel.
 */
window.getArabicDialects = function() {
    return window.LANGUAGES.filter(l => l.base_lang === 'ar' && l.code !== 'ar');
};

/**
 * Languages that support voice cloning via F5-TTS or XTTS.
 * Use this when the user uploads a voice sample.
 */
window.getCloneableLanguages = function() {
    return window.LANGUAGES.filter(l => l.supports_clone);
};

// Quick stats (logged once on load — remove this block in production if you want)
console.log(
    `🌍 Glotix Languages: ${window.LANGUAGES.length} total | ` +
    `${window.getArabicDialects().length} Arabic dialects | ` +
    `${window.getCloneableLanguages().length} clone-capable`
);
