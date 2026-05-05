// dubbing.js — V7.5 (النسخة النهائية المتوافقة مع واجهة Studio)

async function startDubbing() {
    // 1. جلب العناصر من واجهة HTML
    const file = document.getElementById('mediaFile')?.files?.[0];
    const voiceSelect = document.getElementById('voiceSelect');
    const customVoiceInput = document.getElementById('customVoiceInput');
    const lipsyncToggle = document.getElementById('lipsyncToggle');
    const videoToggle = document.getElementById('videoToggle'); 
    const token = localStorage.getItem('token');

    // 2. التحقق من المدخلات
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

    // تجهيز واجهة المعالجة
    dubBtn.style.display = 'none'; 
    progressArea.style.display = 'block';
    resultsCard.style.display = 'block';
    resultsList.innerHTML = ''; // تنظيف النتائج السابقة
    progFill.style.width = '5%';
    statusTxt.innerText = '⚡ جاري تجهيز الرابط الآمن...';

    try {
        // المرحلة الأولى: جلب رابط الرفع
        const urlRes = await fetch(`${window.API_BASE}/api/upload-url`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename: file.name, content_type: file.type || 'video/mp4', size: file.size })
        });

        const urlData = await urlRes.json();
        if (!urlRes.ok || !urlData.success) throw new Error(urlData.error || 'فشل الحصول على رابط الرفع');

        const { upload_url, file_key } = urlData;
        progFill.style.width = '15%';
        statusTxt.innerText = `📤 جاري رفع الملف (${(file.size/1024/1024).toFixed(1)}MB)...`;

        // المرحلة الثانية: الرفع إلى التخزين السحابي R2
        await uploadToR2(upload_url, file, (pct) => {
            progFill.style.width = (15 + pct * 0.45) + '%';
            statusTxt.innerText = `📤 اكتمل الرفع بنسبة ${pct.toFixed(0)}%...`;
        }, file.type);

        progFill.style.width = '60%';
        statusTxt.innerText = '✅ اكتمل الرفع، يبدأ الآن سحر الذكاء الاصطناعي...';

        const langs = [...window.selectedLangs];
        const total = langs.length;
        let completed = 0;

        // تجهيز نبرة الصوت
        let sample_b64 = '';
        let voice_id_val = 'source'; 
        if (voiceSelect?.value === 'custom' && customVoiceInput?.files?.[0]) {
            sample_b64 = await fileToBase64(customVoiceInput.files[0]);
        } else if (voiceSelect?.value && voiceSelect.value !== 'source' && voiceSelect.value !== 'custom') {
            voice_id_val = voiceSelect.value;
        }

        // قراءة حالة أزرار التبديل (Toggles)
        const isLipSyncEnabled = lipsyncToggle ? lipsyncToggle.checked : false;
        const isVideoOutput = videoToggle ? videoToggle.checked : true;

        // المرحلة الثالثة: إرسال الطلبات لكل لغة مختارة
        const promises = langs.map(async (langCode) => {
            const lang = window.LANGUAGES?.find(l => l.code === langCode);
            if (!lang) return;

            // إنشاء عنصر النتيجة في القائمة
            const card = document.createElement('div');
            card.className = 'result-item';
            card.innerHTML = `
                <div class="result-item-header">
                    <span class="result-item-flag">${lang.flag}</span>
                    <span class="result-item-name">${lang.name_ar}</span>
                    <span class="result-item-status" id="status-${langCode}">في الانتظار</span>
                </div>
                <div id="body-${langCode}" style="padding:10px;">⏳ جاري إرسال الطلب...</div>
            `;
            resultsList.appendChild(card);

            const statusEl = document.getElementById(`status-${langCode}`);
            const bodyEl = document.getElementById(`body-${langCode}`);

            try {
                const res = await fetch(`${window.API_BASE}/api/dub`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        file_key: file_key,
                        lang: langCode,
                        voice_id: voice_id_val,
                        sample_b64: sample_b64,
                        with_lipsync: isLipSyncEnabled,
                        return_video: isVideoOutput,
                        engine: 'auto'
                    })
                });

                const data = await res.json();
                if (!res.ok || !data.success) throw new Error(data.error || 'فشل الطلب');

                statusEl.textContent = 'جاري المعالجة...';
                const finalData = await waitForJob(data.job_id, token, statusEl);

                statusEl.textContent = '✓ اكتمل';
                statusEl.classList.add('success');
                
                // 🌟 منطق العرض الذكي (فيديو أو موجات صوتية)
                const isUrlVideo = finalData.output_url.toLowerCase().includes('.mp4');
                const showAsVideo = isVideoOutput && isUrlVideo;

                if (showAsVideo) {
                    bodyEl.innerHTML = `
                        <div style="margin-top:5px;">
                            <video controls src="${finalData.output_url}" style="width:100%; border-radius:12px; background:#000; box-shadow: 0 4px 12px rgba(0,0,0,0.1);"></video>
                            <a href="${finalData.output_url}" target="_blank" style="margin-top:10px; display:flex; align-items:center; justify-content:center; gap:8px; background:#3b82f6; color:white; padding:10px; border-radius:8px; text-decoration:none; font-weight:600; font-size:0.9rem;">
                                <i class="fas fa-file-video"></i> تحميل الفيديو المدبلج
                            </a>
                        </div>
                    `;
                } else {
                    const waveId = `waveform-${langCode}`;
                    bodyEl.innerHTML = `
                        <div style="background: #f8fafc; border-radius: 12px; padding: 15px; border: 1px solid #e2e8f0;">
                            <div id="${waveId}"></div>
                            <div style="display:flex; justify-content:space-between; align-items:center; margin-top:12px;">
                                <button id="playBtn-${langCode}" style="background:#3b82f6; color:#fff; border:none; padding:8px 16px; border-radius:8px; cursor:pointer; font-weight:600;">
                                    <i class="fas fa-play"></i> تشغيل
                                </button>
                                <a href="${finalData.output_url}" download="dub_${langCode}.wav" style="color:#10b981; font-weight:bold; text-decoration:none; font-size:0.9rem;">
                                    <i class="fas fa-download"></i> تحميل الصوت
                                </a>
                            </div>
                        </div>
                    `;

                    const wavesurfer = WaveSurfer.create({
                        container: `#${waveId}`,
                        waveColor: '#94a3b8',
                        progressColor: '#3b82f6',
                        barWidth: 3,
                        barRadius: 3,
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
                statusEl.textContent = '✗ فشل';
                statusEl.classList.add('error');
                bodyEl.innerHTML = `<div style="color:#ef4444; font-size:0.85rem;">${e.message}</div>`;
            } finally {
                completed++;
                progFill.style.width = (60 + (completed / total) * 40) + '%';
            }
        });

        await Promise.all(promises);
        statusTxt.innerText = `✓ اكتملت جميع اللغات بنجاح!`;

    } catch (e) {
        showToast(e.message, '#ef4444');
        statusTxt.innerText = '✗ خطأ: ' + e.message;
        progFill.style.background = '#ef4444';
    } finally {
        dubBtn.style.display = 'block';
    }
}

