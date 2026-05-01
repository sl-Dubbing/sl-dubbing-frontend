// dubbing.js — معالجة متوازية حقيقية لكل اللغات
// تم تغيير اسم المتغير إلى DUB_API_BASE لتجنب التعارض مع ملف shared.js
const DUB_API_BASE = 'https://web-production-14a1.up.railway.app';

async function startDubbing() {
    const file = document.getElementById('mediaFile')?.files?.[0];
    const voiceSelect = document.getElementById('voiceSelect');
    const customVoice = document.getElementById('customVoice');
    const token = localStorage.getItem('token');

    if (!token) return showToast('يرجى تسجيل الدخول', '#f59e0b');
    if (!file) return showToast('ارفع ملفاً أولاً', '#ef4444');
    if (!window.selectedLangs || window.selectedLangs.size === 0) return showToast('اختر لغة', '#ef4444');

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
    progFill.style.width = '5%';

    const langs = [...window.selectedLangs];
    const total = langs.length;
    let completed = 0;

    statusTxt.innerText = `بدء معالجة ${total} لغة بالتوازي...`;
    if (miniStatus) miniStatus.textContent = `يعالج ${total} لغة`;

    // إنشاء بطاقة لكل لغة
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
            <div id="body-${code}" style="font-size:0.85rem;color:#9aa1ac;padding:6px;">⏳ جاري الإرسال...</div>
        `;
        resultsList.appendChild(card);
    });

    // 🚀 معالجة متوازية — كل لغة ترسل request مستقل في نفس الوقت
    const promises = langs.map(async (langCode) => {
        const lang = window.LANGUAGES?.find(l => l.code === langCode);
        const statusEl = document.getElementById(`status-${langCode}`);
        const bodyEl = document.getElementById(`body-${langCode}`);

        try {
            statusEl.textContent = 'جاري الرفع...';

            const formData = new FormData();
            formData.append('media_file', file);
            formData.append('lang', langCode);

            if (customVoice?.files?.[0]) {
                formData.append('voice_sample', customVoice.files[0]);
                formData.append('voice_id', 'custom');
            } else if (voiceSelect?.value && voiceSelect.value !== 'original') {
                formData.append('voice_id', voiceSelect.value);
            } else {
                formData.append('voice_id', 'source');
            }

            // استخدام المتغير الجديد هنا
            const res = await fetch(`${DUB_API_BASE}/api/dub`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            });

            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data.success) throw new Error(data.error || `HTTP ${res.status}`);

            statusEl.textContent = 'جاري المعالجة...';
            bodyEl.innerHTML = '<div style="font-size:0.85rem;color:#2563eb;padding:6px;">🎬 Modal تعالج المقاطع...</div>';

            const finalData = await waitForJob(data.job_id, token, statusEl);

            statusEl.textContent = '✓ مكتمل';
            statusEl.classList.add('success');
            bodyEl.innerHTML = `
                <audio controls src="${finalData.audio_url}"></audio>
                <a href="${finalData.audio_url}" download="dub_${langCode}_${Date.now()}.wav" class="btn-download" style="margin-top:8px;">
                    <i class="fas fa-download"></i> تحميل ${lang.name_ar}
                </a>
            `;
        } catch (e) {
            console.error(`Lang ${langCode} failed:`, e);
            statusEl.textContent = '✗ فشل';
            statusEl.classList.add('error');
            bodyEl.innerHTML = `<div style="color:#ef4444;font-size:0.85rem;padding:6px;">${e.message}</div>`;
        } finally {
            completed++;
            const pct = Math.round((completed / total) * 95) + 5;
            progFill.style.width = pct + '%';
            statusTxt.innerText = `${completed}/${total} لغة مكتملة`;
        }
    });

    await Promise.all(promises);

    progFill.style.width = '100%';
    statusTxt.innerText = `✓ اكتملت ${total} لغة`;
    if (miniStatus) miniStatus.textContent = 'مكتمل';
    showToast(`تمت دبلجة ${total} لغة`, '#10b981');
    dubBtn.disabled = false;
    if (typeof checkAuth === 'function') checkAuth();
}

async function waitForJob(jobId, token, statusEl) {
    const start = Date.now();
    const TIMEOUT = 30 * 60 * 1000;

    while (Date.now() - start < TIMEOUT) {
        try {
            // استخدام المتغير الجديد هنا أيضاً
            const res = await fetch(`${DUB_API_BASE}/api/job/${jobId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.status === 'completed') return data;
            if (data.status === 'failed') throw new Error('فشلت المعالجة في Modal');
            if (statusEl) statusEl.textContent = `جاري المعالجة... ${Math.round((Date.now() - start)/1000)}ث`;
        } catch (e) { console.warn('Poll error:', e); }
        await new Promise(r => setTimeout(r, 3000));
    }
    throw new Error('انتهت المهلة');
}

function handleCustomVoice(input) {
    const txt = document.getElementById('customVoiceTxt');
    if (input.files && input.files[0]) {
        if (txt) { txt.textContent = '✓ ' + input.files[0].name; txt.style.color = '#10b981'; }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('chooseMediaBtn')?.addEventListener('click', () => {
        document.getElementById('mediaFile')?.click();
    });

    document.getElementById('mediaFile')?.addEventListener('change', () => {
        const f = document.getElementById('mediaFile').files?.[0];
        const txt = document.getElementById('fileTxt');
        if (f && txt) { txt.textContent = '✓ ' + f.name; txt.style.color = '#10b981'; }
    });

    document.getElementById('chooseCustomVoiceBtn')?.addEventListener('click', () => {
        document.getElementById('customVoice')?.click();
    });

    document.getElementById('customVoice')?.addEventListener('change', (e) => handleCustomVoice(e.target));
    
    document.getElementById('dubBtn')?.addEventListener('click', startDubbing);
});

window.startDubbing = startDubbing;
window.handleCustomVoice = handleCustomVoice;
