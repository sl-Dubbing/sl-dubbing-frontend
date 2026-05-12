// js/languages-data.js
// هيكل مسطح يتوافق مع lang-picker.js الذي يقرأ window.LANGUAGES
window.LANGUAGES = [
    // ── العربية (موحدة) ──
    { code: 'ar',    flag: '🌍', name_en: 'Arabic',     name_ar: 'العربية',    popular: true  },

    // ── الإنجليزية ──
    { code: 'en-us', flag: '🇺🇸', name_en: 'English (US)',  name_ar: 'الإنجليزية (أمريكا)', popular: true  },
    { code: 'en-gb', flag: '🇬🇧', name_en: 'English (UK)',  name_ar: 'الإنجليزية (بريطانيا)', popular: true  },
    { code: 'en-au', flag: '🇦🇺', name_en: 'English (AU)',  name_ar: 'الإنجليزية (أستراليا)', popular: false },
    { code: 'en-ca', flag: '🇨🇦', name_en: 'English (CA)',  name_ar: 'الإنجليزية (كندا)',    popular: false },

    // ── الإسبانية ──
    { code: 'es-es', flag: '🇪🇸', name_en: 'Spanish (Spain)',  name_ar: 'الإسبانية (إسبانيا)', popular: true  },
    { code: 'es-mx', flag: '🇲🇽', name_en: 'Spanish (Mexico)', name_ar: 'الإسبانية (المكسيك)', popular: false },

    // ── الفرنسية ──
    { code: 'fr-fr', flag: '🇫🇷', name_en: 'French (France)', name_ar: 'الفرنسية (فرنسا)',  popular: true  },
    { code: 'fr-ca', flag: '🇨🇦', name_en: 'French (Canada)', name_ar: 'الفرنسية (كندا)',   popular: false },

    // ── البرتغالية ──
    { code: 'pt-br', flag: '🇧🇷', name_en: 'Portuguese (Brazil)',   name_ar: 'البرتغالية (البرازيل)', popular: true  },
    { code: 'pt-pt', flag: '🇵🇹', name_en: 'Portuguese (Portugal)', name_ar: 'البرتغالية (البرتغال)', popular: false },

    // ── لغات أخرى ──
    { code: 'de-de', flag: '🇩🇪', name_en: 'German',   name_ar: 'الألمانية',  popular: true  },
    { code: 'it-it', flag: '🇮🇹', name_en: 'Italian',  name_ar: 'الإيطالية', popular: false },
    { code: 'ru-ru', flag: '🇷🇺', name_en: 'Russian',  name_ar: 'الروسية',   popular: true  },
    { code: 'tr-tr', flag: '🇹🇷', name_en: 'Turkish',  name_ar: 'التركية',   popular: true  },
    { code: 'zh-cn', flag: '🇨🇳', name_en: 'Chinese',  name_ar: 'الصينية',   popular: true  },
    { code: 'ja-jp', flag: '🇯🇵', name_en: 'Japanese', name_ar: 'اليابانية', popular: true  },
    { code: 'ko-kr', flag: '🇰🇷', name_en: 'Korean',   name_ar: 'الكورية',   popular: false },
    { code: 'hi-in', flag: '🇮🇳', name_en: 'Hindi',    name_ar: 'الهندية',   popular: true  },
    { code: 'nl-nl', flag: '🇳🇱', name_en: 'Dutch',    name_ar: 'الهولندية', popular: false },
    { code: 'pl-pl', flag: '🇵🇱', name_en: 'Polish',   name_ar: 'البولندية', popular: false },
    { code: 'sv-se', flag: '🇸🇪', name_en: 'Swedish',  name_ar: 'السويدية',  popular: false },
    { code: 'id-id', flag: '🇮🇩', name_en: 'Indonesian', name_ar: 'الإندونيسية', popular: false },
    { code: 'fa-ir', flag: '🇮🇷', name_en: 'Persian',  name_ar: 'الفارسية',  popular: false },
    { code: 'ur-pk', flag: '🇵🇰', name_en: 'Urdu',     name_ar: 'الأردية',   popular: false },
];
