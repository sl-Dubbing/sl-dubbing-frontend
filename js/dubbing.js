// dubbing.js — V5.0 Direct Upload + Parallel Multi-Lang

async function startDubbing() {
    const file = document.getElementById('mediaFile')?.files?.[0];
    const voiceSelect = document.getElementById('voiceSelect');
    const customVoice = document.getElementById('customVoice');
    const token = localStorage.getItem('token');

    if (!token) return showToast('يرجى تسجيل الدخول', '#f59e0b');
    if (!file) return showToast('ارفع ملفاً أولاً', '#ef4444');
    if (!window.selectedLangs || window.selectedLangs.size === 0)
        return showToast('اختر لغة', '#ef4444');

    const dubBtn = document.getElementById('dubBtn');
    const progressArea = document.getElementById('progressArea');
    const resultsCard = document.getElementById('resultsCard');
    const resultsList = document.getElementById('resultsList');
    const statusTxt = document.getElementById('statusTxt');
    const progFill = document.getElementById('progFill');

    dubBtn.disabled = true;
    progressArea.style.display = 'block';
    resultsCard.style.display = 'block';
    resultsList.innerHTML = '';
    progFill.style.width = '5%';
    statusTxt.innerText = '⚡ تجهيز الرفع...';

    try {
        // ============================================
        // 🚀 STEP 1: طلب presigned URL من Railway
        // ============================================
        const urlRes = await fetch(`${window.API_BASE}/api/upload-url`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                filename: file.name,
                content_type: file.type || 'video/mp4',
                size: file.size
            })
        });

        const urlData = await urlRes.json();
        if (!urlRes.ok || !urlData.success) {
            throw new Error(urlData.error || 'فشل الحصول على رابط الرفع');
        }

        const { upload_url, file_key } = urlData;
        progFill.style.width = '10%';
        statusTxt.innerText = `📤 رفع ${(file.size/1024/1024).toFixed(1)}MB إلى R2 مباشرة...`;

        // ============================================
        // 🚀 STEP 2: رفع مباشر لـ R2 (لا يمر بـ Railway!)
        // ============================================
        await uploadToR2(upload_url, file, (pct) => {
            progFill.style.width = (10 + pct * 0.5) + '%';
            statusTxt.innerText = `📤 رفع ${pct.toFixed(0)}%...`;
        }, file.type);

        progFill.style.width = '60%';
        statusTxt.innerText = '✅ الرفع اكتمل، بدء المعالجة...';

        // ============================================
        // 🚀 STEP 3: إرسال طلب الدبلجة لكل لغة بالتوازي
        // ============================================
        const langs = [...window.selectedLangs];
        const total = langs.length;
        let completed = 0;

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

        let sample_b64 = '';
        let voice_id_val = 'source';

        if (customVoice?.files?.[0]) {
            sample_b64 = await fileToBase64(customVoice.files[0]);
            voice_id_val = 'custom';
        } else if (voiceSelect?.value && voiceSelect.value !== 'original') {
            voice_id_val = voiceSelect.value;
        }

        const promises = langs.map(async (langCode) => {
            const lang = window.LANGUAGES?.find(l => l.code === langCode);
            const statusEl = document.getElementById(`status-${langCode}`);
            const bodyEl = document.getElementById(`body-${langCode}`);

            try {
                statusEl.textContent = 'يرسل...';

                const res = await fetch(`${window.API_BASE}/api/dub`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        file_key: file_key,
                        lang: langCode,
                        voice_id: voice_id_val,
                        sample_b64: sample_b64,
                        engine: '' 
                    })
                });

                const data = await res.json().catch(() => ({}));
                if (!res.ok || !data.success) throw new Error(data.error || `HTTP ${res.status}`);

                statusEl.textContent = 'يعالج...';
                bodyEl.innerHTML = '<div style="font-size:0.85rem;color:#2563eb;padding:6px;">🎬 Modal تعالج...</div>';

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
                const pct = 60 + Math.round((completed / total) * 40);
                progFill.style.width = pct + '%';
                statusTxt.innerText = `${completed}/${total} لغة مكتملة`;
            }
        });

        await Promise.all(promises);

        progFill.style.width = '100%';
        statusTxt.innerText = `✓ اكتملت ${total} لغة`;
        showToast(`تمت دبلجة ${total} لغة`, '#10b981');
        if (typeof checkAuth === 'function') checkAuth();

    } catch (e) {
        console.error('Dubbing error:', e);
        showToast(e.message || 'فشل الرفع', '#ef4444');
        statusTxt.innerText = '✗ ' + e.message;
        progFill.style.background = '#ef4444';
    } finally {
        dubBtn.disabled = false;
    }
}

function uploadToR2(presignedUrl, file, onProgress, contentType) {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('PUT', presignedUrl, true);
        xhr.setRequestHeader('Content-Type', contentType || 'application/octet-stream');

        xhr.upload.onprogress = (e) => {
            if (e.lengthComputable && onProgress) {
                onProgress((e.loaded / e.total) * 100);
            }
        };

        xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) resolve();
            else reject(new Error(`فشل الرفع (${xhr.status}): ${xhr.responseText.substring(0, 100)}`));
        };

        xhr.onerror = () => reject(new Error('خطأ شبكة - تحقق من CORS في R2'));
        xhr.ontimeout = () => reject(new Error('انتهت مهلة الرفع'));

        xhr.timeout = 30 * 60 * 1000; 
        xhr.send(file);
    });
}

async function waitForJob(jobId, token, statusEl) {
    const start = Date.now();
    const TIMEOUT = 30 * 60 * 1000;

    while (Date.now() - start < TIMEOUT) {
        try {
            const res = await fetch(`${window.API_BASE}/api/job/${jobId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.status === 'completed') return data;
            if (data.status === 'failed') throw new Error(data.error || 'فشلت المعالجة');
            if (statusEl) statusEl.textContent = `يعالج ${Math.round((Date.now()-start)/1000)}ث`;
        } catch (e) {
            if (e.message.includes('فشلت')) throw e;
            console.warn('Poll error:', e);
        }
        await new Promise(r => setTimeout(r, 3000));
    }
    throw new Error('انتهت المهلة');
}

function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onloadend = () => resolve(String(r.result).split(',')[1] || '');
        r.onerror = reject;
        r.readAsDataURL(file);
    });
}

function handleCustomVoice(input) {
    const txt = document.getElementById('customVoiceTxt');
    if (input.files && input.files[0]) {
        if (txt) { txt.textContent = '✓ ' + input.files[0].name; txt.style.color = '#10b981'; }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('dubBtn')?.addEventListener('click', startDubbing);
});

window.startDubbing = startDubbing;
window.handleCustomVoice = handleCustomVoice;
