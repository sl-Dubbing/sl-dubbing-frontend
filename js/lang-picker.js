// lang-picker.js — منتقي اللغات المتعدد (مشترك بين dubbing & tts)
// يحفظ اللغات في window.selectedLangs

(function() {
    'use strict';

    const STORAGE_KEY = window.LANG_STORAGE_KEY || 'selected_langs';
    let selected = new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) || '["ar"]'));
    window.selectedLangs = selected;

    function renderLanguages(filter) {
        filter = filter || '';
        const container = document.getElementById('langList');
        const langCount = document.getElementById('langCount');
        if (!container || !window.LANGUAGES) return;

        const f = filter.toLowerCase().trim();
        const filtered = window.LANGUAGES.filter(l => {
            if (!f) return true;
            return l.name_ar.toLowerCase().includes(f) || 
                   l.name_en.toLowerCase().includes(f) || 
                   l.code.toLowerCase().includes(f);
        });

        filtered.sort((a, b) => {
            const aS = selected.has(a.code), bS = selected.has(b.code);
            if (aS && !bS) return -1;
            if (!aS && bS) return 1;
            if (a.popular && !b.popular) return -1;
            if (!a.popular && b.popular) return 1;
            return a.name_ar.localeCompare(b.name_ar, 'ar');
        });

        if (langCount) {
            langCount.textContent = `${filtered.length} لغة` + (filter ? ' (تصفية)' : '');
        }

        container.innerHTML = filtered.map(l => `
            <div class="lang-item ${l.popular ? 'popular' : ''} ${selected.has(l.code) ? 'selected' : ''}" data-code="${l.code}">
                <div class="checkbox"></div>
                <div class="flag">${l.flag}</div>
                <div class="lang-info">
                    <div class="lang-ar">${l.name_ar}</div>
                    <div class="lang-en">${l.name_en}</div>
                </div>
            </div>
        `).join('') || '<div style="text-align:center;padding:30px;color:#9aa1ac;">لا نتائج</div>';

        container.querySelectorAll('.lang-item').forEach(el => {
            el.addEventListener('click', () => toggleLanguage(el.dataset.code));
        });
    }

    function toggleLanguage(code) {
        if (selected.has(code)) {
            if (selected.size > 1) selected.delete(code);
            else { 
                window.showToast?.('يجب اختيار لغة واحدة على الأقل', '#f59e0b'); 
                return; 
            }
        } else {
            if (selected.size >= 10) { 
                window.showToast?.('الحد الأقصى 10 لغات', '#ef4444'); 
                return; 
            }
            selected.add(code);
        }
        localStorage.setItem(STORAGE_KEY, JSON.stringify([...selected]));
        renderSelectedLangs();
        renderLanguages(document.getElementById('langSearch')?.value || '');
        updateMiniSummary();
    }

    function removeLanguage(code) {
        if (selected.size <= 1) { 
            window.showToast?.('يجب الإبقاء على لغة', '#f59e0b'); 
            return; 
        }
        selected.delete(code);
        localStorage.setItem(STORAGE_KEY, JSON.stringify([...selected]));
        renderSelectedLangs();
        renderLanguages(document.getElementById('langSearch')?.value || '');
        updateMiniSummary();
    }

    function renderSelectedLangs() {
        const display = document.getElementById('selectedLangsDisplay');
        if (!display) return;
        if (selected.size === 0) {
            display.innerHTML = '<div class="selected-langs-empty">لم يتم اختيار لغة بعد</div>';
            return;
        }
        if (!window.LANGUAGES) return;
        const pills = [...selected].map(code => {
            const l = window.LANGUAGES.find(x => x.code === code);
            if (!l) return '';
            return `<div class="lang-pill" data-code="${code}"><span>${l.flag}</span><span>${l.name_ar}</span><span class="remove-icon">✕</span></div>`;
        }).join('');
        display.innerHTML = `<div class="selected-langs-pills">${pills}</div>`;
        display.querySelectorAll('.lang-pill').forEach(el => {
            el.addEventListener('click', () => removeLanguage(el.dataset.code));
        });
    }

    function updateMiniSummary() {
        const el = document.getElementById('miniLangs');
        if (!el || !window.LANGUAGES) return;
        if (selected.size === 0) { 
            el.textContent = 'لم تُختر بعد'; 
            return; 
        }
        const names = [...selected].slice(0, 3).map(c => window.LANGUAGES.find(l => l.code === c)?.name_ar || c);
        let txt = names.join('، ');
        if (selected.size > 3) txt += ` +${selected.size - 3}`;
        el.textContent = txt;
    }

    function initLangPicker() {
        // Wait for LANGUAGES to be available
        if (!window.LANGUAGES) {
            setTimeout(initLangPicker, 100);
            return;
        }
        renderLanguages();
        renderSelectedLangs();
        updateMiniSummary();
        const search = document.getElementById('langSearch');
        if (search) search.addEventListener('input', (e) => renderLanguages(e.target.value));
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initLangPicker);
    } else {
        initLangPicker();
    }

    window.renderLanguages = renderLanguages;
    window.renderSelectedLangs = renderSelectedLangs;
    window.toggleLanguage = toggleLanguage;
    window.removeLanguage = removeLanguage;
})();
