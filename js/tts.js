// ==========================================
// 🎨 tts.js — multi-lang + parallel + sidebar
// uses addEventListener (more reliable)
// ==========================================

const SAMPLES_BASE = 'samples';

// ==========================================
// 🌍 إدارة اللغات (متعدد)
// ==========================================
let selectedLangs = new Set(JSON.parse(localStorage.getItem('tts_langs') || '["ar"]'));

function renderLanguages(filter) {
    filter = filter || '';
    const container = document.getElementById('langList');
    const langCount = document.getElementById('langCount');
    if (!container) {
        console.error('❌ langList element not found');
        return;
    }
    if (!window.LANGUAGES) {
        console.error('❌ LANGUAGES array not available');
        container.innerHTML = '<div style="text-align:center; padding:20px; color:#ef4444;">خطأ: لم يتم تحميل قائمة اللغات. تأكد من رفع js/languages-data.js</div>';
        return;
    }

    const filterLower = filter.toLowerCase().trim();
    const filtered = window.LANGUAGES.filter(l => {
        if (!filterLower) return true;
        return (
            l.name_ar.toLowerCase().includes(filterLower) ||
            l.name_en.toLowerCase().includes(filterLower) ||
            l.code.toLowerCase().includes(filterLower)
        );
    });

    filtered.sort((a, b) => {
        const aSel = selectedLangs.has(a.code);
        const bSel = selectedLangs.has(b.code);
        if (aSel && !bSel) return -1;
        if (!aSel && bSel) return 1;
        if (a.popular && !b.popular) return -1;
        if (!a.popular && b.popular) return 1;
        return 0;
    });

    if (langCount) {
        langCount.textContent = `${filtered.length} لغة` + (filter ? ' (تصفية)' : '');
    }

    container.innerHTML = filtered.map(l => `
        <div class="lang-item ${l.popular ? 'popular' : ''} ${selectedLangs.has(l.code) ? 'selected' : ''}"
             data-code="${l.code}">
            <div class="checkbox"></div>
            <div class="flag">${l.flag}</div>
            <div class="lang-info">
                <div class="lang-ar">${l.name_ar}</div>
                <div class="lang-en">${l.name_en}</div>
            </div>
        </div>
    `).join('') || '<div style="text-align:center;padding:30px;color:#9aa1ac;">لم يُعثر على نتائج</div>';

    // ربط click event على كل lang-item (delegation أكثر أماناً من inline onclick)
    container.querySelectorAll('.lang-item').forEach(el => {
        el.addEventListener('click', () => {
            const code = el.dataset.code;
            if (code) toggleLanguage(code);
        });
    });
}

function toggleLanguage(code) {
    console.log(`Toggle language: ${code}`);
    if (selectedLangs.has(code)) {
        if (selectedLangs.size > 1) {
            selectedLangs.delete(code);
        } else {
            showToast('يجب اختيار لغة واحدة على الأقل', 'warning');
            return;
        }
    } else {
        if (selectedLangs.size >= 10) {
            showToast('الحد الأقصى 10 لغات', 'error');
            return;
        }
        selectedLangs.add(code);
    }
    localStorage.setItem('tts_langs', JSON.stringify([...selectedLangs]));
    renderSelectedLangs();
    const search = document.getElementById('langSearch');
    renderLanguages(search ? search.value : '');
}

function removeLanguage(code) {
    if (selectedLangs.size <= 1) {
        showToast('يجب الإبقاء على لغة واحدة على الأقل', 'warning');
        return;
    }
    selectedLangs.delete(code);
    localStorage.setItem('tts_langs', JSON.stringify([...selectedLangs]));
    renderSelectedLangs();
    const search = document.getElementById('langSearch');
    renderLanguages(search ? search.value : '');
}

function renderSelectedLangs() {
    const display = document.getElementById('selectedLangsDisplay');
    if (!display) return;

    if (selectedLangs.size === 0) {
        display.innerHTML = '<div class="selected-langs-empty">لم يتم اختيار لغة بعد</div>';
        return;
    }

    if (!window.LANGUAGES) {
        display.innerHTML = '<div class="selected-langs-empty">خطأ في تحميل البيانات</div>';
        return;
    }

    const pills = [...selectedLangs].map(code => {
        const lang = window.LANGUAGES.find(l => l.code === code);
        if (!lang) return '';
        return `<div class="lang-pill" data-code="${code}" title="إزالة">
                    <span>${lang.flag}</span>
                    <span>${lang.name_ar}</span>
                    <span class="remove-icon">✕</span>
                </div>`;
    }).join('');

    display.innerHTML = `<div class="selected-langs-pills">${pills}</div>`;

    // ربط click على كل pill
    display.querySelectorAll('.lang-pill').forEach(el => {
        el.addEventListener('click', () => {
            const code = el.dataset.code;
            if (code) removeLanguage(code);
        });
    });
}

