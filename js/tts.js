// ==========================================
// 🎨 tts.js — multi-lang + parallel + sidebar fix
// ==========================================
const API_BASE = 'https://web-production-14a1.up.railway.app';
const SAMPLES_BASE = 'samples';

// ==========================================
// 🟢 Sidebar (الإصلاح الكامل)
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

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeSidebar();
});

// ==========================================
// 🟢 Toasts (مُحسّنة للثيم الأبيض)
// ==========================================
function showToast(msg, type = 'info') {
    const t = document.getElementById('toasts');
    if (!t) return;
    const box = document.createElement('div');
    box.className = 'toast';
    box.innerText = msg;
    if (type === 'error') box.style.background = 'var(--error)';
    else if (type === 'success') box.style.background = 'var(--success)';
    else if (type === 'warning') box.style.background = 'var(--warning)';
    t.appendChild(box);
    setTimeout(() => box.remove(), 4000);
}

// ==========================================
// 🌍 إدارة اللغات (متعدد)
// ==========================================
let selectedLangs = new Set(JSON.parse(localStorage.getItem('tts_langs') || '["ar"]'));

function renderLanguages(filter = '') {
    const container = document.getElementById('langList');
    const langCount = document.getElementById('langCount');
    if (!container || !window.LANGUAGES) return;

    const filterLower = (filter || '').toLowerCase().trim();
    const filtered = LANGUAGES.filter(l => {
        if (!filterLower) return true;
        return (
            l.name_ar.toLowerCase().includes(filterLower) ||
            l.name_en.toLowerCase().includes(filterLower) ||
            l.code.toLowerCase().includes(filterLower)
        );
    });

    // ترتيب: المختارة → الشائعة → الباقي
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
             data-code="${l.code}"
             onclick="toggleLanguage('${l.code}')">
            <div class="checkbox"></div>
            <div class="flag">${l.flag}</div>
            <div class="lang-info">
                <div class="lang-ar">${l.name_ar}</div>
                <div class="lang-en">${l.name_en}</div>
            </div>
        </div>
    `).join('') || '<div style="text-align:center;padding:30px;color:var(--text-muted);">لم يُعثر على نتائج</div>';
}

function filterLanguages(query) {
    renderLanguages(query);
}

function toggleLanguage(code) {
    if (selectedLangs.has(code)) {
        if (selectedLangs.size > 1) {
            selectedLangs.delete(code);
        } else {
            showToast('يجب اختيار لغة واحدة على الأقل', 'warning');
            return;
        }
    } else {
        if (selectedLangs.size >= 10) {
            showToast('الحد الأقصى 10 لغات في عملية واحدة', 'error');
            return;
        }
        selectedLangs.add(code);
    }
    localStorage.setItem('tts_langs', JSON.stringify([...selectedLangs]));
    renderSelectedLangs();
    renderLanguages(document.getElementById('langSearch')?.value || '');
}

function removeLanguage(code) {
    if (selectedLangs.size <= 1) {
        showToast('يجب الإبقاء على لغة واحدة على الأقل', 'warning');
        return;
    }
    selectedLangs.delete(code);
    localStorage.setItem('tts_langs', JSON.stringify([...selectedLangs]));
    renderSelectedLangs();
    renderLanguages(document.getElementById('langSearch')?.value || '');
}

function renderSelectedLangs() {
    const display = document.getElementById('selectedLangsDisplay');
    if (!display) return;

    if (selectedLangs.size === 0) {
        display.innerHTML = '<div class="selected-langs-empty">لم يتم اختيار لغة بعد</div>';
        return;
    }

    const pills = [...selectedLangs].map(code => {
        const lang = LANGUAGES.find(l => l.code === code);
        if (!lang) return '';
        return `
            <div class="lang-pill" onclick="removeLanguage('${code}')" title="إزالة">
                <span>${lang.flag}</span>
                <span>${lang.name_ar}</span>
                <span class="remove-icon">✕</span>
            </div>
        `;
    }).join('');

    display.innerHTML = `<div class="selected-langs-pills">${pills}</div>`;
}

// ==========================================
// 🔧 المصادقة + Sidebar
// ==========================================
async function updateSidebarAuth() {
    const authSection = document.getElementById('authSection');
    if (!authSection) return;
    const token = localStorage.getItem('token');

    if (!token) {
        authSection.innerHTML = `
            <div class="user-info-card">
                <p style="margin-bottom:12px; font-size:0.9rem; color:var(--text-secondary);">أهلاً بك في sl-Dubbing</p>
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
                    <button onclick="logout()" style="margin-top:10px; background:none; border:none; color:var(--error); cursor:pointer; font-size:0.82rem; font-weight:600;">تسجيل الخروج</button>
                </div>`;
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
// 🎙️ جلب العينات
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
        console.warn('فشل قراءة manifest.json:', e);
    }
}

function handleCustomVoice(input) {
    const txt = document.getElementById('customVoiceTxt');
    const voiceSelect = document.getElementById('voiceSelect');
    if (input.files && input.files[0]) {
        if (txt) {
            txt.innerText = '✓ تم اختيار: ' + input.files[0].name;
            txt.style.color = 'var(--success)';
        }
        if (voiceSelect) voiceSelect.value = '';
    }
}

async function fetchSampleAsBase64(fileName) {
    const url = `${SAMPLES_BASE}/${fileName}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`فشل جلب العينة`);
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
// ⚡ التشغيل الفوري (أول لغة فقط)
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
    const perfStats = document.getElementById('perfStats');

    btn.disabled = true;
    progArea.style.display = 'block';
    resultsCard.style.display = 'none';
    statusTxt.innerText = '⚡ التواصل مع الخادم...';
    progFill.style.width = '20%';
    perfStats.innerHTML = '';

    try {
        const result = await quickTTS(text, { lang, rate, pitch });

        statusTxt.innerText = '✓ جاري التشغيل';
        progFill.style.width = '100%';

        result.audio.play().catch(() => {
            showToast('اضغط ▶️ في المشغّل', 'warning');
        });

        // عرض النتيجة
        const langData = LANGUAGES.find(l => l.code === lang);
        showSingleResult(lang, langData, result.url);

        perfStats.innerHTML = `
            <div class="perf-stat">
                <i class="fas fa-rocket"></i>
                <span>TTFB:</span>
                <span class="stat-value">${result.ttfb.toFixed(0)}ms</span>
            </div>
            <div class="perf-stat">
                <i class="fas fa-clock"></i>
                <span>المجموع:</span>
                <span class="stat-value">${result.totalTime.toFixed(0)}ms</span>
            </div>
            <div class="perf-stat">
                <i class="fas fa-coins"></i>
                <span>الرصيد:</span>
                <span class="stat-value">${result.remainingCredits}</span>
            </div>
        `;

        showToast(`⚡ ${result.totalTime.toFixed(0)}ms`, 'success');
        updateSidebarAuth();
    } catch (e) {
        console.error('Instant TTS error:', e);
        showToast(e.message || 'فشل التوليد', 'error');
        statusTxt.innerText = `✗ ${e.message}`;
        progFill.style.background = 'var(--error)';
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
// 🚀 الزر الرئيسي — معالجة متوازية لكل اللغات
// ==========================================
async function startTTS() {
    const text = document.getElementById('ttsInput')?.value.trim();
    const rate = document.getElementById('rateSelect')?.value || '+0%';
    const pitch = document.getElementById('pitchSelect')?.value || '+0Hz';
    const token = localStorage.getItem('token');

    if (!token) return showToast('يرجى تسجيل الدخول أولاً', 'warning');
    if (!text) return showToast('يرجى كتابة النص!', 'error');
    if (selectedLangs.size === 0) return showToast('يرجى اختيار لغة', 'error');

    const currentMode = document.body.dataset.mode || 'fast';
    const langs = [...selectedLangs];

    // تحضير body مشترك
    const baseBody = { text, rate, pitch, translate: true };

    // إذا quality mode، أضف voice cloning data
    if (currentMode === 'quality') {
        const voiceSelectEl = document.getElementById('voiceSelect');
        const customVoiceInput = document.getElementById('customVoice');

        if (customVoiceInput?.files?.length > 0) {
            baseBody.sample_b64 = await fileToBase64(customVoiceInput.files[0]);
        } else if (voiceSelectEl?.value) {
            const selectedOpt = voiceSelectEl.options[voiceSelectEl.selectedIndex];
            const fileName = selectedOpt?.dataset?.file || `${voiceSelectEl.value}.mp3`;
            try {
                baseBody.sample_b64 = await fetchSampleAsBase64(fileName);
                baseBody.voice_id = voiceSelectEl.value;
            } catch (e) {
                baseBody.voice_id = voiceSelectEl.value;
            }
        }

        if (!baseBody.sample_b64 && !baseBody.voice_id) {
            showToast('في الوضع عالي الجودة: اختر عينة أو ارفع تسجيل', 'warning');
            return;
        }
    }

    // تجهيز الواجهة
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

    // إنشاء بطاقة لكل لغة
    langs.forEach(code => {
        const lang = LANGUAGES.find(l => l.code === code);
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
            <div id="body-${code}" style="font-size:0.85rem; color:var(--text-muted); padding:6px;">⏳ جاري الإرسال...</div>
        `;
        resultsList.appendChild(card);
    });

    const t0 = performance.now();
    let completed = 0;
    const total = langs.length;

    // 🚀 معالجة كل اللغات بالتوازي (parallel)
    // كل promise يرسل request مستقل لـ Railway → كل request يفتح Celery task
    // → Celery task يستدعي Modal → Modal يفتح حاوية للمعالجة (autoscaling)
    const promises = langs.map(async (langCode) => {
        const lang = LANGUAGES.find(l => l.code === langCode);
        const statusEl = document.getElementById(`status-${langCode}`);
        const bodyEl = document.getElementById(`body-${langCode}`);

        try {
            statusEl.textContent = 'جاري الإرسال...';

            const body = { ...baseBody, lang: langCode };

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
            bodyEl.innerHTML = '<div style="font-size:0.85rem; color:var(--accent); padding:6px;">🎤 يعالج...</div>';

            // متابعة عبر polling
            const finalData = await waitForTTSJob(data.job_id, token, statusEl);

            statusEl.textContent = '✓ مكتمل';
            statusEl.classList.add('success');
            bodyEl.innerHTML = `
                <audio controls src="${finalData.audio_url}"></audio>
                <a href="${finalData.audio_url}" download="tts_${langCode}_${Date.now()}.mp3"
                   class="btn-download">
                    <i class="fas fa-download"></i> تحميل ${lang.name_ar}
                </a>
            `;
        } catch (e) {
            console.error(`TTS ${langCode} failed:`, e);
            statusEl.textContent = '✗ فشل';
            statusEl.classList.add('error');
            bodyEl.innerHTML = `<div style="color:var(--error); font-size:0.85rem; padding:6px;">${e.message}</div>`;
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
    statusTxt.innerText = `✓ اكتملت جميع اللغات في ${(totalMs/1000).toFixed(1)}s`;

    perfStats.innerHTML = `
        <div class="perf-stat">
            <i class="fas fa-clock"></i>
            <span>الوقت الكلي:</span>
            <span class="stat-value">${(totalMs/1000).toFixed(1)}s</span>
        </div>
        <div class="perf-stat">
            <i class="fas fa-bolt"></i>
            <span>اللغات:</span>
            <span class="stat-value">${total}</span>
        </div>
        <div class="perf-stat">
            <i class="fas fa-tachometer-alt"></i>
            <span>متوسط/لغة:</span>
            <span class="stat-value">${(totalMs/total/1000).toFixed(1)}s</span>
        </div>
    `;

    showToast(`تم توليد ${total} لغة في ${(totalMs/1000).toFixed(1)}s`, 'success');
    btn.disabled = false;
    updateSidebarAuth();
}

// ==========================================
// 🔄 متابعة مهمة TTS واحدة
// ==========================================
async function waitForTTSJob(jobId, token, statusEl) {
    const start = Date.now();
    const TIMEOUT = 10 * 60 * 1000; // 10 دقائق

    while (Date.now() - start < TIMEOUT) {
        try {
            const res = await fetch(`${API_BASE}/api/job/${jobId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json().catch(() => ({}));

            if (data.status === 'completed') {
                return data;
            }
            if (data.status === 'failed') {
                throw new Error('فشلت المعالجة في Modal');
            }
            // غير ذلك = ما زال يعالج
            statusEl.textContent = `جاري المعالجة... ${Math.round((Date.now() - start) / 1000)}ث`;
        } catch (e) {
            console.warn(`Poll failed for ${jobId}:`, e);
        }
        await new Promise(r => setTimeout(r, 2500));
    }
    throw new Error('انتهت مهلة الانتظار (10 دقائق)');
}

// ==========================================
// 🟢 وضع التشغيل
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
        if (mode === 'fast') {
            mainBtn.innerHTML = '<i class="fas fa-bolt"></i> توليد سريع لكل اللغات';
        } else {
            mainBtn.innerHTML = '<i class="fas fa-gem"></i> توليد بجودة عالية لكل اللغات';
        }
    }
}

function toggleAdvanced() {
    document.getElementById('advancedOptions')?.classList.toggle('show');
}

// ==========================================
// 🟢 تهيئة
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    // الوضع
    const savedMode = localStorage.getItem('tts_mode') || 'fast';
    switchMode(savedMode);

    // اللغات
    renderLanguages();
    renderSelectedLangs();

    // المصادقة والعينات
    updateSidebarAuth();
    renderSampleVoices();

    // عداد الأحرف
    const ttsInput = document.getElementById('ttsInput');
    const charCount = document.getElementById('charCount');
    if (ttsInput && charCount) {
        ttsInput.addEventListener('input', () => {
            charCount.textContent = ttsInput.value.length;
        });
    }
});

// ==========================================
// 🌐 Exports (مهم: لتعمل onclick في HTML)
// ==========================================
window.toggleSidebar = toggleSidebar;
window.closeSidebar = closeSidebar;
window.toggleLanguage = toggleLanguage;
window.removeLanguage = removeLanguage;
window.filterLanguages = filterLanguages;
window.startTTS = startTTS;
window.instantPlay = instantPlay;
window.handleCustomVoice = handleCustomVoice;
window.switchMode = switchMode;
window.toggleAdvanced = toggleAdvanced;
window.logout = logout;
