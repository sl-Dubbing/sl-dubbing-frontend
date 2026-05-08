// js/dubbing.js — الإصدار السينمائي المتقدم (V11.0 - Final Fix)
let cinemaResults = {};
let activeWavesurfer = null;

// =====================================
// 1. معاينة الملف المرفوع (Preview)
// =====================================
document.getElementById('mediaFile')?.addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;

    const url = URL.createObjectURL(file);
    const dropZone = document.getElementById('dropZone');
    const previewArea = document.getElementById('previewArea');
    const dubBtn = document.getElementById('dubBtn');
    const vPreview = document.getElementById('videoPreview');
    const aPreview = document.getElementById('audioPreviewLabel');

    if(dropZone) dropZone.style.display = 'none';
    if(previewArea) previewArea.style.display = 'block';
    if(dubBtn) dubBtn.style.display = 'block';

    if (file.type.startsWith('video/')) {
        vPreview.src = url;
        vPreview.style.display = 'block';
        aPreview.style.display = 'none';
    } else {
        vPreview.style.display = 'none';
        aPreview.style.display = 'block';
        document.getElementById('audioFileName').innerText = file.name;
    }
});

// =====================================
// 2. دالة الرفع المباشر لـ Cloudflare R2
// =====================================
async function uploadToR2(url, file, contentType) {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('PUT', url, true);
        
        // 🚨 حيوي: إجبار المتصفح على استخدام نفس نوع الملف الذي وقعنا به الرابط
        xhr.setRequestHeader('Content-Type', contentType);
        
        xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
                const pct = Math.round((e.loaded / e.total) * 100);
                // رفع شريط التقدم من 10% إلى 50% أثناء الرفع الفعلي
                const overallProgress = 10 + (pct * 0.4); 
                updateProgress("📤 جاري رفع الملف للمخزن السحابي...", overallProgress);
            }
        };
        
        xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) resolve();
            else reject(new Error(`فشل الرفع (Status: ${xhr.status})`));
        };
        
        xhr.onerror = () => reject(new Error("حدث خطأ في اتصال الشبكة أثناء الرفع"));
        xhr.send(file);
    });
}

// =====================================
// 3. بدء عملية الدبلجة (Main Controller)
// =====================================
async function startDubbing() {
    const file = document.getElementById('mediaFile')?.files[0];
    const token = localStorage.getItem('token');
    
    if (!token) return alert("يرجى تسجيل الدخول أولاً");
    if (!file) return alert("يرجى اختيار ملف!");
    if (!window.selectedLangs || window.selectedLangs.size === 0) return alert("اختر لغة واحدة على الأقل!");

    // تجهيز الواجهة
    document.getElementById('dubBtn').style.display = 'none';
    document.getElementById('progressArea').style.display = 'block';
    document.getElementById('resultsCard').style.display = 'block';
    const sidebar = document.getElementById('cinemaLangs');
    sidebar.innerHTML = '';
    cinemaResults = {};

    try {
        updateProgress("⚡ جاري تهيئة رابط الرفع...", 5);
        
        // 💡 استخراج نوع الملف الدقيق لمنع رفض Cloudflare
        const strictContentType = file.type || 'application/octet-stream';

        // 1. الحصول على رابط الرفع من Railway
        const urlRes = await fetch(`${window.API_BASE}/api/upload-url`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                filename: file.name, 
                content_type: strictContentType 
            })
        });
        
        if (!urlRes.ok) throw new Error("فشل السيرفر في توليد رابط الرفع");
        const urlData = await urlRes.json();
        
        updateProgress("📤 جاري بدء الرفع...", 10);

        // 2. الرفع المباشر لـ Cloudflare R2
        await uploadToR2(urlData.upload_url, file, strictContentType);

        updateProgress("⚙️ اكتمل الرفع، بدأت المعالجة بذكائك الاصطناعي...", 50);

        // 3. إرسال طلبات الدبلجة لكل لغة
        const langCodes = Array.from(window.selectedLangs);
        let completed = 0;

        for (const langCode of langCodes) {
            const langInfo = window.LANGUAGES.find(l => l.code === langCode);
            
            const item = document.createElement('div');
            item.className = 'side-lang-card';
            item.id = `side-${langCode}`;
            item.innerHTML = `<i class="fas fa-spinner fa-spin"></i> <span>${langInfo.name_ar}</span>`;
            sidebar.appendChild(item);

            // طلب الدبلجة من Railway
            fetch(`${window.API_BASE}/api/dub`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    file_key: urlData.file_key,
                    lang: langCode,
                    with_lipsync: document.getElementById('lipsyncToggle').checked,
                    video_output: document.getElementById('videoToggle').checked
                })
            }).then(res => res.json()).then(async (data) => {
                const job = await waitForJob(data.job_id, token);
                
                cinemaResults[langCode] = { 
                    url: job.output_url, 
                    name: langInfo.name_ar, 
                    flag: langInfo.flag 
                };

                item.innerHTML = `<span>${langInfo.flag}</span> <span>${langInfo.name_ar}</span> <i class="fas fa-check-circle" style="color:var(--accent-green); margin-right:auto;"></i>`;
                item.onclick = () => switchCinemaLang(langCode);

                if (Object.keys(cinemaResults).length === 1) switchCinemaLang(langCode);

                completed++;
                const pct = 50 + (completed / langCodes.length * 50);
                updateProgress(completed === langCodes.length ? "✅ تم الانتهاء من جميع اللغات!" : "⏳ جاري معالجة اللغات...", pct);
            });
        }

    } catch (e) {
        console.error("Dubbing Error:", e);
        alert("حدث خطأ تقني: " + e.message);
        document.getElementById('dubBtn').style.display = 'block';
    }
}

