// ==========================================
// 🎨 tts.js — يدعم Fast & Quality + 100 لغة
// ==========================================
const API_BASE = 'https://web-production-14a1.up.railway.app';
const SAMPLES_BASE = 'samples';
const COLORS = {
    ACCENT: '#7c3aed',
    GOLD: '#ffb800',
    PROGRESS: '#34d399',
    TOAST_ERROR: '#ef4444',
    TOAST_SUCCESS: '#10b981',
    TOAST_WARNING: '#f59e0b'
};

// ==========================================
// 🎙️ جلب العينات من manifest.json
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
        const fallback = [{ id: 'muhammad', label: 'محمد', icon: '👨', file: 'muhammad.mp3' }];
        fallback.forEach(v => {
            const opt = document.createElement('option');
            opt.value = v.id;
            opt.textContent = `${v.icon} ${v.label}`;
            opt.dataset.file = v.file;
            select.appendChild(opt);
        });
    }
}

// ==========================================
// 🟢 تنبيهات
// ==========================================
function showToast(msg, color = COLORS.TOAST_ERROR) {
    const t = document.getElementById('toasts');
    if (!t) return;
    const box = document.createElement('div');
    box.className = 'toast';
    box.style.cssText = `
        position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%);
        background: ${color}; color: white; padding: 12px 25px; border-radius: 10px;
        z-index: 9999; font-weight: bold; box-shadow: 0 6px 18px rgba(0,0,0,0.3);
    `;
    box.innerText = msg;
    t.appendChild(box);
    setTimeout(() => box.remove(), 4000);
}

function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('active');
    document.getElementById('overlay').classList.toggle('active');
}

