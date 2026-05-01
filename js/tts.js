const TTS_API_BASE = 'https://web-production-14a1.up.railway.app';
const SAMPLES_BASE = 'samples';

// 🔄 دالة جديدة لتحديث الرصيد في الواجهة
function updateCreditsUI(credits) {
    if (isNaN(credits)) return;
    // تأكد أن تضع id="user-credits" في ملف HTML للعنصر الذي يعرض الرقم
    const creditsEl = document.getElementById('user-credits'); 
    if (creditsEl) {
        creditsEl.innerText = `${credits} نقطة`;
    }
}

// 🔄 دالة لجلب الرصيد من السيرفر عند فتح الصفحة
async function fetchInitialBalance() {
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
        const res = await fetch(`${TTS_API_BASE}/api/user`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.success && data.user) {
            updateCreditsUI(data.user.credits);
        }
    } catch (e) { console.warn('لم يتم جلب الرصيد الأولي', e); }
}

async function loadSamples() {
    const select = document.getElementById('voiceSelect');
    if (!select) return;
    try {
        const res = await fetch(`${SAMPLES_BASE}/manifest.json?t=${Date.now()}`);
        if (!res.ok) return;
        const data = await res.json();
        (data.voices || []).forEach(v => {
            const opt = document.createElement('option');
            opt.value = v.id;
            opt.textContent = `${v.icon || '🎤'} ${v.label || v.id}`;
            opt.dataset.file = v.file || `${v.id}.mp3`;
            select.appendChild(opt);
        });
    } catch (e) { console.warn(e); }
}

function fileToB64(file) {
    return new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onloadend = () => resolve(String(r.result).split(',')[1] || '');
        r.onerror = reject;
        r.readAsDataURL(file);
    });
}

async function fetchSampleB64(filename) {
    const res = await fetch(`${SAMPLES_BASE}/${filename}`);
    if (!res.ok) throw new Error('فشل جلب العينة');
    const blob = await res.blob();
    return fileToB64(new File([blob], filename));
}

async function instantPlay() {
    const text = document.getElementById('ttsInput')?.value?.trim();
    if (!text) return showToast('اكتب النص أولاً', '#ef4444');
    const lang = window.selectedLangs?.size ? [...window.selectedLangs][0] : 'ar';
    const btn = document.getElementById('ttsInstantBtn');
    const progArea = document.getElementById('progressArea');
    const statusTxt = document.getElementById('statusTxt');
    const progFill = document.getElementById('progFill');
    const resultsCard = document.getElementById('resultsCard');
    const resultsList = document.getElementById('resultsList');

    btn.disabled = true;
    progArea.style.display = 'block';
    resultsCard.style.display = 'none';
    statusTxt.innerText = '⚡ التواصل مع الخادم...';
    progFill.style.width = '20%';

    try {
        const result = await window.quickTTS(text, { lang });
        progFill.style.width = '100%';
        statusTxt.innerText = `✓ ${result.totalTime.toFixed(0)}ms`;
        result.audio.play().catch(() => showToast('اضغط ▶️', '#f59e0b'));

        // 🎯 تحديث الرصيد بعد التوليد الناجح
        updateCreditsUI(result.remainingCredits);

        const ld = window.LANGUAGES?.find(l => l.code === lang);
        resultsCard.style.display = 'block';
        resultsList.innerHTML = `
            <div class="result-item">
                <div class="result-item-header">
                    <span class="result-item-flag">${ld?.flag || '🌍'}</span>
                    <span class="result-item-name">${ld?.name_ar || lang}</span>
                    <span class="result-item-status success">✓</span>
                </div>
                <audio controls src="${result.url}"></audio>
                <a href="${result.url}" id="download-${lang}" download="tts_${lang}_${Date.now()}.mp3" class="btn-download" style="margin-top:8px;"><i class="fas fa-download"></i> تحميل</a>
            </div>`;

        // تفعيل زر التحميل بعد اكتمال البث المباشر
        if (result.blobPromise) {
            result.blobPromise.then(finalUrl => {
                const dlBtn = document.getElementById(`download-${lang}`);
                if (dlBtn) dlBtn.href = finalUrl;
            });
        }
        
        showToast(`⚡ ${result.totalTime.toFixed(0)}ms`, '#10b981');
    } catch (e) {
        showToast(e.message, '#ef4444');
        statusTxt.innerText = '✗ ' + e.message;
        progFill.style.background = '#ef4444';
    } finally {
        btn.disabled = false;
    }
}