// =====================================
// 4. مشغل السينما الذكي (Video vs Audio)
// =====================================
function switchCinemaLang(langCode) {
    const data = cinemaResults[langCode];
    if (!data) return;

    document.querySelectorAll('.side-lang-card').forEach(c => c.classList.remove('active'));
    const sideCard = document.getElementById(`side-${langCode}`);
    if (sideCard) sideCard.classList.add('active');

    const playerContainer = document.getElementById('mainPlayer');
    const dlArea = document.getElementById('dlArea');
    const dlBtn = document.getElementById('masterDl');

    if (activeWavesurfer) { activeWavesurfer.destroy(); activeWavesurfer = null; }

    dlArea.style.display = 'block';
    dlBtn.href = data.url;

    const isVideo = data.url.toLowerCase().includes('.mp4');

    if (isVideo) {
        playerContainer.innerHTML = `<video controls autoplay src="${data.url}"></video>`;
    } else {
        playerContainer.innerHTML = `
            <div class="audio-player-wrapper">
                <div class="audio-player-header">
                    <span class="flag">${data.flag}</span>
                    <span>النسخة المدبلجة - ${data.name}</span>
                </div>
                <div id="waveform" class="audio-waveform"></div>
                <div class="audio-controls">
                    <button class="play-btn" id="wavePlayBtn"><i class="fas fa-play"></i></button>
                    <div class="audio-time" id="waveTime">00:00 / 00:00</div>
                </div>
            </div>
        `;

        activeWavesurfer = WaveSurfer.create({
            container: '#waveform',
            waveColor: '#4b5563',
            progressColor: '#3b82f6',
            cursorColor: '#fff',
            barWidth: 3,
            barRadius: 3,
            responsive: true,
            height: 80,
        });

        activeWavesurfer.load(data.url);
        
        activeWavesurfer.on('ready', () => {
            activeWavesurfer.play();
            document.getElementById('wavePlayBtn').innerHTML = '<i class="fas fa-pause"></i>';
        });

        activeWavesurfer.on('audioprocess', () => {
            const current = formatTime(activeWavesurfer.getCurrentTime());
            const total = formatTime(activeWavesurfer.getDuration());
            document.getElementById('waveTime').innerText = `${current} / ${total}`;
        });

        document.getElementById('wavePlayBtn').onclick = () => {
            activeWavesurfer.playPause();
            const isPlaying = activeWavesurfer.isPlaying();
            document.getElementById('wavePlayBtn').innerHTML = isPlaying ? '<i class="fas fa-pause"></i>' : '<i class="fas fa-play"></i>';
        };
    }
}

// =====================================
// 5. أدوات مساعدة (Wait & Format)
// =====================================
async function waitForJob(id, token) {
    while(true) {
        const res = await fetch(`${window.API_BASE}/api/job/${id}`, { headers: { 'Authorization': `Bearer ${token}` } });
        const data = await res.json();
        if (data.status === 'completed') return data;
        if (data.status === 'failed') throw new Error("فشلت معالجة الفيديو في السيرفر");
        await new Promise(r => setTimeout(r, 4000));
    }
}

function updateProgress(txt, pct) {
    const sTxt = document.getElementById('statusTxt');
    const sPct = document.getElementById('statusPct');
    const pFill = document.getElementById('progFill');
    if (sTxt) sTxt.innerText = txt;
    if (sPct) sPct.innerText = Math.round(pct) + "%";
    if (pFill) pFill.style.width = pct + "%";
}

function formatTime(s) {
    const min = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
}

document.getElementById('dubBtn').onclick = startDubbing;
