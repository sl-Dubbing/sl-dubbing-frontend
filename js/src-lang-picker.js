// # FILE frontend/sl-dubbing-frontend-main/js/src-lang-picker.js
// # AR JavaScript — src-lang-picker
// # KW لغة,language
// # CONVENTION — FN/AR/KW + # block كل ~6 أسطر — FUNCTION_INDEX.md DOMAIN_INDEX.md
// js/src-lang-picker.js — Single source language picker (flags + languages.js)
(function () {
    'use strict';

    const STORAGE_KEY = 'glotix_src_lang_code';
    let srcLangSearchDebounceTimer = null;
    let selectedCode = '';
    try {
        selectedCode = localStorage.getItem(STORAGE_KEY) || '';
    } catch (_) {}
    window.selectedSrcLang = selectedCode;

    // # FN getFlagImg
    // # KW لغة,language,dialect
    function getFlagImg(code) {
        let country = code.split('-')[1];
        // # شرط — فرع منطقي
        if (!country) {
            const defaultMap = window.LANG_FLAG_COUNTRY || {
                ar: 'sa', en: 'us', fr: 'fr', es: 'es', pt: 'pt', zh: 'cn',
                de: 'de', it: 'it', ru: 'ru', tr: 'tr', ja: 'jp', ko: 'kr',
                // # block — معالجة أخطاء
                hi: 'in', nl: 'nl', pl: 'pl', sv: 'se', id: 'id',
                bg: 'bg', hr: 'hr', cs: 'cz', da: 'dk', fil: 'ph', fi: 'fi',
                el: 'gr', hu: 'hu', ms: 'my', no: 'no', ro: 'ro', sk: 'sk',
                ta: 'in', uk: 'ua', vi: 'vn',
            };
            country = defaultMap[code.split('-')[0]] || 'xx';
        // # block — معالجة أخطاء
        }
        return (
            `<span class="lang-flag-shell" style="--flag-size:22px">` +
            `<img class="lang-flag" src="https://hatscripts.github.io/circle-flags/flags/${country.toLowerCase()}.svg" alt=""></span>`
        );
    }

    /** Full source code (e.g. ar-ma) so dialect is preserved for STT + translation */
    window.getSelectedSourceLanguage = function getSelectedSourceLanguage() {
        // # return — إرجاع النتيجة
        return selectedCode || '';
    };

    window.getSelectedSourceDialect = function getSelectedSourceDialect() {
        // # guard — شرط رفض أو خروج مبكر
        if (!selectedCode || !window.LANGUAGES) return '';
        const lang = window.LANGUAGES.find((l) => l.code === selectedCode);
        // # guard — شرط رفض أو خروج مبكر
        if (lang?.dialect) return lang.dialect;
        const cfg = window.getLanguageConfig?.(selectedCode);
        // # return — إرجاع النتيجة
        return cfg?.dialect || '';
    };

    // # FN updateTriggerUI
    // # KW لغة,language,dialect
    function updateTriggerUI() {
        const flagEl = document.getElementById('srcLangFlag');
        const labelEl = document.getElementById('srcLangLabel');
        // # guard — شرط رفض أو خروج مبكر
        if (!flagEl || !labelEl) return;

        // # شرط — فرع منطقي
        if (!selectedCode || !window.LANGUAGES) {
            flagEl.innerHTML = '<i class="fa-solid fa-globe" style="font-size:1.1rem;color:#6b7280;"></i>';
            // # block — تحديث واجهة/DOM
            labelEl.textContent = 'Select source language *';
            labelEl.style.color = 'var(--text-muted)';
            // # return — إرجاع النتيجة
            return;
        }

        const lang = window.LANGUAGES.find((l) => l.code === selectedCode);
        // # شرط — فرع منطقي
        if (!lang) {
            // # block — تحديث واجهة/DOM
            selectedCode = '';
            window.selectedSrcLang = '';
            updateTriggerUI();
            // # return — إرجاع النتيجة
            return;
        }

        flagEl.innerHTML = getFlagImg(lang.code);
        // # block — تنفيذ منطق — راجع الأسطر التالية
        labelEl.textContent = lang.name_en;
        labelEl.style.color = 'var(--text-main)';
        document.getElementById('srcLangTrigger')?.classList.remove('invalid');
        document.getElementById('srcLangTrigger')?.classList.remove('needs-attention');
    }

    // # FN selectSrcLanguage
    // # AR اللغات واللهجات (selectSrcLanguage)
    // # KW لغة,language,dialect
    function selectSrcLanguage(code) {
        selectedCode = code;
        window.selectedSrcLang = code;
        // # try — معالجة عملية قد تفشل
        try {
            // # localStorage — تخزين محلي
            localStorage.setItem(STORAGE_KEY, code);
        } catch (_) {}
        // # block — تحديث واجهة/DOM
        updateTriggerUI();
        renderSrcLanguages(document.getElementById('srcLangSearch')?.value || '');
        document.getElementById('srcLangTrigger')?.classList.remove('active');
        document.getElementById('srcLangTrigger')?.classList.remove('needs-attention');
    }

    // # FN renderSrcLanguages
    // # KW لغة,language,dialect
    function renderSrcLanguages(filter) {
        const container = document.getElementById('srcLangList');
        // # guard — شرط رفض أو خروج مبكر
        if (!container || !window.LANGUAGES) return;

        const f = (filter || '').toLowerCase().trim();
        const filtered = window.LANGUAGES.filter((l) => {
            // # guard — شرط رفض أو خروج مبكر
            if (!f) return true;
            // # return — إرجاع النتيجة
            return (
                l.name_en.toLowerCase().includes(f) ||
                l.name_ar.includes(f) ||
                l.code.toLowerCase().includes(f) ||
                (l.base_lang && l.base_lang.toLowerCase().includes(f))
            );
        // # block — تنفيذ منطق — راجع الأسطر التالية
        });

        // Selected pinned to top; rest = global A–Z English order (languages.js).
        filtered.sort((a, b) => {
            const aSel = a.code === selectedCode;
            const bSel = b.code === selectedCode;
            // # guard — رفض/خروج
            if (aSel && !bSel) return -1;
            // # guard — رفض/خروج
            if (!aSel && bSel) return 1;
            // # block — فرع شرطي
            return typeof window.compareLanguagesGlobal === 'function'
                ? window.compareLanguagesGlobal(a, b)
                : 0;
        });

        container.innerHTML =
            (() => {
                // # guard — رفض/خروج
                if (!filtered.length) {
                    return '<div class="lang-empty">No results found</div>';
                }
                const sections = [];
                let cur = null;
                for (const l of filtered) {
                    // # block — حلقة/تكرار
                    const g = l.group || l.name_en || l.base_lang || 'Other';
                    // # شرط
                    if (!cur || cur.title !== g) {
                        cur = { title: g, items: [] };
                        sections.push(cur);
                    }
                    cur.items.push(l);
                // # block — فرع شرطي
                }
                return sections
                    .map((sec) => {
                        const showHead =
                            sec.items.length > 1 || String(sec.items[0]?.code || '').includes('-');
                        const head = showHead
                            // # block — حلقة/تكرار
                            ? `<div class="lang-section-label">${sec.title}</div>`
                            : '';
                        return (
                            head +
                            sec.items
                                .map(
                                    // # block — حلقة/تكرار
                                    (l) =>
                                        `<div class="lang-item ${l.popular ? 'popular' : ''} ${
                                            l.code === selectedCode ? 'selected' : ''
                                        } ${String(l.code).includes('-') ? 'is-locale' : ''}" data-code="${l.code}">` +
                                        getFlagImg(l.code) +
                                        `<div class="lang-info"><div class="lang-en">${l.name_en}</div></div></div>`
                                // # block — تنفيذ منطق — راجع الأسطر التالية
                                )
                                .join('')
                        );
                    })
                    .join('');
            })();

        // # block — تنفيذ منطق — راجع الأسطر التالية
        container.querySelectorAll('.lang-item').forEach((el) => {
            el.addEventListener('click', () => selectSrcLanguage(el.dataset.code));
        });
    }

    window.toggleSrcLangDropdown = function toggleSrcLangDropdown(event) {
        event.stopPropagation();
        const trigger = document.getElementById('srcLangTrigger');
        const opening = !trigger?.classList.contains('active');
        window.closeAllSiteDropdowns?.();
        if (opening) trigger?.classList.add('active');
    };

    // # FN initSrcLangPicker
    // # AR init src lang picker (initSrcLangPicker)
    // # KW لغة,language,dialect
    function initSrcLangPicker() {
        // # guard — شرط رفض أو خروج مبكر
        if (!window.LANGUAGES) {
            setTimeout(initSrcLangPicker, 100);
            // # return — إرجاع النتيجة
            return;
        }
        // # شرط — فرع منطقي
        if (selectedCode && !window.LANGUAGES.some((l) => l.code === selectedCode)) {
            // # block — فرع شرطي
            selectedCode = '';
            window.selectedSrcLang = '';
        }
        // # شرط — فرع منطقي
        if (!selectedCode) {
            // # try — معالجة عملية قد تفشل
            try {
                // # localStorage — تخزين محلي
                const legacy = localStorage.getItem('glotix_src_lang');
                // # شرط — فرع منطقي
                if (legacy && window.LANGUAGES) {
                    const match = window.LANGUAGES.find((l) => l.code === legacy)
                        || window.LANGUAGES.find((l) => l.base_lang === legacy && l.popular)
                        || window.LANGUAGES.find((l) => l.base_lang === legacy);
                    // # شرط — فرع منطقي
                    if (match) {
                        selectedCode = match.code;
                        // # block — فرع شرطي
                        window.selectedSrcLang = selectedCode;
                        // # localStorage — تخزين محلي
                        localStorage.setItem(STORAGE_KEY, selectedCode);
                    }
                }
            } catch (_) {}
        }
        // # block — تحديث واجهة/DOM
        renderSrcLanguages();
        updateTriggerUI();
        const search = document.getElementById('srcLangSearch');
        // # شرط — فرع منطقي
        if (search) {
            search.addEventListener('input', (e) => {
                clearTimeout(srcLangSearchDebounceTimer);
                // # block — تحديث واجهة/DOM
                srcLangSearchDebounceTimer = setTimeout(() => renderSrcLanguages(e.target.value), 150);
            });
        }
    }

    // # شرط — فرع منطقي
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initSrcLangPicker);
    } else {
        initSrcLangPicker();
    }
    document.addEventListener('glotix:languages-ready', () => initSrcLangPicker());

    window.renderSrcLanguages = renderSrcLanguages;
    window.updateSrcLangTriggerUI = updateTriggerUI;
})();