async function updateSidebarAuth() {
    const authSection = document.getElementById('authSection');
    if (!authSection) return;
    const token = localStorage.getItem('token');

    if (!token) {
        authSection.innerHTML = `
            <div class="user-info-card">
                <p style="margin-bottom:15px; font-size:0.95rem; color: #fff;">أهلاً بك في sl-Dubbing</p>
                <a href="login.html" class="btn-login-sidebar">تسجيل الدخول</a>
            </div>`;
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/api/user`, {
            method: 'GET', headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        if (data.success || data.user) {
            const userName = data.user?.name || 'مستخدم';
            const userCredits = data.user?.credits ?? 0;
            authSection.innerHTML = `
                <div class="user-info-card">
                    <div class="user-name">${userName}</div>
                    <div class="user-points">رصيدك: ${userCredits} نقطة 💰</div>
                    <button onclick="logout()" style="margin-top:12px; background:none; border:none; color:#ff4444; cursor:pointer; font-size:0.85rem; font-weight:bold;">تسجيل الخروج</button>
                </div>`;
        }
    } catch (e) {
        localStorage.removeItem('token');
        authSection.innerHTML = `<a href="login.html" class="btn-login-sidebar">تسجيل الدخول مجدداً</a>`;
    }
}

function logout() { localStorage.removeItem('token'); location.reload(); }

// ==========================================
// 🔧 معالجة رفع البصمة
// ==========================================
function handleCustomVoice(input) {
    const txt = document.getElementById('customVoiceTxt');
    const voiceSelect = document.getElementById('voiceSelect');
    if (input.files && input.files[0]) {
        if (txt) {
            txt.innerText = '✅ تم اختيار: ' + input.files[0].name;
            txt.style.color = COLORS.PROGRESS;
        }
        if (voiceSelect) voiceSelect.value = '';
    }
}

async function fetchSampleAsBase64(fileName) {
    const url = `${SAMPLES_BASE}/${fileName}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`فشل جلب العينة: ${fileName}`);
    const blob = await res.blob();
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const base64 = String(reader.result || '').split(',')[1] || '';
            resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

async function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const base64 = String(reader.result || '').split(',')[1] || '';
            resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// ==========================================
// ⚡ التشغيل الفوري (Fast mode فقط)
// ==========================================
async function instantPlay() {
    const text = document.getElementById('ttsInput').value.trim();
    const lang = window.getCurrentLang ? window.getCurrentLang() : 'ar';
    const rate = document.getElementById('rateSelect')?.value || '+0%';
    const pitch = document.getElementById('pitchSelect')?.value || '+0Hz';

    if (!text) {
        showToast('اكتب النص أولاً', COLORS.TOAST_ERROR);
        return;
    }
    if (!localStorage.getItem('token')) {
        showToast('يرجى تسجيل الدخول أولاً', COLORS.TOAST_WARNING);
        return;
    }

    const instantBtn = document.getElementById('ttsInstantBtn');
    const progArea = document.getElementById('progressArea');
    const statusTxt = document.getElementById('statusTxt');
    const progFill = document.getElementById('progFill');
    const perfStats = document.getElementById('perfStats');
    const resCard = document.getElementById('resCard');

    instantBtn.disabled = true;
    progArea.style.display = 'block';
    if (resCard) resCard.style.display = 'none';
    statusTxt.innerText = '⚡ التواصل مع الخادم...';
    progFill.style.width = '20%';
    perfStats.innerHTML = '';

    try {
        const result = await quickTTS(text, { lang, rate, pitch });

        statusTxt.innerText = '✅ يتم التشغيل الآن...';
        progFill.style.width = '100%';

        result.audio.play().catch(e => {
            console.warn('Autoplay blocked:', e);
            showToast('اضغط ▶️ في المشغّل', COLORS.TOAST_WARNING);
        });

        const audioEl = document.getElementById('audioResult');
        const dlBtn = document.getElementById('dlBtn');
        audioEl.src = result.url;
        dlBtn.href = result.url;
        dlBtn.download = `tts_${Date.now()}.mp3`;
        if (resCard) resCard.style.display = 'block';

        perfStats.innerHTML = `
            <div class="perf-stat">
                <i class="fas fa-rocket"></i>
                <span class="stat-label">TTFB:</span>
                <span class="stat-value">${result.ttfb.toFixed(0)}ms</span>
            </div>
            <div class="perf-stat">
                <i class="fas fa-clock"></i>
                <span class="stat-label">المجموع:</span>
                <span class="stat-value">${result.totalTime.toFixed(0)}ms</span>
            </div>
            <div class="perf-stat">
                <i class="fas fa-coins"></i>
                <span class="stat-label">الرصيد:</span>
                <span class="stat-value">${result.remainingCredits}</span>
            </div>
        `;

        showToast(`⚡ ${result.totalTime.toFixed(0)}ms`, COLORS.TOAST_SUCCESS);
        updateSidebarAuth();
    } catch (e) {
        console.error('Instant TTS error:', e);
        showToast(e.message || 'فشل التوليد الفوري', COLORS.TOAST_ERROR);
        statusTxt.innerText = `❌ ${e.message}`;
        progFill.style.background = COLORS.TOAST_ERROR;
    } finally {
        instantBtn.disabled = false;
    }
}

// ==========================================
// 🟢 الزر الرئيسي (Fast or Quality)
// ==========================================
async function startTTS() {
    const text = document.getElementById('ttsInput').value.trim();
    const lang = window.getCurrentLang ? window.getCurrentLang() : 'ar';
    const rate = document.getElementById('rateSelect')?.value || '+0%';
    const pitch = document.getElementById('pitchSelect')?.value || '+0Hz';
    const token = localStorage.getItem('token');

    if (!token) return showToast('يرجى تسجيل الدخول أولاً', COLORS.TOAST_WARNING);
    if (!text) return showToast('يرجى كتابة النص!', COLORS.TOAST_ERROR);

    const currentMode = document.body.dataset.mode || 'fast';

    if (currentMode === 'quality') {
        await runQualityMode(text, lang, rate, pitch, token);
    } else {
        await runFastModeWithSave(text, lang, rate, pitch, token);
    }
}

async function runFastModeWithSave(text, lang, rate, pitch, token) {
    const btn = document.getElementById('ttsBtn');
    const progressArea = document.getElementById('progressArea');
    const progFill = document.getElementById('progFill');
    const statusTxt = document.getElementById('statusTxt');
    const resCard = document.getElementById('resCard');
    const perfStats = document.getElementById('perfStats');

    btn.disabled = true;
    progressArea.style.display = 'block';
    if (resCard) resCard.style.display = 'none';
    progFill.style.width = '20%';
    progFill.style.background = COLORS.PROGRESS;
    perfStats.innerHTML = '';
    statusTxt.innerText = 'الحالة: جاري الإرسال...';

    const t0 = performance.now();

    try {
        const body = { text, lang, rate, pitch, translate: true };

        const res = await fetch(`${API_BASE}/api/tts`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || `Server Error: ${res.status}`);

        if (data.success && data.job_id) {
            statusTxt.innerText = 'الحالة: جاري التوليد...';
            progFill.style.width = '50%';

            const evtSource = new EventSource(`${API_BASE}/api/progress/${data.job_id}`);
            evtSource.onmessage = function (event) {
                let progData;
                try { progData = JSON.parse(event.data); } catch (e) { return; }

                if (progData.status === 'completed') {
                    evtSource.close();
                    const totalMs = (performance.now() - t0).toFixed(0);
                    progFill.style.width = '100%';
                    statusTxt.innerText = '✅ تم بنجاح!';
                    showToast(`تم في ${totalMs}ms`, COLORS.TOAST_SUCCESS);

                    if (resCard) resCard.style.display = 'block';
                    const audEl = document.getElementById('audioResult');
                    const dl = document.getElementById('dlBtn');
                    if (audEl) audEl.src = progData.audio_url;
                    if (dl) {
                        dl.href = progData.audio_url;
                        dl.download = `tts_${Date.now()}.mp3`;
                    }

                    perfStats.innerHTML = `
                        <div class="perf-stat">
                            <i class="fas fa-clock"></i>
                            <span class="stat-label">المدة:</span>
                            <span class="stat-value">${totalMs}ms</span>
                        </div>
                        <div class="perf-stat">
                            <i class="fas fa-save"></i>
                            <span class="stat-label">محفوظ في الحساب</span>
                        </div>`;

                    btn.disabled = false;
                    updateSidebarAuth();
                } else if (progData.status === 'failed') {
                    evtSource.close();
                    showToast('فشل التوليد', COLORS.TOAST_ERROR);
                    statusTxt.innerText = '❌ فشل التوليد';
                    progFill.style.background = COLORS.TOAST_ERROR;
                    btn.disabled = false;
                    updateSidebarAuth();
                }
            };
            evtSource.onerror = function () {
                evtSource.close();
                pollTtsStatus(data.job_id, btn, statusTxt, progFill, resCard, t0, perfStats);
            };
        } else {
            throw new Error(data.error || 'خطأ في بدء التوليد');
        }
    } catch (e) {
        console.error('TTS Error:', e);
        showToast(e.message || 'خطأ في الاتصال', COLORS.TOAST_ERROR);
        progFill.style.background = COLORS.TOAST_ERROR;
        btn.disabled = false;
    }
}

async function runQualityMode(text, lang, rate, pitch, token) {
    const voiceSelectEl = document.getElementById('voiceSelect');
    const customVoiceInput = document.getElementById('customVoice');

    const btn = document.getElementById('ttsBtn');
    const progressArea = document.getElementById('progressArea');
    const progFill = document.getElementById('progFill');
    const statusTxt = document.getElementById('statusTxt');
    const resCard = document.getElementById('resCard');
    const perfStats = document.getElementById('perfStats');

    btn.disabled = true;
    progressArea.style.display = 'block';
    if (resCard) resCard.style.display = 'none';
    progFill.style.width = '15%';
    progFill.style.background = COLORS.PROGRESS;
    perfStats.innerHTML = '';
    statusTxt.innerText = 'الحالة: جاري تحضير الصوت المرجعي...';

    const t0 = performance.now();

    try {
        const body = { text, lang, rate, pitch, translate: true };

        // أولوية: ملف مرفوع → عينة من samples
        if (customVoiceInput?.files?.length > 0) {
            body.sample_b64 = await fileToBase64(customVoiceInput.files[0]);
        } else if (voiceSelectEl?.value) {
            const selectedOpt = voiceSelectEl.options[voiceSelectEl.selectedIndex];
            const fileName = selectedOpt?.dataset?.file || `${voiceSelectEl.value}.mp3`;
            try {
                body.sample_b64 = await fetchSampleAsBase64(fileName);
                body.voice_id = voiceSelectEl.value;
            } catch (e) {
                console.warn('Sample fetch failed:', e);
                body.voice_id = voiceSelectEl.value;
            }
        }

        if (!body.sample_b64 && !body.voice_id) {
            showToast('يرجى اختيار عينة أو رفع تسجيل في الوضع عالي الجودة', COLORS.TOAST_WARNING);
            btn.disabled = false;
            progressArea.style.display = 'none';
            return;
        }

        statusTxt.innerText = 'الحالة: جاري الإرسال...';
        progFill.style.width = '30%';

        const res = await fetch(`${API_BASE}/api/tts`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || `Server Error: ${res.status}`);

        if (data.success && data.job_id) {
            statusTxt.innerText = '🎨 جاري الاستنساخ بالذكاء الاصطناعي...';
            progFill.style.width = '60%';

            const evtSource = new EventSource(`${API_BASE}/api/progress/${data.job_id}`);
            evtSource.onmessage = function (event) {
                let progData;
                try { progData = JSON.parse(event.data); } catch (e) { return; }

                if (progData.status === 'completed') {
                    evtSource.close();
                    const totalMs = (performance.now() - t0).toFixed(0);
                    progFill.style.width = '100%';
                    statusTxt.innerText = '✅ تم استنساخ الصوت بنجاح!';
                    showToast(`اكتمل في ${(totalMs / 1000).toFixed(1)}s`, COLORS.TOAST_SUCCESS);

                    if (resCard) resCard.style.display = 'block';
                    const audEl = document.getElementById('audioResult');
                    const dl = document.getElementById('dlBtn');
                    if (audEl) audEl.src = progData.audio_url;
                    if (dl) {
                        dl.href = progData.audio_url;
                        dl.download = `tts_quality_${Date.now()}.wav`;
                    }

                    perfStats.innerHTML = `
                        <div class="perf-stat">
                            <i class="fas fa-clock"></i>
                            <span class="stat-label">المدة:</span>
                            <span class="stat-value">${(totalMs / 1000).toFixed(1)}s</span>
                        </div>
                        <div class="perf-stat">
                            <i class="fas fa-gem"></i>
                            <span class="stat-label">جودة عالية + استنساخ</span>
                        </div>`;

                    btn.disabled = false;
                    updateSidebarAuth();
                } else if (progData.status === 'failed') {
                    evtSource.close();
                    showToast('فشل التوليد', COLORS.TOAST_ERROR);
                    statusTxt.innerText = '❌ فشل التوليد';
                    progFill.style.background = COLORS.TOAST_ERROR;
                    btn.disabled = false;
                    updateSidebarAuth();
                }
            };
            evtSource.onerror = function () {
                evtSource.close();
                pollTtsStatus(data.job_id, btn, statusTxt, progFill, resCard, t0, perfStats);
            };
        } else {
            throw new Error(data.error || 'خطأ في بدء التوليد');
        }
    } catch (e) {
        console.error('Quality TTS Error:', e);
        showToast(e.message || 'خطأ في الاتصال', COLORS.TOAST_ERROR);
        progFill.style.background = COLORS.TOAST_ERROR;
        btn.disabled = false;
    }
}

async function pollTtsStatus(jobId, btn, statusTxt, progFill, resCard, t0, perfStats) {
    const token = localStorage.getItem('token');
    const start = Date.now();
    const TIMEOUT_MS = 10 * 60 * 1000;

    const poll = async () => {
        if (Date.now() - start > TIMEOUT_MS) {
            showToast('انتهت مهلة التوليد', COLORS.TOAST_ERROR);
            btn.disabled = false;
            return;
        }
        try {
            const res = await fetch(`${API_BASE}/api/job/${jobId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json().catch(() => ({}));
            if (data.status === 'completed') {
                const totalMs = (performance.now() - t0).toFixed(0);
                progFill.style.width = '100%';
                statusTxt.innerText = '✅ تم بنجاح!';
                showToast(`اكتمل في ${(totalMs / 1000).toFixed(1)}s`, COLORS.TOAST_SUCCESS);
                if (resCard) resCard.style.display = 'block';
                const audEl = document.getElementById('audioResult');
                const dl = document.getElementById('dlBtn');
                if (audEl) audEl.src = data.audio_url;
                if (dl) dl.href = data.audio_url;
                if (perfStats) {
                    perfStats.innerHTML = `
                        <div class="perf-stat">
                            <i class="fas fa-clock"></i>
                            <span class="stat-value">${(totalMs / 1000).toFixed(1)}s</span>
                        </div>`;
                }
                btn.disabled = false;
                updateSidebarAuth();
                return;
            }
            if (data.status === 'failed') {
                showToast('فشل التوليد', COLORS.TOAST_ERROR);
                statusTxt.innerText = '❌ فشل التوليد';
                progFill.style.background = COLORS.TOAST_ERROR;
                btn.disabled = false;
                updateSidebarAuth();
                return;
            }
            if (statusTxt) statusTxt.innerText = 'الحالة: التوليد جارٍ...';
            setTimeout(poll, 3000);
        } catch (e) {
            console.error('Poll error:', e);
            setTimeout(poll, 5000);
        }
    };
    poll();
}

document.addEventListener('DOMContentLoaded', () => {
    updateSidebarAuth();
    renderSampleVoices();
});
