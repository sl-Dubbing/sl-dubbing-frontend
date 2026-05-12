// js/tts.js — Fixed API Connection, UI Arrows & Language Menu Compatibility
// يتوافق مع window.LANGUAGES من languages-data.js

document.addEventListener('DOMContentLoaded', () => {
    let currentLangCode = 'en-us';
    let currentAudio = null;

    // ═══════════════════════════════════════════════════════════════
    // 1) بناء window.LANG_MENU ديناميكياً من window.LANGUAGES
    // ═══════════════════════════════════════════════════════════════
    if (window.LANGUAGES && !window.LANG_MENU) {
        window.LANG_MENU = [];
        const families = {};

        // تجميع اللغات حسب عائلتها (en, es, fr, ...)
        window.LANGUAGES.forEach(l => {
            const family = l.code.split('-')[0];
            if (!families[family]) families[family] = [];
            families[family].push(l);
        });

        // بناء القائمة: لغة وحيدة = عنصر مباشر، متعددة = قائمة فرعية
        Object.keys(families).forEach(family => {
            const langs = families[family];
            if (langs.length === 1) {
                window.LANG_MENU.push({
                    code: langs[0].code,
                    name: langs[0].name_en,
                    flag: langs[0].flag,
                    hasSub: false
                });
            } else {
                // استخدام الاسم الأساسي قبل الأقواس كاسم للعائلة
                const familyName = langs[0].name_en.split('(')[0].trim();
                window.LANG_MENU.push({
                    name: familyName,       // مثلاً "English"
                    icon: langs[0].flag,    // 🇺🇸
                    hasSub: true,
                    items: langs.map(l => ({
                        code: l.code,
                        name: l.name_en,
                        flag: l.flag
                    }))
                });
            }
        });
    }

    // ═══════════════════════════════════════════════════════════════
    // 2) Fallback إذا لم تُحمّل البيانات
    // ═══════════════════════════════════════════════════════════════
    if (!window.LANG_MENU) {
        console.warn('[tts.js] LANGUAGES data not loaded, using fallback');
        window.LANG_MENU = [
            { code: 'en-us', name: 'English (US)', flag: '🇺🇸', hasSub: false },
            { code: 'ar',    name: 'Arabic',       flag: '🌍', hasSub: false },
            { code: 'es-es', name: 'Spanish',      flag: '🇪🇸', hasSub: false },
            { code: 'fr-fr', name: 'French',       flag: '🇫🇷', hasSub: false },
            { code: 'de-de', name: 'German',       flag: '🇩🇪', hasSub: false },
        ];
    }

    // ═══════════════════════════════════════════════════════════════
    // 3) بناء قائمة اللغات في DOM
    // ═══════════════════════════════════════════════════════════════
    const menuEl = document.getElementById('langMenu');
    if (menuEl && window.LANG_MENU) {
        window.LANG_MENU.forEach(item => {
            const li = document.createElement('li');
            li.style.padding = '10px 15px';
            li.style.cursor = 'pointer';

            if (item.hasSub) {
                li.className = 'has-submenu';
                // ✅ تم إصلاح السهم ليتجه لليمين (English UI)
                li.innerHTML = `<span>${item.icon} ${item.name}</span> <i class="fas fa-chevron-right" style="opacity: 0.5; font-size: 0.8rem;"></i>`;
                const subUl = document.createElement('ul');
                subUl.className = 'submenu';
                item.items.forEach(sub => {
                    const subLi = document.createElement('li');
                    subLi.style.padding = '10px 15px';
                    subLi.innerHTML = `<span>${sub.flag} ${sub.name}</span>`;
                    subLi.onclick = (e) => {
                        e.stopPropagation();
                        selectLang(sub.code, `${item.name} (${sub.name})`, sub.flag);
                    };
                    subUl.appendChild(subLi);
                });
                li.appendChild(subUl);
            } else {
                li.innerHTML = `<span>${item.flag} ${item.name}</span>`;
                li.onclick = (e) => {
                    e.stopPropagation();
                    selectLang(item.code, item.name, item.flag);
                };
            }
            menuEl.appendChild(li);
        });
    }

    // ═══════════════════════════════════════════════════════════════
    // 4) اختيار اللغة — مع defensive programming
    // ═══════════════════════════════════════════════════════════════
    function selectLang(code, name, flag) {
        currentLangCode = code;
        const displayEl = document.getElementById('langSelected');
        if (displayEl) {
            displayEl.innerHTML = `<div><span class="flag">${flag}</span> <span style="margin-left:8px;">${name}</span></div> <i class="fas fa-chevron-down"></i>`;
        }
        const dropdownEl = document.getElementById('langDropdown');
        if (dropdownEl) dropdownEl.classList.remove('open');
    }

    // ═══════════════════════════════════════════════════════════════
    // 5) فتح/إغلاق القائمة المنسدلة — مع defensive programming
    // ═══════════════════════════════════════════════════════════════
    const langSelectedEl = document.getElementById('langSelected');
    const langDropdownEl = document.getElementById('langDropdown');

    if (langSelectedEl && langDropdownEl) {
        langSelectedEl.onclick = (e) => {
            e.stopPropagation();
            langDropdownEl.classList.toggle('open');
        };
        document.addEventListener('click', () => langDropdownEl.classList.remove('open'));
    } else {
        console.warn('[tts.js] langSelected or langDropdown element not found');
    }

    // ═══════════════════════════════════════════════════════════════
    // 6) AI Proofread — مع defensive programming
    // ═══════════════════════════════════════════════════════════════
    const ttsFixBtn = document.getElementById('ttsFixBtn');
    const ttsInput  = document.getElementById('ttsInput');

    if (ttsFixBtn && ttsInput) {
        ttsFixBtn.onclick = async () => {
            const text = ttsInput.value.trim();
            if (!text) return;
            const oldIcon = ttsFixBtn.innerHTML;
            ttsFixBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

            try {
                const token = localStorage.getItem('token');
                const res = await fetch(`${window.API_BASE}/api/improve-text`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': token ? `Bearer ${token}` : ''
                    },
                    body: JSON.stringify({
                        text: text,
                        lang: currentLangCode.split('-')[0]
                    })
                });
                const data = await res.json();
                if (data.status === 'success' || data.fixed_text) {
                    ttsInput.value = data.fixed_text || data.text;
                    if (window.showToast) window.showToast('Text improved', 'success');
                }
            } catch (e) {
                console.error('[tts.js] Proofread error:', e);
            } finally {
                ttsFixBtn.innerHTML = oldIcon;
            }
        };
    }

    // ═══════════════════════════════════════════════════════════════
    // 7) Audio Processing — مع defensive programming
    // ═══════════════════════════════════════════════════════════════
    const ttsPlayBtn     = document.getElementById('ttsPlayBtn');
    const ttsStopBtn     = document.getElementById('ttsStopBtn');
    const ttsDownloadBtn = document.getElementById('ttsDownloadBtn');
    const speedSlider    = document.getElementById('speedSlider');
    const speedVal       = document.getElementById('speedVal');
    const charCount      = document.getElementById('charCount');

    async function processTTS(isDownload = false) {
        if (!ttsInput) {
            if (window.showToast) window.showToast('Input element missing', 'error');
            return;
        }
        const textToRead = isDownload
            ? ttsInput.value.trim()
            : (ttsInput.value.substring(ttsInput.selectionStart).trim() || ttsInput.value.trim());

        if (!textToRead) {
            if (window.showToast) window.showToast('Please enter text first', 'error');
            return;
        }

        const btn      = isDownload ? ttsDownloadBtn : ttsPlayBtn;
        const oldHtml  = btn ? btn.innerHTML : '';
        if (btn) btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

        const slider = speedSlider || { value: 0 };
        const v      = slider.value || 0;
        const rate   = v == 0 ? '+0%' : (v > 0 ? `+${v}%` : `${v}%`);

        try {
            if (typeof window.quickTTS !== 'function') throw new Error('TTS Engine not loaded.');

            const result = await window.quickTTS(textToRead, {
                lang: currentLangCode,
                rate: rate
            });

            if (isDownload) {
                const a = document.createElement('a');
                a.href = result.url;
                a.download = 'voice.mp3';
                a.click();
            } else {
                if (currentAudio) currentAudio.pause();
                currentAudio = result.audio;
                if (ttsPlayBtn) ttsPlayBtn.style.display = 'none';
                if (ttsStopBtn) ttsStopBtn.style.display = 'flex';
                currentAudio.play();
                currentAudio.onended = () => {
                    // استدعاء معالج الإيقاف إذا وُجد
                    if (ttsStopBtn && ttsPlayBtn) {
                        if (currentAudio) currentAudio.pause();
                        ttsStopBtn.style.display = 'none';
                        ttsPlayBtn.style.display = 'flex';
                    }
                };
            }
        } catch (e) {
            if (window.showToast) window.showToast(e.message, 'error');
        } finally {
            if (btn) btn.innerHTML = oldHtml;
        }
    }

    // ربط أزرار التشغيل والتنزيل والإيقاف — مع فحص وجود العناصر
    if (ttsPlayBtn)     ttsPlayBtn.onclick     = () => processTTS(false);
    if (ttsDownloadBtn) ttsDownloadBtn.onclick = () => processTTS(true);

    if (ttsStopBtn && ttsPlayBtn) {
        ttsStopBtn.onclick = () => {
            if (currentAudio) currentAudio.pause();
            ttsStopBtn.style.display = 'none';
            ttsPlayBtn.style.display = 'flex';
        };
    }

    // ═══════════════════════════════════════════════════════════════
    // 8) أوضاع العرض + عداد الحروف + شريط السرعة — defensive
    // ═══════════════════════════════════════════════════════════════
    document.querySelectorAll('.mode-option').forEach(opt => {
        opt.onclick = () => {
            document.querySelectorAll('.mode-option').forEach(o => o.classList.remove('active'));
            opt.classList.add('active');
        };
    });

    if (ttsInput && charCount) {
        ttsInput.oninput = (e) => { charCount.innerText = e.target.value.length; };
    }

    if (speedSlider && speedVal) {
        speedSlider.oninput = (e) => {
            const v = e.target.value;
            speedVal.innerText = v == 0 ? 'Normal' : (v > 0 ? `+${v}%` : `${v}%`);
        };
    }
});
