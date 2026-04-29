// tts.js — مُعدّل: دعم cookie/header auth, FormData للـ quality, polling محسّن
const SERVER_BASE = 'https://web-production-14a1.up.railway.app';
const SAMPLES_BASE = 'samples';

// =======================
// مساعدة: إعداد fetch مع دعم token أو cookie
// =======================
function makeFetchOptions(method = 'GET', token = null, body = null, isJson = true) {
    const opts = { method };
    if (token) {
        opts.headers = { 'Authorization': `Bearer ${token}` };
        if (isJson) opts.headers['Content-Type'] = 'application/json';
    } else {
        // الاعتماد على HttpOnly cookie
        opts.credentials = 'include';
        if (isJson) opts.headers = { 'Content-Type': 'application/json' };
    }
    if (body !== null) opts.body = body;
    return opts;
}

// =======================
// logout (محسّن) — يراعي cookie أو token
// =======================
function logout() {
    // إزالة التوكن المحلي فوراً
    localStorage.removeItem('token');
    // حاول إخطار الخادم (يعتمد على cookie أو token)
    const token = localStorage.getItem('token');
    const opts = token ? makeFetchOptions('POST', token, null, false) : makeFetchOptions('POST', null, null, false);
    fetch(`${SERVER_BASE}/api/logout`, opts).catch(() => {});
    // إعادة تحميل الواجهة لإظهار حالة غير مسجل
    location.reload();
}

// =======================
// العينات (samples)
// =======================
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

// =======================
// التشغيل الفوري (instantPlay) — يعتمد على quickTTS الموجود في tts-quick.js
// =======================
async function instantPlay() {
    const text = document.getElementById('ttsInput')?.value?.trim();
    const lang = [...selectedLangs][0] || 'ar';
    const rate = document.getElementById('rateSelect')?.value || '+0%';
    const pitch = document.getElementById('pitchSelect')?.value || '+0Hz';

    if (!text) return showToast('اكتب النص أولاً', 'error');

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
        const token = localStorage.getItem('token');
        const result = await quickTTS(text, { lang, rate, pitch, token });

        statusTxt.innerText = '✓ جاري التشغيل';
        progFill.style.width = '100%';

        result.audio.play().catch(() => {
            showToast('اضغط ▶️ في المشغّل', 'warning');
        });

        const langData = window.LANGUAGES?.find(l => l.code === lang);
        showSingleResult(lang, langData, result.url);

        showToast(`⚡ ${(result.totalTime || 0).toFixed(0)}ms`, 'success');
        updateSidebarAuth();
    } catch (e) {
        console.error('Instant TTS error:', e);
        showToast(e.message || 'فشل التوليد', 'error