// ==========================================
// 🟢 Sidebar
// ==========================================
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;
    if (sidebar.classList.contains('active')) {
        closeSidebar();
    } else {
        openSidebar();
    }
}

function openSidebar() {
    document.getElementById('sidebar')?.classList.add('active');
    document.getElementById('overlay')?.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeSidebar() {
    document.getElementById('sidebar')?.classList.remove('active');
    document.getElementById('overlay')?.classList.remove('active');
    document.body.style.overflow = '';
}

// ==========================================
// 🟢 Toasts
// ==========================================
function showToast(msg, type) {
    const t = document.getElementById('toasts');
    if (!t) return;
    const box = document.createElement('div');
    box.className = 'toast';
    box.innerText = msg;
    if (type === 'error') box.style.background = '#ef4444';
    else if (type === 'success') box.style.background = '#10b981';
    else if (type === 'warning') box.style.background = '#f59e0b';
    t.appendChild(box);
    setTimeout(() => box.remove(), 4000);
}

// ==========================================
// 🔧 المصادقة
// ==========================================
async function updateSidebarAuth() {
    const authSection = document.getElementById('authSection');
    if (!authSection) return;
    const token = localStorage.getItem('token');

    if (!token) {
        authSection.innerHTML = `
            <div class="user-info-card">
                <p style="margin-bottom:12px; font-size:0.9rem; color:#5b6471;">أهلاً بك في sl-Dubbing</p>
                <a href="login.html" class="btn-login-sidebar">تسجيل الدخول</a>
            </div>`;
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/api/user`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.success || data.user) {
            const user = data.user || {};
            authSection.innerHTML = `
                <div class="user-info-card">
                    <div class="user-name">${user.name || 'مستخدم'}</div>
                    <div class="user-points">رصيدك: ${user.credits ?? 0} نقطة</div>
                    <button id="logoutBtn" style="margin-top:10px; background:none; border:none; color:#ef4444; cursor:pointer; font-size:0.82rem; font-weight:600;">تسجيل الخروج</button>
                </div>`;
            document.getElementById('logoutBtn')?.addEventListener('click', logout);
        }
    } catch (e) {
        localStorage.removeItem('token');
        authSection.innerHTML = `<a href="login.html" class="btn-login-sidebar">تسجيل الدخول مجدداً</a>`;
    }
}

function logout() {
    localStorage.removeItem('token');
    location.reload();
}

// ==========================================
// 🎙️ العينات
// ==========================================
async function renderSampleVoices() {
    const select = document.getElementById('voiceSelect');
    if (!select) return;

    select.innerHTML = '<option value="">🎤 اختر عينة جاهزة</option>';

    try {
        const res = await fetch(`${SAMPLES_BASE}/manifest.json?t=${Date.now()}`);
        if (!res.ok) throw new Error('manifest.json not found');
        const data = await res.json();
        const voices = Array.isArray(data.voices) ? data.voices : [];
        voices.forEach(v => {
            const opt = document.createElement('option');
            opt.value = v.id;
            opt.textContent = `${v.icon || '🎤'} ${v.label || v.id}`;
            opt.dataset.file = v.file || `${v.id}.mp3`;
            select.appendChild(opt);
        });
    } catch (e) {
        console.warn('manifest.json failed:', e);
    }
}

function handleCustomVoice(input) {
    const txt = document.getElementById('customVoiceTxt');
    const voiceSelect = document.getElementById('voiceSelect');
    if (input.files && input.files[0]) {
        if (txt) {
            txt.innerText = '✓ تم اختيار: ' + input.files[0].name;
            txt.style.color = '#10b981';
        }
        if (voiceSelect) voiceSelect.value = '';
    }
}

async function fetchSampleAsBase64(fileName) {
    const url = `${SAMPLES_BASE}/${fileName}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('فشل جلب العينة');
    const blob = await res.blob();
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(String(reader.result || '').split(',')[1] || '');
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

async function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(String(reader.result || '').split(',')[1] || '');
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// ==========================================
// ⚡ التشغيل الفوري
// ==========================================
async function instantPlay() {
    const text = document.getElementById('ttsInput')?.value.trim();
    const lang = [...selectedLangs][0] || 'ar';
    const rate = document.getElementById('rateSelect')?.value || '+0%';
    const pitch = document.getElementById('pitchSelect')?.value || '+0Hz';

    if (!text) return showToast('اكتب النص أولاً', 'error');
    if (!localStorage.getItem('token')) return showToast('يرجى تسجيل الدخول', 'warning');

    const btn = document.getElementById('ttsInstantBtn');
    const progArea = document.getElementById('progressArea');
    const resultsCard = document.getElementById('resultsCard');
    const statusTxt = document.getElementById('statusTxt');
    const progFill = document.getElementById('progFill');

    btn.disabled = true;
    progArea.style.display = 'block';
    resultsCard.style.display = 'none';
    statusTxt.innerText = '⚡ التواصل مع الخادم...';
    progFill.style.width = '20%';

    try {
        if (typeof quickTTS !== 'function') {
            throw new Error('quickTTS غير محمّل. تأكد من رفع js/tts-quick.js');
        }
        const result = await quickTTS(text, { lang, rate, pitch });

        statusTxt.innerText = '✓ جاري التشغيل';
        progFill.style.width = '100%';

        result.audio.play().catch(() => {
            showToast('اضغط ▶️ في المشغّل', 'warning');
        });

        const langData = window.LANGUAGES?.find(l => l.code === lang);
        showSingleResult(lang, langData, result.url);

        showToast(`⚡ ${result.totalTime.toFixed(0)}ms`, 'success');
        updateSidebarAuth();
    } catch (e) {
        console.error('Instant TTS error:', e);
        showToast(e.message || 'فشل التوليد', 'error');
        statusTxt.innerText = `✗ ${e.message}`;
        progFill.style.background = '#ef4444';
    } finally {
        btn.disabled = false;
    }
}

function showSingleResult(code, lang, url) {
    const resultsCard = document.getElementById('resultsCard');
    const resultsList = document.getElementById('resultsList');
    if (!resultsCard || !resultsList) return;

    resultsCard.style.display = 'block';
    resultsList.innerHTML = `
        <div class="result-item">
            <div class="result-item-header">
                <span class="result-item-flag">${lang?.flag || '🌍'}</span>
                <span class="result-item-name">${lang?.name_ar || code}</span>
                <span class="result-item-status success">✓ مكتمل</span>
            </div>
            <audio controls src="${url}"></audio>
            <a href="${url}" download="tts_${code}_${Date.now()}.mp3" class="btn-download">
                <i class="fas fa-download"></i> تحميل
            </a>
        </div>
    `;
}

// ==========================================
// 🚀 Multi-lang TTS (parallel)
// ==========================================
async function startTTS() {
    const text = document.getElementById('ttsInput')?.value.trim();
    const rate = document.getElementById('rateSelect')?.value || '+0%';
    const pitch = document.getElementById('pitchSelect')?.value || '+0Hz';
    const token = localStorage.getItem('token');

    if (!token) return showToast('يرجى تسجيل الدخول', 'warning');
    if (!text) return showToast('يرجى كتابة النص!', 'error');
    if (selectedLangs.size === 0) return showToast('يرجى اختيار لغة', 'error');

    const currentMode = document.body.dataset.mode || 'fast';
    const langs = [...selectedLangs];

    const baseBody = { text, rate, pitch, translate: true };

    if (currentMode === 'quality') {
        const voiceSelectEl = document.getElementById('voiceSelect');
        const customVoiceInput = document.getElementById('customVoice');

        if (customVoiceInput?.files?.length > 0) {
            baseBody.sample_b64 = await fileToBase64(customVoiceInput.files[0]);
        } else if (voiceSelectEl?.value) {
            const opt = voiceSelectEl.options[voiceSelectEl.selectedIndex];
            const fileName = opt?.dataset?.file || `${voiceSelectEl.value}.mp3`;
            try {
                baseBody.sample_b64 = await fetchSampleAsBase64(fileName);
                baseBody.voice_id = voiceSelectEl.value;
            } catch (e) {
                baseBody.voice_id = voiceSelectEl.value;
            }
        }

        if (!baseBody.sample_b64 && !baseBody.voice_id) {
            showToast('اختر عينة أو ارفع تسجيل', 'warning');
            return;
        }
    }

    const btn = document.getElementById('ttsBtn');
    const progressArea = document.getElementById('progressArea');
    const resultsCard = document.getElementById('resultsCard');
    const resultsList = document.getElementById('resultsList');
    const statusTxt = document.getElementById('statusTxt');
    const progFill = document.getElementById('progFill');
    const perfStats = document.getElementById('perfStats');

    btn.disabled = true;
    progressArea.style.display = 'block';
    resultsCard.style.display = 'block';
    resultsList.innerHTML = '';
    perfStats.innerHTML = '';
    progFill.style.width = '5%';
    progFill.style.background = '';
    statusTxt.innerText = `بدء معالجة ${langs.length} لغة بالتوازي...`;

    langs.forEach(code => {
        const lang = window.LANGUAGES?.find(l => l.code === code);
        if (!lang) return;
        const card = document.createElement('div');
        card.className = 'result-item';
        card.id = `result-${code}`;
        card.innerHTML = `
            <div class="result-item-header">
                <span class="result-item-flag">${lang.flag}</span>
                <span class="result-item-name">${lang.name_ar}</span>
                <span class="result-item-status" id="status-${code}">في الانتظار</span>
            </div>
            <div id="body-${code}" style="font-size:0.85rem; color:#9aa1ac; padding:6px;">⏳ جاري الإرسال...</div>
        `;
        resultsList.appendChild(card);
    });

    const t0 = performance.now();
    let completed = 0;
    const total = langs.length;

    // 🚀 Parallel processing
    const promises = langs.map(async (langCode) => {
        const lang = window.LANGUAGES?.find(l => l.code === langCode);
        const statusEl = document.getElementById(`status-${langCode}`);
        const bodyEl = document.getElementById(`body-${langCode}`);

        try {
            statusEl.textContent = 'جاري الإرسال...';
            const body = Object.assign({}, baseBody, { lang: langCode });

            const res = await fetch(`${API_BASE}/api/tts`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(body)
            });

            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
            if (!data.success || !data.job_id) throw new Error(data.error || 'لم يبدأ التوليد');

            statusEl.textContent = 'جاري التوليد...';
            bodyEl.innerHTML = '<div style="font-size:0.85rem; color:#2563eb; padding:6px;">🎤 يعالج...</div>';

            const finalData = await waitForTTSJob(data.job_id, token, statusEl);

            statusEl.textContent = '✓ مكتمل';
            statusEl.classList.add('success');
            bodyEl.innerHTML = `
                <audio controls src="${finalData.audio_url}"></audio>
                <a href="${finalData.audio_url}" download="tts_${langCode}_${Date.now()}.mp3"
                   class="btn-download">
                    <i class="fas fa-download"></i> تحميل ${lang?.name_ar || langCode}
                </a>
            `;
        } catch (e) {
            console.error(`TTS ${langCode} failed:`, e);
            statusEl.textContent = '✗ فشل';
            statusEl.classList.add('error');
            bodyEl.innerHTML = `<div style="color:#ef4444; font-size:0.85rem; padding:6px;">${e.message}</div>`;
        } finally {
            completed++;
            const pct = Math.round((completed / total) * 95) + 5;
            progFill.style.width = pct + '%';
            statusTxt.innerText = `${completed}/${total} لغة مكتملة`;
        }
    });

    await Promise.all(promises);

    const totalMs = (performance.now() - t0).toFixed(0);
    progFill.style.width = '100%';
    statusTxt.innerText = `✓ اكتملت في ${(totalMs/1000).toFixed(1)}s`;

    perfStats.innerHTML = `
        <div class="perf-stat"><i class="fas fa-clock"></i><span>الوقت:</span><span class="stat-value">${(totalMs/1000).toFixed(1)}s</span></div>
        <div class="perf-stat"><i class="fas fa-bolt"></i><span>اللغات:</span><span class="stat-value">${total}</span></div>
        <div class="perf-stat"><i class="fas fa-tachometer-alt"></i><span>متوسط/لغة:</span><span class="stat-value">${(totalMs/total/1000).toFixed(1)}s</span></div>
    `;

    showToast(`تم ${total} لغة في ${(totalMs/1000).toFixed(1)}s`, 'success');
    btn.disabled = false;
    updateSidebarAuth();
}

async function waitForTTSJob(jobId, token, statusEl) {
    const start = Date.now();
    const TIMEOUT = 10 * 60 * 1000;

    while (Date.now() - start < TIMEOUT) {
        try {
            const res = await fetch(`${API_BASE}/api/job/${jobId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json().catch(() => ({}));

            if (data.status === 'completed') return data;
            if (data.status === 'failed') throw new Error('فشلت المعالجة');

            statusEl.textContent = `جاري المعالجة ${Math.round((Date.now() - start) / 1000)}ث`;
        } catch (e) {
            console.warn(`Poll failed:`, e);
        }
        await new Promise(r => setTimeout(r, 2500));
    }
    throw new Error('انتهت المهلة');
}

// ==========================================
// Mode + Advanced
// ==========================================
function switchMode(mode) {
    document.body.dataset.mode = mode;
    localStorage.setItem('tts_mode', mode);

    document.querySelectorAll('.mode-option').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.mode === mode);
    });

    const instantBtn = document.getElementById('ttsInstantBtn');
    if (instantBtn) {
        instantBtn.style.display = mode === 'fast' ? 'flex' : 'none';
    }

    const mainBtn = document.getElementById('ttsBtn');
    if (mainBtn) {
        mainBtn.innerHTML = mode === 'fast'
            ? '<i class="fas fa-bolt"></i> توليد سريع لكل اللغات'
            : '<i class="fas fa-gem"></i> توليد بجودة عالية';
    }
}

function toggleAdvanced() {
    document.getElementById('advancedOptions')?.classList.toggle('show');
}

// ==========================================
// 🟢 تهيئة كاملة عند تحميل الصفحة
// ==========================================
function initTTS() {
    console.log('🟢 Initializing TTS page...');
    console.log('LANGUAGES available:', !!window.LANGUAGES, window.LANGUAGES?.length);

    // الوضع
    const savedMode = localStorage.getItem('tts_mode') || 'fast';
    switchMode(savedMode);

    // اللغات
    renderLanguages();
    renderSelectedLangs();

    // المصادقة والعينات
    updateSidebarAuth();
    renderSampleVoices();

    // ربط Events
    document.getElementById('menuBtn')?.addEventListener('click', toggleSidebar);
    document.getElementById('overlay')?.addEventListener('click', closeSidebar);

    // Mode buttons
    document.querySelectorAll('.mode-option').forEach(btn => {
        btn.addEventListener('click', () => switchMode(btn.dataset.mode));
    });

    // Search
    document.getElementById('langSearch')?.addEventListener('input', (e) => {
        renderLanguages(e.target.value);
    });

    // Buttons
    document.getElementById('ttsBtn')?.addEventListener('click', startTTS);
    document.getElementById('ttsInstantBtn')?.addEventListener('click', instantPlay);
    document.getElementById('advancedToggleBtn')?.addEventListener('click', toggleAdvanced);
    document.getElementById('uploadVoiceBtn')?.addEventListener('click', () => {
        document.getElementById('customVoice')?.click();
    });
    document.getElementById('customVoice')?.addEventListener('change', (e) => {
        handleCustomVoice(e.target);
    });

    // Escape closes sidebar
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeSidebar();
    });

    // Char counter
    const ttsInput = document.getElementById('ttsInput');
    const charCount = document.getElementById('charCount');
    if (ttsInput && charCount) {
        ttsInput.addEventListener('input', () => {
            charCount.textContent = ttsInput.value.length;
        });
    }

    console.log('✅ TTS page initialized');
}

// 🌐 Exports
window.toggleSidebar = toggleSidebar;
window.closeSidebar = closeSidebar;
window.openSidebar = openSidebar;
window.toggleLanguage = toggleLanguage;
window.removeLanguage = removeLanguage;
window.renderLanguages = renderLanguages;
window.renderSelectedLangs = renderSelectedLangs;
window.startTTS = startTTS;
window.instantPlay = instantPlay;
window.handleCustomVoice = handleCustomVoice;
window.switchMode = switchMode;
window.toggleAdvanced = toggleAdvanced;
window.logout = logout;

// تشغيل عند تحميل الـ DOM
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initTTS);
} else {
    // إذا الـ DOM محمّل بالفعل
    initTTS();
}
