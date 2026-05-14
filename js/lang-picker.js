// js/lang-picker.js — Fixed Flags for Windows (Image based - HeyGen Style)
(function() {
    'use strict';

    const STORAGE_KEY = window.LANG_STORAGE_KEY || 'selected_langs';
    let selected = new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) || '["en-us"]'));
    window.selectedLangs = selected;

    // ── دالة ذكية لتحويل كود اللغة إلى صورة علم دائري ──
    function getFlagImg(code) {
        let country = code.split('-')[1];
        // إذا لم يكن هناك كود دولة (مثل ar)، نستخدم خريطة افتراضية
        if (!country) {
            const defaultMap = { 'ar':'sa', 'en':'us', 'fr':'fr', 'es':'es', 'pt':'pt', 'zh':'cn', 'de':'de', 'it':'it', 'ru':'ru', 'tr':'tr', 'ja':'jp', 'ko':'kr', 'hi':'in', 'nl':'nl', 'pl':'pl', 'sv':'se', 'id':'id', 'fa':'ir', 'ur':'pk' };
            country = defaultMap[code.split('-')[0]] || 'xx';
        }
        // جلب العلم بصيغة SVG من مكتبة الأعلام الدائرية المفتوحة
        return `<img src="https://hatscripts.github.io/circle-flags/flags/${country.toLowerCase()}.svg" style="width: 22px; height: 22px; border-radius: 50%; object-fit: cover; flex-shrink: 0; box-shadow: 0 1px 3px rgba(0,0,0,0.1);" alt="flag">`;
    }

    function renderLanguages(filter) {
        filter = filter || '';
        const container = document.getElementById('langList');
        const langCount = document.getElementById('langCountBadge');
        if (!container || !window.LANGUAGES) return;

        const f = filter.toLowerCase().trim();
        const filtered = window.LANGUAGES.filter(l => {
            if (!f) return true;
            return l.name_en.toLowerCase().includes(f) || 
                   l.name_ar.toLowerCase().includes(f) || 
                   l.code.toLowerCase().includes(f);
        });

        // ترتيب أبجدي إنجليزي
        filtered.sort((a, b) => {
            const aS = selected.has(a.code), bS = selected.has(b.code);
            if (aS && !bS) return -1;
            if (!aS && bS) return 1;
            if (a.popular && !b.popular) return -1;
            if (!a.popular && b.popular) return 1;
            return a.name_en.localeCompare(b.name_en, 'en');
        });

        if (langCount) langCount.textContent = filtered.length;

        // بناء قائمة اللغات مع الأعلام الدائرية الجديدة
        container.innerHTML = filtered.map(l => `
            <div class="lang-item ${l.popular ? 'popular' : ''} ${selected.has(l.code) ? 'selected' : ''}" data-code="${l.code}">
                ${getFlagImg(l.code)}
                <div class="lang-info" style="flex-grow: 1;">
                    <div class="lang-en" style="font-weight: 500; color: var(--text-main); font-size: 0.95rem;">${l.name_en}</div>
                </div>
            </div>
        `).join('') || '<div style="text-align:center;padding:30px;color:#9ca3af;font-size:0.9rem;">No results found</div>';

        container.querySelectorAll('.lang-item').forEach(el => {
            el.addEventListener('click', () => toggleLanguage(el.dataset.code));
        });
    }

    function toggleLanguage(code) {
        if (selected.has(code)) {
            if (selected.size > 1) selected.delete(code);
            else { window.showToast?.('Select at least one language', 'error'); return; }
        } else {
            if (selected.size >= 10) { window.showToast?.('Maximum 10 languages allowed', 'error'); return; }
            selected.add(code);
        }
        localStorage.setItem(STORAGE_KEY, JSON.stringify([...selected]));
        renderSelectedLangs();
        renderLanguages(document.getElementById('langSearch')?.value || '');
    }

    function removeLanguage(code) {
        if (selected.size <= 1) { window.showToast?.('Keep at least one language', 'error'); return; }
        selected.delete(code);
        localStorage.setItem(STORAGE_KEY, JSON.stringify([...selected]));
        renderSelectedLangs();
        renderLanguages(document.getElementById('langSearch')?.value || '');
    }

    function renderSelectedLangs() {
        const display = document.getElementById('selectedLangsDisplay');
        if (!display) return;
        if (selected.size === 0) {
            display.innerHTML = '<div class="selected-langs-empty">No language selected yet</div>';
            return;
        }
        if (!window.LANGUAGES) return;
        
        // بناء اللغات المختارة (Pills) بالأعلام الدائرية وتصميم HeyGen
        const pills = [...selected].map(code => {
            const l = window.LANGUAGES.find(x => x.code === code);
            if (!l) return '';
            return `
            <div class="lang-pill" data-code="${code}" style="display:inline-flex; align-items:center; gap:8px; background:#f3f4f6; border:1px solid #e5e7eb; padding:4px 10px 4px 6px; border-radius:20px; font-size:0.85rem; cursor:pointer; color:#374151; font-weight:500; transition:0.2s;">
                ${getFlagImg(code)}
                <span>${l.name_en}</span>
                <span class="remove-icon" style="color:#9ca3af; margin-left:4px; font-size:0.8rem;">✕</span>
            </div>`;
        }).join('');
        
        display.innerHTML = `<div class="selected-langs-pills" style="display:flex; flex-wrap:wrap; gap:8px;">${pills}</div>`;
        
        display.querySelectorAll('.lang-pill').forEach(el => {
            el.addEventListener('click', () => removeLanguage(el.dataset.code));
            el.addEventListener('mouseenter', () => el.style.background = '#e5e7eb');
            el.addEventListener('mouseleave', () => el.style.background = '#f3f4f6');
        });
    }

    function initLangPicker() {
        if (!window.LANGUAGES) { setTimeout(initLangPicker, 100); return; }
        renderLanguages();
        renderSelectedLangs();
        const search = document.getElementById('langSearch');
        if (search) search.addEventListener('input', (e) => renderLanguages(e.target.value));
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initLangPicker);
    else initLangPicker();

    window.renderLanguages = renderLanguages;
    window.renderSelectedLangs = renderSelectedLangs;
    window.toggleLanguage = toggleLanguage;
    window.removeLanguage = removeLanguage;
})();