// دالة الرفع لـ Cloudflare R2
function uploadToR2(url, file, onProgress, type) {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('PUT', url, true);
        xhr.setRequestHeader('Content-Type', type || 'application/octet-stream');
        xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress((e.loaded / e.total) * 100); };
        xhr.onload = () => { if (xhr.status >= 200 && xhr.status < 300) resolve(); else reject(new Error('فشل الرفع')); };
        xhr.onerror = () => reject(new Error('خطأ في الشبكة'));
        xhr.send(file);
    });
}

// دالة انتظار المهمة (Polling)
async function waitForJob(jobId, token, statusEl) {
    const start = Date.now();
    while (Date.now() - start < 1800000) { // 30 دقيقة كحد أقصى
        const res = await fetch(`${window.API_BASE}/api/job/${jobId}`, { headers: { 'Authorization': `Bearer ${token}` } });
        const data = await res.json();
        if (data.status === 'completed') return data;
        if (data.status === 'failed') throw new Error(data.error || 'فشلت المعالجة');
        await new Promise(r => setTimeout(r, 4000));
    }
    throw new Error('انتهت مهلة الانتظار');
}

// تحويل ملف عينة الصوت لـ Base64
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// تفعيل المستمعات عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', () => {
    const dubBtn = document.getElementById('dubBtn');
    if (dubBtn) dubBtn.addEventListener('click', startDubbing);

    const fileInput = document.getElementById('mediaFile');
    const videoOpt = document.getElementById('videoOpt');
    const lipsyncOpt = document.getElementById('lipsyncOpt');
    const videoToggle = document.getElementById('videoToggle');
    const lipsyncToggle = document.getElementById('lipsyncToggle');

    if (fileInput) {
        fileInput.addEventListener('change', function() {
            const file = this.files[0];
            if (file && file.type.startsWith('audio/')) {
                // إذا كان المدخل صوتاً: تعطل خيارات الفيديو
                if(videoOpt) videoOpt.style.opacity = '0.4';
                if(videoToggle) { videoToggle.checked = false; videoToggle.disabled = true; }
                if(lipsyncOpt) lipsyncOpt.style.opacity = '0.4';
                if(lipsyncToggle) { lipsyncToggle.checked = false; lipsyncToggle.disabled = true; }
            } else {
                // إذا كان المدخل فيديو: تفعيل الخيارات
                if(videoOpt) videoOpt.style.opacity = '1';
                if(videoToggle) { videoToggle.checked = true; videoToggle.disabled = false; }
                if(lipsyncOpt) lipsyncOpt.style.opacity = '1';
                if(lipsyncToggle) lipsyncToggle.disabled = false;
            }
        });
    }
});
