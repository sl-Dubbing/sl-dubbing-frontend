// stt.js — Speech to Text with Direct R2 Upload
const STT_API_BASE = 'https://web-production-14a1.up.railway.app';

let currentMode = 'fast';

function switchMode(mode) {
    currentMode = mode;
    document.querySelectorAll('.mode-option').forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
    // إظهار خيار diarize فقط للوضع الدقيق
    const diarizeToggle = document.getElementById('diarizeToggle');
    if (diarizeToggle) diarizeToggle.style.display = mode === 'precise' ? 'flex' : 'none';
}

function uploadToR2(presignedUrl, file, onProgress, contentType) {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('PUT', presignedUrl, true);
        xhr.setRequestHeader('Content-Type', contentType || 'application/octet-stream');
        xhr.upload.onprogress = (e) => {
            if (e.lengthComputable && onProgress) onProgress((e.loaded / e.total) * 100);
        };
        xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) resolve();
            else reject(new Error(`فشل الرفع (${xhr.status})`));
        };
        xhr.onerror = () => reject(new Error('خطأ شبكة - تحقق من CORS'));
        xhr.timeout = 30 * 60 * 1000;
        xhr.send(file);
    });
}

async function startSTT() {
    const file = document.getElementById('mediaFile')?.files?.[0];
    const lang = document.getElementById('langSelect')?.value || 'auto';
    const translate = document.getElementById('translateChk')?.checked || false;
    const diarize = document.getElementById('diarizeChk')?.checked || false;
    const token = localStorage.getItem('token');

    if (!token) return showToast('يرجى تسجيل الدخول', '#f59e0b');
    if (!file) return showToast('ارفع ملفاً أولاً', '#ef4444');

    const sttBtn = document.getElementById('sttBtn');
    const progArea = document.getElementById('progressArea');
    const resultsCard = document.getElementById('resultsCard');
    const statusTxt = document.getElementById('statusTxt');
    const progFill = document.getElementById('progFill');

    sttBtn.disabled = true;
    progArea.style.display = 'block';
    resultsCard.style.display = 'none';
    progFill.style.width = '5%';
    statusTxt.innerText = '⚡ تجهيز الرفع...';

    try {
        // 1️⃣ Get presigned URL
        const urlRes = await fetch(`${STT_API_BASE}/api/upload-url`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                filename: file.name,
                content_type: file.type || 'audio/mpeg',
                size: file.size
            })
        });
        const urlData = await urlRes.json();
        if (!urlRes.ok || !urlData.success) throw new Error(urlData.error || 'فشل');

        progFill.style.width = '10%';
        statusTxt.innerText = `📤 رفع ${(file.size/1024/1024).toFixed(1)}MB...`;

        // 2️⃣ Upload directly to R2
        await uploadToR2(urlData.upload_url, file, (pct) => {
            progFill.style.width = (10 + pct * 0.4) + '%';
            statusTxt.innerText = `📤 رفع ${pct.toFixed(0)}%...`;
        }, file.type);

        progFill.style.width = '50%';
        statusTxt.innerText = '🎙️ بدء التفريغ...';

        // 3️⃣ Start STT
        const sttRes = await fetch(`${STT_API_BASE}/api/stt`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                file_key: urlData.file_key,
                language: lang,
                mode: currentMode,
                diarize: diarize,
                translate: translate,
            })
        });
        const sttData = await sttRes.json();
        if (!sttRes.ok || !sttData.success) throw new Error(sttData.error || 'فشل');

        statusTxt.innerText = '🎙️ يعالج...';
        progFill.style.width = '60%';

        // 4️⃣ Poll for result
        const result = await waitForJob(sttData.job_id, token, statusTxt, progFill);

        // 5️⃣ Display results
        progFill.style.width = '100%';
        statusTxt.innerText = '✓ اكتمل';
        resultsCard.style.display = 'block';
        await displayResult(result, currentMode);

        showToast('تم التفريغ بنجاح', '#10b981');
        if (typeof checkAuth === 'function') checkAuth();

    } catch (e) {
        console.error('STT error:', e);
        showToast(e.message || 'فشل التفريغ', '#ef4444');
        statusTxt.innerText = '✗ ' + e.message;
        progFill.style.background = '#ef4444';
    } finally {
        sttBtn.disabled = false;
    }
}