async function startTTS() {
    const text = document.getElementById('ttsInput')?.value?.trim();
    const token = localStorage.getItem('token');
    if (!token) return showToast('يرجى تسجيل الدخول', '#f59e0b');
    if (!text) return showToast('اكتب النص', '#ef4444');
    if (!window.selectedLangs?.size) return showToast('اختر لغة', '#ef4444');

    const mode = document.body.dataset.mode || 'fast';
    const baseBody = { text, translate: true };

    if (mode === 'quality') {
        const cv = document.getElementById('customVoice');
        const vs = document.getElementById('voiceSelect');
        if (cv?.files?.[0]) {
            baseBody.sample_b64 = await fileToB64(cv.files[0]);
        } else if (vs?.value) {
            const opt = vs.options[vs.selectedIndex];
            try {
                baseBody.sample_b64 = await fetchSampleB64(opt?.dataset?.file || `${vs.value}.mp3`);
                baseBody.voice_id = vs.value;
            } catch (e) { baseBody.voice_id = vs.value; }
        }
        if (!baseBody.sample_b64 && !baseBody.voice_id) {
            return showToast('اختر عينة أو ارفع تسجيلاً', '#f59e0b');
        }
    }

    const btn = document.getElementById('ttsBtn');
    const progArea = document.getElementById('progressArea');
    const resultsCard = document.getElementById('resultsCard');
    const resultsList = document.getElementById('resultsList');
    const statusTxt = document.getElementById('statusTxt');
    const progFill = document.getElementById('progFill');

    btn.disabled = true;
    progArea.style.display = 'block';
    resultsCard.style.display = 'block';
    resultsList.innerHTML = '';
    progFill.style.width = '5%';

    const langs = [...window.selectedLangs];
    const total = langs.length;
    let completed = 0;
    statusTxt.innerText = `بدء ${total} لغة بالتوازي...`;

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
            <div id="body-${code}" style="font-size:0.85rem;color:#9aa1ac;padding:6px;">⏳ جاري...</div>
        `;
        resultsList.appendChild(card);
    });

    const t0 = performance.now();
    const promises = langs.map(async (code) => {
        const lang = window.LANGUAGES?.find(l => l.code === code);
        const statusEl = document.getElementById(`status-${code}`);
        const bodyEl = document.getElementById(`body-${code}`);
        try {
            statusEl.textContent = 'يرسل...';
            const body = Object.assign({}, baseBody, { lang: code });
            const res = await fetch(`${TTS_API_BASE}/api/tts/smart`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data.success) throw new Error(data.error || `HTTP ${res.status}`);

            statusEl.textContent = 'يعالج...';
            bodyEl.innerHTML = '<div style="font-size:0.85rem;color:#2563eb;padding:6px;">🎤 يعالج...</div>';

            const final = await waitForJob(data.job_id, token, statusEl);

            statusEl.textContent = '✓ مكتمل';
            statusEl.classList.add('success');
            bodyEl.innerHTML = `
                <audio controls src="${final.audio_url}"></audio>
                <a href="${final.audio_url}" download="tts_${code}_${Date.now()}.mp3" class="btn-download" style="margin-top:8px;"><i class="fas fa-download"></i> تحميل ${lang.name_ar}</a>
            `;
        } catch (e) {
            statusEl.textContent = '✗ فشل';
            statusEl.classList.add('error');
            bodyEl.innerHTML = `<div style="color:#ef4444;font-size:0.85rem;padding:6px;">${e.message}</div>`;
        } finally {
            completed++;
            progFill.style.width = (Math.round((completed/total)*95)+5) + '%';
            statusTxt.innerText = `${completed}/${total} لغة`;
        }
    });

    await Promise.all(promises);
    
    // 🎯 تحديث الرصيد بعد انتهاء الوضع الذكي أيضاً
    fetchInitialBalance(); 

    const totalMs = (performance.now() - t0).toFixed(0);
    progFill.style.width = '100%';
    statusTxt.innerText = `✓ اكتمل في ${(totalMs/1000).toFixed(1)}s`;
    showToast(`${total} لغة في ${(totalMs/1000).toFixed(1)}s`, '#10b981');
    btn.disabled = false;
}

async function waitForJob(jobId, token, statusEl) {
    const start = Date.now();
    const TIMEOUT = 10 * 60 * 1000;
    while (Date.now() - start < TIMEOUT) {
        try {
            const res = await fetch(`${TTS_API_BASE}/api/job/${jobId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.status === 'completed') return data;
            if (data.status === 'failed') throw new Error('فشلت المعالجة');
            if (statusEl) statusEl.textContent = `يعالج ${Math.round((Date.now()-start)/1000)}ث`;
        } catch (e) { console.warn(e); }
        await new Promise(r => setTimeout(r, 2500));
    }
    throw new Error('انتهت المهلة');
}

function switchMode(mode) {
    document.body.dataset.mode = mode;
    document.querySelectorAll('.mode-option').forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
    const ib = document.getElementById('ttsInstantBtn');
    if (ib) ib.style.display = mode === 'fast' ? 'flex' : 'none';
}

document.addEventListener('DOMContentLoaded', () => {
    loadSamples();
    fetchInitialBalance(); // 🎯 جلب الرصيد بمجرد فتح الصفحة
    document.getElementById('ttsBtn')?.addEventListener('click', startTTS);
    document.getElementById('ttsInstantBtn')?.addEventListener('click', instantPlay);
    document.getElementById('uploadVoiceBtn')?.addEventListener('click', () => document.getElementById('customVoice')?.click());
    document.getElementById('customVoice')?.addEventListener('change', (e) => {
        const f = e.target.files?.[0];
        const txt = document.getElementById('customVoiceTxt');
        if (f && txt) { txt.textContent = '✓ ' + f.name; txt.style.color = '#10b981'; }
    });
    document.querySelectorAll('.mode-option').forEach(b => b.addEventListener('click', () => switchMode(b.dataset.mode)));
    const ti = document.getElementById('ttsInput');
    const cc = document.getElementById('charCount');
    if (ti && cc) ti.addEventListener('input', () => cc.textContent = ti.value.length);
});

window.startTTS = startTTS;
window.instantPlay = instantPlay;
