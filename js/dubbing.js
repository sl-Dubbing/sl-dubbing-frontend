// dubbing.js — V6.5 (Audio Waveform + Video Toggle Support)

async function startDubbing() {
    const file = document.getElementById('mediaFile')?.files?.[0];
    const voiceSelect = document.getElementById('voiceSelect');
    
    const customVoiceInput = document.getElementById('customVoiceInput');
    const lipsyncToggle = document.getElementById('lipsyncToggle');
    const videoToggle = document.getElementById('videoToggle'); // الزر الجديد
    const token = localStorage.getItem('token');

    if (!token) return showToast('يرجى تسجيل الدخول أولاً', '#f59e0b');
    if (!file) return showToast('يرجى اختيار ملف فيديو أو صوت', '#ef4444');
    if (!window.selectedLangs || window.selectedLangs.size === 0)
        return showToast('يرجى اختيار لغة واحدة على الأقل', '#ef4444');

    const dubBtn = document.getElementById('dubBtn');
    const progressArea = document.getElementById('progressArea');
    const resultsCard = document.getElementById('resultsCard');
    const resultsList = document.getElementById('resultsList');
    const statusTxt = document.getElementById('statusTxt');
    const progFill = document.getElementById('progFill');

    dubBtn.style.display = 'none'; 
    progressArea.style.display = 'block';
    resultsCard.style.display = 'block';
    resultsList.innerHTML = '';
    progFill.style.width = '5%';
    statusTxt.innerText = '⚡ جاري تجهيز الرابط الآمن...';

    try {
        const urlRes = await fetch(`${window.API_BASE}/api/upload-url`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename: file.name, content_type: file.type || 'video/mp4', size: file.size })
        });

        const urlData = await urlRes.json();
        if (!urlRes.ok || !urlData.success) throw new Error(urlData.error || 'فشل الحصول على رابط الرفع');

        const { upload_url, file_key } = urlData;
        progFill.style.width = '10%';
        statusTxt.innerText = `📤 جاري الرفع المباشر (${(file.size/1024/1024).toFixed(1)}MB)...`;

        await uploadToR2(upload_url, file, (pct) => {
            progFill.style.width = (10 + pct * 0.5) + '%';
            statusTxt.innerText = `📤 اكتمل الرفع بنسبة ${pct.toFixed(0)}%...`;
        }, file.type);

        progFill.style.width = '60%';
        statusTxt.innerText = '✅ اكتمل الرفع، يبدأ الآن سحر الذكاء الاصطناعي...';

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
                <div id="body-${code}" style="font-size:0.85rem;color:#9aa1ac;padding:6px;">⏳ جاري إرسال الطلب...</div>
            `;
            resultsList.appendChild(card);
        });

        let sample_b64 = '';
        let voice_id_val = 'source'; 

        if (voiceSelect?.value === 'custom' && customVoiceInput?.files?.[0]) {
            sample_b64 = await fileToBase64(customVoiceInput.files[0]);
            voice_id_val = 'source'; 
        } else if (voiceSelect?.value && voiceSelect.value !== 'source' && voiceSelect.value !== 'custom') {
            voice_id_val = voiceSelect.value;
        }

        const isLipSyncEnabled = lipsyncToggle ? lipsyncToggle.checked : false;
        const isVideoOutput = videoToggle ? videoToggle.checked : true; // قراءة زر الفيديو

        const promises = langs.map(async (langCode) => {
            const lang = window.LANGUAGES?.find(l => l.code === langCode);
            const statusEl = document.getElementById(`status-${langCode}`);
            const bodyEl = document.getElementById(`body-${langCode}`);

            try {
                statusEl.textContent = 'جاري الإرسال...';

                const res = await fetch(`${window.API_BASE}/api/dub`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        file_key: file_key,
                        filename: file.name,
                        lang: langCode,
                        voice_id: voice_id_val,
                        sample_b64: sample_b64,
                        with_lipsync: isLipSyncEnabled,
                        return_video: isVideoOutput, // إرسال رغبة المستخدم للسيرفر
                        engine: 'auto'
                    })
                });

                const data = await res.json().catch(() => ({}));
                if (!res.ok || !data.success) throw new Error(data.error || `Error ${res.status}`);

                statusEl.textContent = 'جاري المعالجة...';
                bodyEl.innerHTML = '<div style="font-size:0.85rem;color:#2563eb;padding:6px;">🎬 جاري العمل على الملف...</div>';

                const finalData = await waitForJob(data.job_id, token, statusEl);

                statusEl.textContent = '✓ اكتمل';
                statusEl.classList.add('success');
                
                const isVideo = finalData.output_url.toLowerCase().endsWith('.mp4');

                if (isVideo) {
                    // إذا كان الناتج فيديو
                    bodyEl.innerHTML = `
                        <video controls src="${finalData.output_url}" style="width:100%; border-radius:8px; margin-top:8px; background:#000;"></video>
                        <a href="${finalData.output_url}" download="dub_${langCode}" class="btn-download" style="margin-top:8px; display:inline-block;">
                            <i class="fas fa-download"></i> تحميل الفيديو
                        </a>
                    `;
                } else {
                    // 🌟 إذا كان الناتج صوت (هنا سحر الموجات الصوتية)
                    const waveId = `waveform-${langCode}`;
                    bodyEl.innerHTML = `
                        <div style="background: #f8fafc; border-radius: 8px; padding: 15px; margin-top: 8px; border: 1px solid #e2e8f0;">
                            <div id="${waveId}"></div>
                            <div style="display:flex; justify-content:space-between; align-items:center; margin-top:10px;">
                                <button id="playBtn-${langCode}" style="background:#3b82f6; color:#fff; border:none; padding:6px 12px; border-radius:6px; cursor:pointer;">
                                    <i class="fas fa-play"></i> تشغيل
                                </button>
                                <a href="${finalData.output_url}" download="dub_${langCode}.wav" style="color:#10b981; font-weight:bold; text-decoration:none;">
                                    <i class="fas fa-download"></i> تحميل الصوت
                                </a>
                            </div>
                        </div>
                    `;

                    // تفعيل مكتبة WaveSurfer لرسم الموجات
                    const wavesurfer = WaveSurfer.create({
                        container: `#${waveId}`,
                        waveColor: '#93c5fd', // لون الموجة
                        progressColor: '#2563eb', // لون الموجة عند التشغيل
                        barWidth: 3,
                        barRadius: 3,
                        cursorWidth: 1,
                        height: 50,
                        url: finalData.output_url
                    });

                    const playBtn = document.getElementById(`playBtn-${langCode}`);
                    playBtn.onclick = () => {
                        wavesurfer.playPause();
                        playBtn.innerHTML = wavesurfer.isPlaying() ? '<i class="fas fa-pause"></i> إيقاف' : '<i class="fas fa-play"></i> تشغيل';
                    };
                }

            } catch (e) {
                console.error(`Lang ${langCode} failed:`, e);
                statusEl.textContent = '✗ فشل';
                statusEl.classList.add('error');
                bodyEl.innerHTML = `<div style="color:#ef4444;font-size:0.85rem;padding:6px;">${e.message}</div>`;
            } finally {
                completed++;
                const pct = 60 + Math.round((completed / total) * 40);
                progFill.style.width = pct + '%';
                statusTxt.innerText = `تمت معالجة ${completed} من أصل ${total} لغة`;
            }
        });

        await Promise.all(promises);

        progFill.style.width = '100%';
        statusTxt.innerText = `✓ اكتملت المعالجة بنجاح!`;
        if (typeof checkAuth === 'function') checkAuth();

    } catch (e) {
        showToast(e.message || 'حدث خطأ أثناء المعالجة', '#ef4444');
        statusTxt.innerText = '✗ فشل العملية: ' + e.message;
        progFill.style.background = '#ef4444';
    } finally {
        dubBtn.style.display = 'block'; 
        dubBtn.disabled = false;
    }
}

