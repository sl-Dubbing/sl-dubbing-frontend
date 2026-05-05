// dubbing.js — V8.0 (Cinema Mode Logic)

let dubbingResults = {}; // مخزن لنتائج اللغات

async function startDubbing() {
    const file = document.getElementById('mediaFile')?.files?.[0];
    const voiceSelect = document.getElementById('voiceSelect');
    const customVoiceInput = document.getElementById('customVoiceInput');
    const lipsyncToggle = document.getElementById('lipsyncToggle');
    const videoToggle = document.getElementById('videoToggle'); 
    const token = localStorage.getItem('token');

    if (!token || !file || !window.selectedLangs?.size) {
        return showToast('تأكد من تسجيل الدخول واختيار الملف واللغات', '#ef4444');
    }

    const dubBtn = document.getElementById('dubBtn');
    const progressArea = document.getElementById('progressArea');
    const resultsCard = document.getElementById('resultsCard');
    const statusTxt = document.getElementById('statusTxt');
    const progFill = document.getElementById('progFill');

    dubBtn.style.display = 'none';
    progressArea.style.display = 'block';
    resultsCard.style.display = 'block';
    document.getElementById('langSidebarList').innerHTML = ''; 
    dubbingResults = {}; // تصفير النتائج القديمة

    try {
        // الخطوة 1: الرفع
        statusTxt.innerText = '📤 جاري تهيئة الرفع...';
        const urlRes = await fetch(`${window.API_BASE}/api/upload-url`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename: file.name, content_type: file.type, size: file.size })
        });
        const urlData = await urlRes.json();
        const { upload_url, file_key } = urlData;

        await uploadToR2(upload_url, file, (pct) => {
            progFill.style.width = (pct * 0.5) + '%';
            statusTxt.innerText = `📤 جاري الرفع: ${pct.toFixed(0)}%`;
        });

        // الخطوة 2: الدبلجة
        const langs = [...window.selectedLangs];
        const isLipSync = lipsyncToggle?.checked;
        const isVideo = videoToggle?.checked;
        
        let sample_b64 = '';
        if (voiceSelect?.value === 'custom' && customVoiceInput?.files?.[0]) {
            sample_b64 = await fileToBase64(customVoiceInput.files[0]);
        }

        const promises = langs.map(async (langCode) => {
            const lang = window.LANGUAGES.find(l => l.code === langCode);
            
            // إضافة عنصر انتظار في القائمة الجانبية
            const sideItem = document.createElement('div');
            sideItem.id = `side-${langCode}`;
            sideItem.className = 'lang-item loading';
            sideItem.innerHTML = `<i class="fas fa-spinner fa-spin"></i> <span>${lang.name_ar}</span>`;
            document.getElementById('langSidebarList').appendChild(sideItem);

            try {
                const res = await fetch(`${window.API_BASE}/api/dub`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        file_key: file_key,
                        lang: langCode,
                        voice_id: voiceSelect.value,
                        sample_b64: sample_b64,
                        with_lipsync: isLipSync,
                        return_video: isVideo
                    })
                });

                const data = await res.json();
                const finalData = await waitForJob(data.job_id, token);

                // حفظ النتيجة وتحديث الواجهة
                dubbingResults[langCode] = { url: finalData.output_url, name: lang.name_ar, flag: lang.flag };
                
                sideItem.className = 'lang-item';
                sideItem.innerHTML = `<span>${lang.flag}</span> <span>${lang.name_ar}</span> <i class="fas fa-check-circle" style="color:#10b981; margin-right:auto;"></i>`;
                sideItem.onclick = () => switchCinemaLanguage(langCode);

                // تشغيل أول لغة تكتمل تلقائياً
                if (Object.keys(dubbingResults).length === 1) switchCinemaLanguage(langCode);

            } catch (e) {
                sideItem.innerHTML = `<span>❌</span> <span>${lang.name_ar}</span>`;
            }
        });

        await Promise.all(promises);
        statusTxt.innerText = '✓ اكتملت جميع اللغات!';
        progFill.style.width = '100%';

    } catch (e) {
        showToast(e.message, '#ef4444');
    } finally {
        dubBtn.style.display = 'block';
    }
}

function switchCinemaLanguage(langCode) {
    const res = dubbingResults[langCode];
    const wrapper = document.getElementById('mainMediaWrapper');
    const dlArea = document.getElementById('downloadArea');
    
    // تمييز اللغة المختارة
    document.querySelectorAll('.lang-item').forEach(el => el.classList.remove('active'));
    document.getElementById(`side-${langCode}`).classList.add('active');

    // تحديث المشغل
    const isVideo = res.url.toLowerCase().includes('.mp4');
    if (isVideo) {
        wrapper.innerHTML = `<video controls autoplay src="${res.url}" style="width:100%; height:100%;"></video>`;
    } else {
        wrapper.innerHTML = `<div style="width:100%; padding:40px;"><div id="cinemaWave"></div></div>`;
        WaveSurfer.create({ container: '#cinemaWave', waveColor: '#3b82f6', height: 80, url: res.url }).on('ready', function() { this.play(); });
    }

    // تحديث زر التحميل
    dlArea.style.display = 'flex';
    document.getElementById('activeLangFlag').innerText = res.flag;
    document.getElementById('activeLangName').innerText = res.name;
    document.getElementById('masterDownloadBtn').href = res.url;
}

// الدوال المساعدة (نفسها من النسخ السابقة)
function uploadToR2(url, file, onProgress) {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('PUT', url, true);
        xhr.upload.onprogress = (e) => onProgress((e.loaded / e.total) * 100);
        xhr.onload = () => resolve();
        xhr.send(file);
    });
}

async function waitForJob(jobId, token) {
    while (true) {
        const res = await fetch(`${window.API_BASE}/api/job/${jobId}`, { headers: { 'Authorization': `Bearer ${token}` } });
        const data = await res.json();
        if (data.status === 'completed') return data;
        if (data.status === 'failed') throw new Error('فشلت المعالجة');
        await new Promise(r => setTimeout(r, 4000));
    }
}

function fileToBase64(file) {
    return new Promise((r) => { const f = new FileReader(); f.onload = () => r(f.result.split(',')[1]); f.readAsDataURL(file); });
}
