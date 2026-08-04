// # FILE frontend/sl-dubbing-frontend-main/js/dubbing/16-lang-picker.js
// # AR واجهة الدبلجة — رفع، Start، polling، أصوات
// # KW لغة,language
// # CONVENTION — FN/AR/KW + # block كل ~6 أسطر — FUNCTION_INDEX.md DOMAIN_INDEX.md
// js/dubbing/16-lang-picker.js — Target language multi-picker (ElevenLabs-synced catalog)
(function (global) {
  'use strict';

  const DubbingApp = (global.DubbingApp = global.DubbingApp || {});
  const STORAGE_KEY = global.LANG_STORAGE_KEY || 'selected_langs';
  let langSearchDebounceTimer = null;
  let searchBound = false;
  let selected = new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) || '["en-us"]'));
  global.selectedLangs = selected;

  // # FN _getFlagImg
  // # AR اللغات واللهجات (_getFlagImg)
  // # KW لغة,language,dialect
  function _getFlagImg(code) {
    let country = code.split('-')[1];
    // # شرط
    if (!country) {
      const defaults = global.LANG_FLAG_COUNTRY || {};
      country = defaults[code.split('-')[0]] || 'xx';
    }
    // # block — معالجة أخطاء
    return (
      `<span class="lang-flag-shell" style="--flag-size:22px">` +
      `<img class="lang-flag" src="https://hatscripts.github.io/circle-flags/flags/${country.toLowerCase()}.svg" ` +
      `alt="" width="22" height="22"></span>`
    );
  }

  // # FN _escapeHtml
  // # AR اللغات واللهجات (_escapeHtml)
  // # KW لغة,language,dialect
  function _escapeHtml(s) {
    return String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // # FN _filterLangs
  // # AR اللغات واللهجات (_filterLangs)
  // # KW لغة,language,dialect
  function _filterLangs(query) {
    const f = (query || '').toLowerCase().trim();
    // # guard — رفض/خروج
    if (!global.LANGUAGES) return [];
    const filtered = global.LANGUAGES.filter(
      (l) =>
        !f ||
        // # block — فرع شرطي
        (l.name_en || '').toLowerCase().includes(f) ||
        (l.name_ar || '').toLowerCase().includes(f) ||
        (l.code || '').toLowerCase().includes(f) ||
        (l.group || '').toLowerCase().includes(f)
    );
    return typeof global.sortLanguagesGlobal === 'function'
      // # block — إرجاع نتيجة
      ? global.sortLanguagesGlobal(filtered)
      : filtered;
  }

  // # FN _groupLangs
  // # AR اللغات واللهجات (_groupLangs)
  // # KW لغة,language,dialect
  function _groupLangs(langs) {
    const sections = [];
    let current = null;
    for (const l of langs) {
      const g = l.group || l.name_en || l.base_lang || 'Other';
      // # شرط
      if (!current || current.title !== g) {
        // # block — فرع شرطي
        current = { title: g, items: [] };
        sections.push(current);
      }
      current.items.push(l);
    }
    return sections;
  }

  // # FN _renderLangItem
  // # AR اللغات واللهجات (_renderLangItem)
  // # KW لغة,language,dialect
  function _renderLangItem(l) {
    const cls = [
      'lang-item',
      l.popular ? 'popular' : '',
      selected.has(l.code) ? 'selected' : '',
      String(l.code).includes('-') ? 'is-locale' : '',
    // # block — تنفيذ منطق — راجع الأسطر التالية
    ]
      .filter(Boolean)
      .join(' ');
    return (
      `<div class="${cls}" data-code="${_escapeHtml(l.code)}" role="option" aria-selected="${selected.has(l.code)}">` +
      _getFlagImg(l.code) +
      // # block — إرجاع نتيجة
      `<div class="lang-info">` +
      `<div class="lang-en">${_escapeHtml(l.name_en)}</div>` +
      `</div></div>`
    );
  }

  // # FN _updateLangCount
  // # AR اللغات واللهجات (_updateLangCount)
  // # KW لغة,language,dialect
  function _updateLangCount(count) {
    const badge = document.getElementById('langCountBadge');
    // # guard — رفض/خروج
    if (!badge) return;
    // # شرط
    if (count > 0) {
      badge.textContent = count;
      badge.style.display = 'inline-flex';
    // # block — تحديث واجهة/DOM
    } else {
      badge.style.display = 'none';
    }
  }

  // # FN _updateCatalogHint
  // # AR اللغات واللهجات (_updateCatalogHint)
  // # KW لغة,language,dialect
  function _updateCatalogHint() {
    const el = document.getElementById('langCatalogHint');
    // # شرط
    if (el) el.remove();
  }

  // # FN _updateTargetLangTriggerUI
  // # AR اللغات واللهجات (_updateTargetLangTriggerUI)
  // # KW لغة,language,dialect
  function _updateTargetLangTriggerUI() {
    const flagEl = document.getElementById('targetLangFlag');
    const labelEl = document.getElementById('targetLangLabel');
    // # guard — رفض/خروج
    if (!flagEl || !labelEl) return;

    const count = selected.size;
    _updateLangCount(count);

    // # شرط
    if (!count || !global.LANGUAGES) {
      flagEl.innerHTML = '<i class="fa-solid fa-language" style="font-size:1.2rem;color:#6b7280;"></i>';
      labelEl.textContent = 'Select target languages';
      labelEl.style.color = 'var(--text-muted)';
      return;
    }

    // # block — تحديث واجهة/DOM
    const codes = [...selected];
    const first = global.LANGUAGES.find((l) => l.code === codes[0]);
    // # شرط
    if (count === 1 && first) {
      flagEl.innerHTML = _getFlagImg(first.code);
      labelEl.textContent = first.name_en;
      labelEl.style.color = 'var(--text-main)';
      // # block — تحديث واجهة/DOM
      return;
    }

    flagEl.innerHTML = `<span class="target-lang-flags-stack">${codes
      .slice(0, 3)
      .map((c) => _getFlagImg(c))
      .join('')}</span>`;
    // # block — حلقة/تكرار
    labelEl.textContent =
      count === 2
        ? codes
            .map((c) => global.LANGUAGES.find((l) => l.code === c)?.name_en)
            .filter(Boolean)
            .join(', ')
        // # block — حلقة/تكرار
        : `${count} languages`;
    labelEl.style.color = 'var(--text-main)';
  }

  // # FN renderLanguages
  // # AR اللغات واللهجات (renderLanguages)
  // # KW لغة,language,dialect
  function renderLanguages(filter) {
    const container = document.getElementById('langList');
    // # guard — رفض/خروج
    if (!container || !global.LANGUAGES) return;

    const langs = _filterLangs(filter);
    _updateLangCount(selected.size);
    _updateCatalogHint();

    // # guard — رفض/خروج
    if (!langs.length) {
      container.innerHTML = '<div class="lang-empty">No results found</div>';
      return;
    }

    const sections = _groupLangs(langs);
    container.innerHTML = sections
      // # block — حلقة/تكرار
      .map((sec) => {
        const showHead = sec.items.length > 1 || String(sec.items[0]?.code || '').includes('-');
        const head = showHead
          ? `<div class="lang-section-label">${_escapeHtml(sec.title)}</div>`
          : '';
        return head + sec.items.map(_renderLangItem).join('');
      // # block — حلقة/تكرار
      })
      .join('');

    container.querySelectorAll('.lang-item').forEach((el) =>
      el.addEventListener('click', () => toggleLanguage(el.dataset.code))
    );
  }

  // # FN toggleLanguage
  // # AR اللغات واللهجات (toggleLanguage)
  // # KW لغة,language,dialect
  function toggleLanguage(code) {
    // # شرط
    if (selected.has(code)) {
      // # guard — رفض/خروج
      if (selected.size > 1) selected.delete(code);
      else {
        global.showToast?.('Select at least one language', 'error');
        return;
      // # block — فرع شرطي
      }
    } else {
      // # guard — رفض/خروج
      if (selected.size >= 10) {
        global.showToast?.('Maximum 10 languages allowed', 'error');
        return;
      }
      // # block — فرع شرطي
      selected.add(code);
      document.getElementById('langTrigger')?.classList.remove('needs-attention');
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...selected]));
    global.selectedLangs = selected;
    renderSelectedLangs();
    // # block — تحديث واجهة/DOM
    renderLanguages(document.getElementById('langSearch')?.value || '');
    _updateTargetLangTriggerUI();
    DubbingApp.srtEditor?.onTargetLanguagesChanged?.();
  }

  // # FN removeLanguage
  // # AR اللغات واللهجات (removeLanguage)
  // # KW لغة,language,dialect
  function removeLanguage(code) {
    // # guard — رفض/خروج
    if (selected.size <= 1) {
      global.showToast?.('Keep at least one language', 'error');
      return;
    }
    selected.delete(code);
    // # block — تحديث واجهة/DOM
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...selected]));
    global.selectedLangs = selected;
    renderSelectedLangs();
    renderLanguages(document.getElementById('langSearch')?.value || '');
    _updateTargetLangTriggerUI();
    DubbingApp.srtEditor?.onTargetLanguagesChanged?.();
  }

  // # FN _renderLangPill
  // # AR اللغات واللهجات (_renderLangPill)
  // # KW لغة,language,dialect
  function _renderLangPill(code) {
    const l = global.LANGUAGES?.find((x) => x.code === code);
    // # guard — رفض/خروج
    if (!l) return '';
    return (
      `<button type="button" class="lang-pill" data-code="${_escapeHtml(code)}">` +
      _getFlagImg(code) +
      // # block — فرع شرطي
      `<span>${_escapeHtml(l.name_en)}</span>` +
      `<span class="remove-icon" aria-hidden="true">×</span>` +
      `</button>`
    );
  }

  // # FN renderSelectedLangs
  // # AR اللغات واللهجات (renderSelectedLangs)
  // # KW لغة,language,dialect
  function renderSelectedLangs() {
    const display = document.getElementById('selectedLangsDisplay');
    // # guard — رفض/خروج
    if (!display) return;
    // # guard — رفض/خروج
    if (!selected.size) {
      display.innerHTML = '<div class="selected-langs-empty">Pick one or more target languages</div>';
      return;
    // # block — تحديث واجهة/DOM
    }
    display.innerHTML = `<div class="selected-langs-pills">${[...selected]
      .map(_renderLangPill)
      .join('')}</div>`;
    display.querySelectorAll('.lang-pill').forEach((el) => {
      el.addEventListener('click', () => removeLanguage(el.dataset.code));
    // # block — حلقة/تكرار
    });
    _updateTargetLangTriggerUI();
  }

  // # FN _normalizeLangCode
  // # AR اللغات واللهجات (_normalizeLangCode)
  // # KW لغة,language,dialect
  function _normalizeLangCode(code) {
    // # guard — رفض/خروج
    if (!code || !global.LANGUAGES) return code;
    // # guard — رفض/خروج
    if (global.LANGUAGES.some((l) => l.code === code)) return code;
    const base = code.split('-')[0];
    return (
      global.LANGUAGES.find((l) => l.code === base) ||
      // # block — فرع شرطي
      global.LANGUAGES.find((l) => l.base_lang === base && l.popular) ||
      global.LANGUAGES.find((l) => l.base_lang === base)
    )?.code ?? code;
  }

  // # FN initDubbingLangPicker
  // # AR اللغات واللهجات (initDubbingLangPicker)
  // # KW لغة,language,dialect
  function initDubbingLangPicker() {
    // # guard — رفض/خروج
    if (!global.LANGUAGES) {
      setTimeout(initDubbingLangPicker, 100);
      return;
    }

    const normalized = new Set(
      // # block — فرع شرطي
      [...selected]
        .map(_normalizeLangCode)
        .filter((c) => global.LANGUAGES.some((l) => l.code === c))
    );
    // # شرط
    if (normalized.size) {
      selected = normalized;
      // # block — فرع شرطي
      global.selectedLangs = selected;
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...selected]));
    } else if (global.LANGUAGES[0]) {
      selected = new Set([global.LANGUAGES.find((l) => l.code === 'en-us')?.code || global.LANGUAGES[0].code]);
      global.selectedLangs = selected;
    }

    // # block — تحديث واجهة/DOM
    renderLanguages();
    renderSelectedLangs();
    _updateTargetLangTriggerUI();

    const search = document.getElementById('langSearch');
    // # شرط
    if (search && !searchBound) {
      searchBound = true;
      // # block — تحديث واجهة/DOM
      search.addEventListener('input', (e) => {
        clearTimeout(langSearchDebounceTimer);
        langSearchDebounceTimer = setTimeout(() => renderLanguages(e.target.value), 150);
      });
    }
  }

  document.addEventListener('glotix:languages-ready', () => initDubbingLangPicker());

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDubbingLangPicker);
  } else {
    initDubbingLangPicker();
  }

  global.renderLanguages = renderLanguages;
  global.renderSelectedLangs = renderSelectedLangs;
  global.toggleLanguage = toggleLanguage;
  global.removeLanguage = removeLanguage;
  global.updateTargetLangTriggerUI = _updateTargetLangTriggerUI;

  DubbingApp.langPicker = {
    renderLanguages,
    renderSelectedLangs,
    toggleLanguage,
    removeLanguage,
    init: initDubbingLangPicker,
  };
})(window);
