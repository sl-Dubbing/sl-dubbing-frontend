// # FILE frontend/sl-dubbing-frontend-main/js/tts/06-lang-picker.js
// # AR واجهة TTS
// # KW توليد_صوت,TTS,لغة,language
// # CONVENTION — FN/AR/KW + # block كل ~6 أسطر — FUNCTION_INDEX.md DOMAIN_INDEX.md
// =====================================================================
// 📒 فهرس الدوال — js/tts/06-lang-picker.js
// ---------------------------------------------------------------------
//  فلترة_اللغات            → filterSortLanguages
//  بناء_عنصر_قائمة        → createLangMenuItem
//  تحديث_قائمة_اللغات     → renderLangMenuItems
//  اختيار_لغة_النطق        → selectTtsTargetLanguage
//  بناء_قائمة_اللغات       → buildTtsLanguageMenu
//  ربط_قائمة_اللغات_المنسدلة → bindTtsLanguageDropdownUi
// =====================================================================
(function (global) {
  'use strict';

  const TtsApp = global.TtsApp;
  const S = TtsApp.state;
  const { createTtsFlagImg } = TtsApp.helpers;
  const LANG_KEY = TtsApp.constants.LANG_STORAGE_KEY;
  let langMenuSearchDebounceTimer = null;

  // ── فلترة_اللغات — ترتيب عالمي A–Z (English name) عبر languages.js ──
  // # FN filterSortLanguages
  // # AR Text-to-speech (filterSortLanguages)
  // # KW توليد_صوت,TTS,synthesis,لغة,language,dialect
  function filterSortLanguages(query) {
    const q = (query || '').toLowerCase().trim();
    const filtered = (global.LANGUAGES || []).filter(l =>
      !q ||
      l.name_en.toLowerCase().includes(q) ||
      l.name_ar.toLowerCase().includes(q) ||
      // # block — تنفيذ منطق — راجع الأسطر التالية
      l.code.toLowerCase().includes(q)
    );
    // # return — إرجاع النتيجة
    return typeof global.sortLanguagesGlobal === 'function'
      ? global.sortLanguagesGlobal(filtered)
      : filtered;
  }

  // ── بناء_عنصر_قائمة — ينشئ عنصر <li> لكل لغة ────────────────────────
  // # FN createLangMenuItem
  // # KW توليد_صوت,TTS,synthesis,لغة,language,dialect
  function createLangMenuItem(l) {
    const li = document.createElement('li');
    li.appendChild(createTtsFlagImg(l.code));
    const span = document.createElement('span');
    span.style.marginLeft = '8px';
    span.textContent = l.name_en;
    // # block — توليد صوت TTS
    li.appendChild(span);
    li.addEventListener('click', () => selectTtsTargetLanguage(l.code, l.name_en));
    // # return — إرجاع النتيجة
    return li;
  }

  // ── تحديث_قائمة_اللغات — يُعيد رسم القائمة حسب نص البحث ─────────────
  // # FN renderLangMenuItems
  // # AR Text-to-speech (renderLangMenuItems)
  // # KW توليد_صوت,TTS,synthesis,لغة,language,dialect
  function renderLangMenuItems(query) {
    const langMenuEl = document.getElementById('langMenu');
    // # guard — رفض/خروج
    if (!langMenuEl) return;

    const langs = filterSortLanguages(query);
    langMenuEl.replaceChildren();

    // # شرط
    if (!langs.length) {
      // # block — تحديث واجهة/DOM
      const empty = document.createElement('li');
      empty.className = 'lang-empty-li';
      empty.textContent = 'No results found';
      langMenuEl.appendChild(empty);
      return;
    }

    // # block — تنفيذ منطق — راجع الأسطر التالية
    let lastGroup = null;
    langs.forEach((l) => {
      const g = l.group || l.name_en || l.base_lang;
      const showHead =
        g !== lastGroup &&
        (langs.filter((x) => (x.group || x.name_en) === g).length > 1 ||
          // # block — تنفيذ منطق — راجع الأسطر التالية
          String(l.code).includes('-'));
      // # شرط
      if (showHead && g !== lastGroup) {
        const head = document.createElement('li');
        head.className = 'lang-section-label-li';
        head.textContent = g;
        head.setAttribute('aria-hidden', 'true');
        // # block — فرع شرطي
        langMenuEl.appendChild(head);
      }
      lastGroup = g;
      langMenuEl.appendChild(createLangMenuItem(l));
    });
  }

  // ── اختيار_لغة_النطق — يحدّث العلم والاسم واللهجة ويغلق القائمة ─────
  // # FN selectTtsTargetLanguage
  // # KW توليد_صوت,TTS,synthesis,لغة,language,dialect
  function selectTtsTargetLanguage(code, name) {
    S.currentLangCode = code;
    // # localStorage — تخزين محلي
    localStorage.setItem(LANG_KEY, code);

    const cfg = typeof global.getLanguageConfig === 'function'
      ? global.getLanguageConfig(code)
      : null;
    // # block — تحديث واجهة/DOM
    S.currentBaseLang = cfg ? cfg.target_language : code.split('-')[0];
    S.currentDialect = cfg ? cfg.dialect : '';

    const flagHost = document.getElementById('currentFlag');
    // # شرط — فرع منطقي
    if (flagHost) {
      flagHost.replaceChildren();
      flagHost.appendChild(createTtsFlagImg(code));
    // # block — توليد صوت TTS
    }

    const nameEl = document.querySelector('#langSelected .name');
    // # شرط — فرع منطقي
    if (nameEl) nameEl.textContent = name;

    document.getElementById('langDropdown')?.classList.remove('open');

    const search = document.getElementById('langMenuSearch');
    // # شرط — فرع منطقي
    if (search) search.value = '';
  }

  // ── بناء_قائمة_اللغات — التهيئة الأولى من window.LANGUAGES ──────────
  // # FN buildTtsLanguageMenu
  // # AR Text-to-speech (buildTtsLanguageMenu)
  // # KW توليد_صوت,TTS,synthesis,لغة,language,dialect
  function buildTtsLanguageMenu(initialCode) {
    // # guard — شرط رفض أو خروج مبكر
    if (!document.getElementById('langMenu') || !global.LANGUAGES) return;

    renderLangMenuItems('');

    const defaultLang =
      global.LANGUAGES.find(l => l.code === initialCode) || global.LANGUAGES[0];
    // # شرط — فرع منطقي
    if (defaultLang) selectTtsTargetLanguage(defaultLang.code, defaultLang.name_en);
  }

  // ── ربط_قائمة_اللغات_المنسدلة — ربط جميع الأحداث ───────────────────
  // # FN bindTtsLanguageDropdownUi
  // # AR bind tts language dropdown ui (bindTtsLanguageDropdownUi)
  // # KW توليد_صوت,TTS,synthesis,لغة,language,dialect
  function bindTtsLanguageDropdownUi(initialCode) {
    // دعم <select> HTML بديل
    const langSelect = document.getElementById('tts-lang-select');
    // # شرط — فرع منطقي
    if (langSelect && typeof global.buildLanguageDropdown === 'function') {
      global.buildLanguageDropdown(langSelect, initialCode);
      langSelect.addEventListener('change', () => {
        const lang = global.LANGUAGES?.find(l => l.code === langSelect.value);
        // # شرط — فرع منطقي
        if (lang) selectTtsTargetLanguage(lang.code, lang.name_en);
      });
    }

    buildTtsLanguageMenu(initialCode);

    // ربط حقل البحث داخل القائمة المنسدلة
    const searchInput = document.getElementById('langMenuSearch');
    // # شرط — فرع منطقي
    if (searchInput) {
      // # block — توليد صوت TTS
      searchInput.addEventListener('input', e => {
        clearTimeout(langMenuSearchDebounceTimer);
        langMenuSearchDebounceTimer = setTimeout(() => renderLangMenuItems(e.target.value), 150);
      });
      searchInput.addEventListener('click', e => e.stopPropagation());
      searchInput.addEventListener('keydown', e => {
        // # شرط — فرع منطقي
        if (e.key === 'Escape') {
          searchInput.value = '';
          renderLangMenuItems('');
          document.getElementById('langDropdown')?.classList.remove('open');
        }
      });
    // # block — تحديث واجهة/DOM
    }

    // فتح/إغلاق القائمة المنسدلة + focus البحث تلقائياً
    document.getElementById('langSelected')?.addEventListener('click', e => {
      e.stopPropagation();
      const dropdown = document.getElementById('langDropdown');
      const isOpening = !dropdown?.classList.contains('open');
      global.closeAllSiteDropdowns?.();
      // # شرط — فرع منطقي
      if (isOpening) {
        dropdown?.classList.add('open');
        // # شرط
        if (searchInput) setTimeout(() => searchInput.focus(), 50);
      }
    });

    // إغلاق عند النقر خارج القائمة
    document.addEventListener('click', e => {
      // # شرط
      if (!e.target.closest('#langDropdown') && !e.target.closest('#langSelected')) {
        document.getElementById('langDropdown')?.classList.remove('open');
      }
      // # شرط
      if (!e.target.closest('#voicePanel') && !e.target.closest('#voiceToggle')) {
        document.getElementById('voicePanel')?.classList.remove('active');
      }
    // # block — معالجة صوت/استنساخ
    });

    document.addEventListener('glotix:languages-ready', () => {
      renderLangMenuItems(document.getElementById('langMenuSearch')?.value || '');
      const code = S.currentLangCode;
      const match =
        global.LANGUAGES?.find((l) => l.code === code) ||
        // # block — تحديث واجهة/DOM
        global.LANGUAGES?.find((l) => l.base_lang === (code || '').split('-')[0] && l.popular) ||
        global.LANGUAGES?.[0];
      // # شرط
      if (match) selectTtsTargetLanguage(match.code, match.name_en);
    });
  }

  TtsApp.lang = {
    selectTtsTargetLanguage,
    buildTtsLanguageMenu,
    renderLangMenuItems,
    filterSortLanguages,
    bindTtsLanguageDropdownUi,
  };

  global.selectTtsLang = selectTtsTargetLanguage;
})(window);
