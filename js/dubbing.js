// ==========================================
// 🎬 dubbing.js — متعدد اللغات + Sidebar fix
// ==========================================
const API_BASE = 'https://web-production-14a1.up.railway.app';
const SAMPLES_BASE = 'samples';

// ==========================================
// 🟢 Sidebar Toggle (إصلاح كامل)
// ==========================================
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('overlay');
    if (!sidebar || !overlay) return;

    const isActive = sidebar.classList.contains('active');
    if (isActive) {
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

// إغلاق Sidebar عند Escape
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeSidebar();
});

// ==========================================
// 🟢 Toasts
// ==========================================
function showToast(msg, type = 'info') {
    const t = document.getElementById('toasts');
    if (!t) return;
    const box = document.createElement('div');
    box.className = 'toast';
    box.innerText = msg;
    if (type === 'error') {
        box.style.background = 'var(--error)';
    } else if (type === 'success') {
        box.style.background = 'var(--success)';
    } else if (type === 'warning') {
        box.style.background = 'var(--warning)';
    }
    t.appendChild(box);
    setTimeout(() => box.remove(), 4000);
}

// ==========================================
// 🌍 إدارة اللغات (multi-select)
// ==========================================
let selectedLangs = new Set(JSON.parse(localStorage.getItem('dub_langs') || '["ar"]'));

function renderLanguages(filter = '') {
    const container = document.getElementById('langList');
    const langCount = document.getElementById('langCount');
    if (!container || !window.LANGUAGES) return;

    const filterLower = filter.toLowerCase().trim();
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

    langCount.textContent = `${filtered.length} لغة` + (filter ? ' (تصفية)' : '');

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
        selectedLangs.delete(code);
    } else {
        if (selectedLangs.size >= 10) {
            showToast('الحد الأقصى 10 لغات في عملية واحدة', 'error');
            return;
        }
        selectedLangs.add(code);
    }
    localStorage.setItem('dub_langs', JSON.stringify([...selectedLangs]));
    renderSelectedLangs();
    renderLanguages(document.getElementById('langSearch')?.value || '');
    updateMiniSummary();
}

function removeLanguage(code) {
    selectedLangs.delete(code);
    localStorage.setItem('dub_langs', JSON.stringify([...selectedLangs]));
    renderSelectedLangs();
    renderLanguages(document.getElementById('langSearch')?.value || '');
    updateMiniSummary();
}