function uploadToR2(presignedUrl, file, onProgress, contentType) {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('PUT', presignedUrl, true);
        xhr.setRequestHeader('Content-Type', contentType || 'application/octet-stream');
        xhr.upload.onprogress = (e) => { if (e.lengthComputable && onProgress) onProgress((e.loaded / e.total) * 100); };
        xhr.onload = () => { if (xhr.status >= 200 && xhr.status < 300) resolve(); else reject(new Error(`فشل الرفع (${xhr.status})`)); };
        xhr.onerror = () => reject(new Error('خطأ في الشبكة أثناء الرفع'));
        xhr.send(file);
    });
}

async function waitForJob(jobId, token, statusEl) {
    const start = Date.now();
    const TIMEOUT = 30 * 60 * 1000; 
    while (Date.now() - start < TIMEOUT) {
        try {
            const res = await fetch(`${window.API_BASE}/api/job/${jobId}`, { headers: { 'Authorization': `Bearer ${token}` } });
            const data = await res.json();
            if (data.status === 'completed') return data;
            if (data.status === 'failed') throw new Error(data.error || 'فشلت معالجة الملف');
            if (statusEl) statusEl.textContent = `جاري المعالجة (${Math.round((Date.now()-start)/1000)}ث)`;
        } catch (e) { if (e.message.includes('فشلت')) throw e; }
        await new Promise(r => setTimeout(r, 3000));
    }
    throw new Error('انتهت مهلة الانتظار');
}

function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onloadend = () => resolve(String(r.result).split(',')[1] || '');
        r.onerror = reject;
        r.readAsDataURL(file);
    });
}

// 🌟 تحديث ذكي للواجهة: تعطيل الأزرار عند رفع ملف صوتي
document.addEventListener('DOMContentLoaded', () => {
    const dubBtn = document.getElementById('dubBtn');
    if (dubBtn) dubBtn.addEventListener('click', startDubbing);

    const fileInput = document.getElementById('mediaFile');
    const videoToggle = document.getElementById('videoToggle');
    const lipsyncToggle = document.getElementById('lipsyncToggle');

    if (fileInput) {
        fileInput.addEventListener('change', function() {
            const file = this.files[0];
            if (file && file.type.startsWith('audio/')) {
                // إذا رفع صوتاً، نلغي تفعيل الفيديو و LipSync إجبارياً
                if(videoToggle) { videoToggle.checked = false; videoToggle.disabled = true; }
                if(lipsyncToggle) { lipsyncToggle.checked = false; lipsyncToggle.disabled = true; }
            } else {
                // إذا رفع فيديو، نعيد التفعيل
                if(videoToggle) { videoToggle.checked = true; videoToggle.disabled = false; }
                if(lipsyncToggle) { lipsyncToggle.disabled = false; }
            }
        });
    }
});

window.startDubbing = startDubbing;