async function waitForJob(jobId, token, statusEl, progFill) {
    const start = Date.now();
    const TIMEOUT = 30 * 60 * 1000;
    while (Date.now() - start < TIMEOUT) {
        try {
            const res = await fetch(`${STT_API_BASE}/api/job/${jobId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.status === 'completed') return data;
            if (data.status === 'failed') throw new Error(data.error || 'فشل');
            const elapsed = Math.round((Date.now() - start) / 1000);
            if (statusEl) statusEl.textContent = `يعالج ${elapsed}ث`;
            if (progFill) {
                const pct = Math.min(95, 60 + elapsed * 0.5);
                progFill.style.width = pct + '%';
            }
        } catch (e) {
            if (e.message.includes('فشل')) throw e;
            console.warn(e);
        }
        await new Promise(r => setTimeout(r, 3000));
    }
    throw new Error('انتهت المهلة');
}

async function displayResult(jobData, mode) {
    const transcriptBox = document.getElementById('transcriptBox');
    const downloadRow = document.getElementById('downloadRow');
    const metaInfo = document.getElementById('metaInfo');

    // jobData.audio_url هو URL للـ JSON (احفظنا التفريغ كـ JSON)
    if (!jobData.audio_url) {
        transcriptBox.innerHTML = '<div style="color:#ef4444;">لا توجد نتيجة</div>';
        return;
    }

    try {
        const res = await fetch(jobData.audio_url);
        const data = await res.json();

        // Meta
        const meta = [];
        if (data.detected_language) meta.push(`🌍 ${data.detected_language}`);
        if (data.duration) meta.push(`⏱️ ${data.duration.toFixed(1)}s`);
        if (data.segment_count) meta.push(`📝 ${data.segment_count} مقطع`);
        if (data.engine) meta.push(`🎯 ${data.engine}`);
        if (metaInfo) metaInfo.innerHTML = meta.join(' • ');

        // Transcript
        const segments = data.segments || [];
        if (segments.length === 0) {
            transcriptBox.innerHTML = `<div>${escapeHtml(data.text || '')}</div>`;
        } else {
            transcriptBox.innerHTML = segments.map(seg => {
                const start = formatTime(seg.start);
                const end = formatTime(seg.end);
                const speaker = seg.speaker ? `<span class="speaker">${seg.speaker}</span>` : '';
                return `<div class="segment">
                    <span class="timestamp">${start} → ${end}</span>${speaker}
                    <div>${escapeHtml(seg.text)}</div>
                </div>`;
            }).join('');
        }

        // Download buttons
        downloadRow.innerHTML = '';
        const formats = [
            { key: 'text_url', label: 'TXT', icon: 'file-alt' },
            { key: 'srt_url', label: 'SRT', icon: 'closed-captioning' },
            { key: 'vtt_url', label: 'VTT', icon: 'video' },
            { key: 'json_url', label: 'JSON', icon: 'code' },
        ];
        // المسار الذي حفظناه هو jobData.audio_url (JSON)
        // نضيف الباقي إذا وُجد في الـ data
        formats.forEach(fmt => {
            const url = data[fmt.key] || (fmt.key === 'json_url' ? jobData.audio_url : null);
            if (url) {
                const a = document.createElement('a');
                a.href = url;
                a.target = '_blank';
                a.className = 'btn-download';
                a.innerHTML = `<i class="fas fa-${fmt.icon}"></i> تحميل ${fmt.label}`;
                downloadRow.appendChild(a);
            }
        });

        // زر نسخ النص
        const copyBtn = document.createElement('button');
        copyBtn.className = 'btn-secondary';
        copyBtn.innerHTML = '<i class="fas fa-copy"></i> نسخ النص';
        copyBtn.onclick = () => {
            navigator.clipboard.writeText(data.text || '').then(() => {
                showToast('تم النسخ', '#10b981');
            });
        };
        downloadRow.appendChild(copyBtn);

    } catch (e) {
        console.error('Failed to load transcript:', e);
        transcriptBox.innerHTML = `<div style="color:#ef4444;">فشل تحميل النتيجة</div>`;
    }
}

function formatTime(seconds) {
    if (!seconds && seconds !== 0) return '00:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

function escapeHtml(s) {
    return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('chooseMediaBtn')?.addEventListener('click', () => document.getElementById('mediaFile')?.click());
    document.getElementById('mediaFile')?.addEventListener('change', () => {
        const f = document.getElementById('mediaFile').files?.[0];
        const txt = document.getElementById('fileTxt');
        if (f && txt) { txt.textContent = `✓ ${f.name} (${(f.size/1024/1024).toFixed(1)}MB)`; txt.style.color = '#34c759'; }
    });
    document.getElementById('sttBtn')?.addEventListener('click', startSTT);

    document.querySelectorAll('.mode-option').forEach(b =>
        b.addEventListener('click', () => switchMode(b.dataset.mode))
    );

    // Toggle classes
    ['translateChk', 'diarizeChk'].forEach(id => {
        const chk = document.getElementById(id);
        const lbl = chk?.parentElement;
        if (chk && lbl) {
            chk.addEventListener('change', () => {
                lbl.classList.toggle('active', chk.checked);
            });
        }
    });
});

window.startSTT = startSTT;