function renderSelectedLangs() {
    const display = document.getElementById('selectedLangsDisplay');
    if (!display) return;

    if (selectedLangs.size === 0) {
        display.innerHTML = '<div class="selected-langs-empty">لم يتم اختيار لغة بعد. ابحث واضغط لاختيار لغة أو أكثر.</div>';
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

function updateMiniSummary() {
    const miniLangs = document.getElementById('miniLangs');
    if (!miniLangs) return;
    if (selectedLangs.size === 0) {
        miniLangs.textContent = 'لم تُختر بعد';
    } else {
        const names = [...selectedLangs].slice(0, 3).map(code => {
            const l = LANGUAGES.find(x => x.code === code);
            return l ? l.name_ar : code;
        });
        let text = names.join('، ');
        if (selectedLangs.size > 3) text += ` +${selectedLangs.size - 3}`;
        miniLangs.textContent = text;
    }
}

// ==========================================
// 🎤 رفع الوسائط
// ==========================================
function updateFileName() {
    const f = document.getElementById('mediaFile');
    const txt = document.getElementById('fileTxt');
    if (f?.files?.length) {
        txt.innerText = '✓ ' + f.files[0].name;
        txt.style.color = 'var(--text-primary)';
    }
}

function handleCustomVoice(input) {
    const txt = document.getElementById('customVoiceTxt');
    if (input.files && input.files[0]) {
        txt.innerText = '✓ تم اختيار: ' + input.files[0].name;
        txt.style.color = 'var(--text-primary)';
        document.getElementById('voiceSelect').value = 'custom';
        const miniVoice = document.getElementById('miniVoice');
        if (miniVoice) miniVoice.textContent = 'بصمة مخصصة';
    }
}

document.getElementById('voiceSelect')?.addEventListener('change', (e) => {
    const miniVoice = document.getElementById('miniVoice');
    if (!miniVoice) return;
    const val = e.target.value;
    const map = {
        'original': 'الصوت الأصلي',
        'custom': 'بصمة مخصصة',
    };
    miniVoice.textContent = map[val] || val;
});

// ==========================================
// 🎬 جلب العينات الصوتية للقائمة
// ==========================================
async function loadSampleVoices() {
    const select = document.getElementById('voiceSelect');
    if (!select) return;

    try {
        const res = await fetch(`${SAMPLES_BASE}/manifest.json?t=${Date.now()}`);
        if (!res.ok) return;
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
                <p style="margin-bottom:12px; font-size:0.9rem; color: var(--text-secondary);">أهلاً بك في sl-Dubbing</p>
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
// 🎬 بدء الدبلجة (متعدد اللغات)
// ==========================================
async function startDubbing() {
    const file = document.getElementById('mediaFile')?.files?.[0];
    const voiceSelect = document.getElementById('voiceSelect');
    const customVoice = document.getElementById('customVoice');
    const token = localStorage.getItem('token');

    if (!token) {
        showToast('يرجى تسجيل الدخول أولاً', 'error');
        return;
    }
    if (!file) {
        showToast('يرجى اختيار ملف فيديو/صوت', 'error');
        return;
    }
    if (selectedLangs.size === 0) {
        showToast('يرجى اختيار لغة هدف واحدة على الأقل', 'error');
        return;
    }

    const dubBtn = document.getElementById('dubBtn');
    const progressArea = document.getElementById('progressArea');
    const resultsCard = document.getElementById('resultsCard');
    const resultsList = document.getElementById('resultsList');
    const statusTxt = document.getElementById('statusTxt');
    const progFill = document.getElementById('progFill');
    const miniStatus = document.getElementById('miniStatus');

    dubBtn.disabled = true;
    progressArea.style.display = 'block';
    resultsCard.style.display = 'block';
    resultsList.innerHTML = '';

    // إنشاء بطاقة لكل لغة
    const langs = [...selectedLangs];
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
            <div class="result-item-body" id="body-${code}">
                <div style="color:var(--text-muted); font-size:0.85rem; padding:8px;">جاري الإرسال...</div>
            </div>
        `;
        resultsList.appendChild(card);
    });

    statusTxt.innerText = `بدء معالجة ${langs.length} لغة...`;
    miniStatus.textContent = `يعالج ${langs.length} لغة`;
    progFill.style.width = '5%';

    let completed = 0;
    const total = langs.length;

    // معالجة كل لغة بالتوازي
    const promises = langs.map(async (langCode) => {
        const lang = LANGUAGES.find(l => l.code === langCode);
        const statusEl = document.getElementById(`status-${langCode}`);
        const bodyEl = document.getElementById(`body-${langCode}`);

        try {
            statusEl.textContent = 'جاري الرفع...';

            const formData = new FormData();
            formData.append('media_file', file);
            formData.append('lang', langCode);

            // الصوت
            const voiceVal = voiceSelect.value;
            if (customVoice?.files?.[0]) {
                formData.append('voice_sample', customVoice.files[0]);
                formData.append('voice_id', 'custom');
            } else if (voiceVal && voiceVal !== 'original') {
                formData.append('voice_id', voiceVal);
            } else {
                formData.append('voice_id', 'source');
            }

            const res = await fetch(`${API_BASE}/api/dub`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            });

            const data = await res.json();
            if (!res.ok || !data.success) {
                throw new Error(data.error || `HTTP ${res.status}`);
            }

            statusEl.textContent = 'جاري المعالجة...';
            bodyEl.innerHTML = '<div style="color:var(--text-secondary); font-size:0.85rem; padding:8px;">⏳ Modal تعالج المقاطع...</div>';

            // متابعة عبر SSE/polling
            const finalData = await waitForJob(data.job_id, token, statusEl);

            statusEl.textContent = '✓ مكتمل';
            statusEl.classList.add('success');
            bodyEl.innerHTML = `
                <audio controls style="width:100%; margin-top:6px;" src="${finalData.audio_url}"></audio>
                <a href="${finalData.audio_url}" download="dub_${langCode}_${Date.now()}.wav"
                   class="btn-download" style="margin-top:10px;">
                    <i class="fas fa-download"></i> تحميل ${lang.name_ar}
                </a>
            `;
        } catch (e) {
            console.error(`Lang ${langCode} failed:`, e);
            statusEl.textContent = '✗ فشل';
            statusEl.classList.add('error');
            bodyEl.innerHTML = `<div style="color:var(--error); font-size:0.85rem; padding:8px;">${e.message}</div>`;
        } finally {
            completed++;
            const pct = Math.round((completed / total) * 95) + 5;
            progFill.style.width = pct + '%';
            statusTxt.innerText = `${completed}/${total} لغة مكتملة`;
        }
    });

    await Promise.all(promises);

    progFill.style.width = '100%';
    statusTxt.innerText = '✓ اكتملت معالجة جميع اللغات!';
    miniStatus.textContent = 'مكتمل';
    showToast(`تمت دبلجة ${total} لغة`, 'success');
    dubBtn.disabled = false;
    updateSidebarAuth();
}

// ==========================================
// 🔄 متابعة المهمة
// ==========================================
async function waitForJob(jobId, token, statusEl) {
    const start = Date.now();
    const TIMEOUT = 30 * 60 * 1000;

    while (Date.now() - start < TIMEOUT) {
        try {
            const res = await fetch(`${API_BASE}/api/job/${jobId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();

            if (data.status === 'completed') {
                return data;
            }
            if (data.status === 'failed') {
                throw new Error('فشلت المعالجة');
            }
            statusEl.textContent = `جاري المعالجة... ${Math.round((Date.now() - start) / 1000)}ث`;
        } catch (e) {
            console.warn('Poll error:', e);
        }
        await new Promise(r => setTimeout(r, 3000));
    }
    throw new Error('انتهت مهلة الانتظار');
}

// ==========================================
// 🟢 تهيئة
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    updateSidebarAuth();
    loadSampleVoices();
    renderLanguages();
    renderSelectedLangs();
    updateMiniSummary();
});

// Exports
window.toggleSidebar = toggleSidebar;
window.closeSidebar = closeSidebar;
window.toggleLanguage = toggleLanguage;
window.removeLanguage = removeLanguage;
window.filterLanguages = filterLanguages;
window.startDubbing = startDubbing;
window.updateFileName = updateFileName;
window.handleCustomVoice = handleCustomVoice;
window.logout = logout;
