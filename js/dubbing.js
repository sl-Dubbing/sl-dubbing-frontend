// js/dubbing.js — V12.0 (Fixed)
let cinemaResults = {};
let activeWavesurfer = null;

// =============================================
// القسم 1 (Preview) محذوف — موجود في shared.js
// =============================================

// =====================================
// 2. دالة الرفع المباشر لـ Cloudflare R2
// =====================================
async function uploadToR2(url, file, contentType) {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('PUT', url, true);
        xhr.setRequestHeader('Content-Type', contentType);

        xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
                const pct = Math.round((e.loaded / e.total) * 100);
                updateProgress("📤 جاري رفع الملف للمخزن السحابي...", 10 + (pct * 0.4));
            }
        };

        xhr.onload  = () => (xhr.status >= 200 && xhr.status < 300) ? resolve() : reject(new Error(`فشل الرفع (Status: ${xhr.status})`));
        xhr.onerror = () => reject(new Error("حدث خطأ في اتصال الشبكة أثناء الرفع"));
        xhr.send(file);
    });
}

// =====================================
// 3. بدء عملية الدبلجة (Main Controller)
// =====================================
async function startDubbing() {
    const file  = document.getElementById('mediaFile')?.files[0];
    const token = localStorage.getItem('token');

    if (!token) return alert("يرجى تسجيل الدخول أولاً");
    if (!file)  return alert("يرجى اختيار ملف!");
    if (!window.selectedLangs || window.selectedLangs.size === 0) return alert("اختر لغة واحدة على الأقل!");

    // قراءة وضع الصوت من القائمة المنسدلة
    const voiceMode     = window.voiceMode    || 'original'; // 'original' | 'sample'
    const selectedSample = window.selectedSample || '';

    if (voiceMode === 'sample' && !selectedSample) {
        return alert("يرجى اختيار عينة صوتية من القائمة!");
    }

    document.getElementById('dubBtn').style.display    = 'none';
    document.getElementById('progressArea').style.display = 'block';
    document.getElementById('resultsCard').style.display  = 'block';

    const sidebar = document.getElementById('cinemaLangs');
    sidebar.innerHTML = '';
    cinemaResults = {};

    try {
        updateProgress("⚡ جاري تهيئة رابط الرفع...", 5);

        const strictContentType = file.type || 'application/octet-stream';

        // 1. الحصول على رابط الرفع
        const urlRes = await fetch(`${window.API_BASE}/api/upload-url`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename: file.name, content_type: strictContentType })
        });

        if (!urlRes.ok) throw new Error("فشل السيرفر في توليد رابط الرفع");
        const urlData = await urlRes.json();

        updateProgress("📤 جاري بدء الرفع...", 10);

        // 2. الرفع المباشر لـ Cloudflare R2
        await uploadToR2(urlData.upload_url, file, strictContentType);

        updateProgress("⚙️ اكتمل الرفع، بدأت المعالجة بالذكاء الاصطناعي...", 50);

        // 3. إرسال طلبات الدبلجة لكل لغة
        const langCodes = Array.from(window.selectedLangs);
        const completedSet = new Set();

        for (const langCode of langCodes) {
            const langInfo = window.LANGUAGES?.find(l => l.code === langCode);

            const item = document.createElement('div');
            item.className = 'side-lang-card';
            item.id        = `side-${langCode}`;
            item.innerHTML = `<i class="fas fa-spinner fa-spin"></i> <span>${langInfo?.name_ar || langCode}</span>`;
            sidebar.appendChild(item);

            fetch(`${window.API_BASE}/api/dub`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    file_key:     urlData.file_key,
                    lang:         langCode,
                    voice_mode:   voiceMode,        // ← original | sample
                    sample_file:  selectedSample,   // ← مسار العينة (فارغ إذا original)
                    video_output: document.getElementById('videoToggle')?.checked !== undefined ? document.getElementById('videoToggle').checked : true
                })
            })
            .then(res => res.json())
            .then(async (data) => {
                const job = await waitForJob(data.job_id, token);

                cinemaResults[langCode] = {
                    url:  job.output_url,
                    name: langInfo?.name_ar || langCode,
                    flag: langInfo?.flag    || '🌐'
                };

                item.innerHTML = `<span>${langInfo?.flag || '🌐'}</span> <span>${langInfo?.name_ar || langCode}</span> <i class="fas fa-check-circle" style="color:var(--accent-green); margin-right:auto;"></i>`;
                item.onclick   = () => switchCinemaLang(langCode);

                if (Object.keys(cinemaResults).length === 1) switchCinemaLang(langCode);

                completedSet.add(langCode);
                const pct = 50 + (completedSet.size / langCodes.length * 50);
                updateProgress(
                    completedSet.size === langCodes.length ? "✅ تم الانتهاء من جميع اللغات!" : "⏳ جاري معالجة اللغات...",
                    pct
                );
            })
            .catch(err => {
                item.innerHTML = `<span>${langInfo?.flag || '🌐'}</span> <span>${langInfo?.name_ar || langCode}</span> <i class="fas fa-times-circle" style="color:var(--error); margin-right:auto;"></i>`;
                console.error(`Error dubbing ${langCode}:`, err);
            });
        }

    } catch (e) {
        console.error("Dubbing Error:", e);
        updateProgress("❌ خطأ: " + e.message, 0);
        document.getElementById('dubBtn').style.display = 'block';
        document.getElementById('progressArea').style.display = 'none';
        window.showToast?.(e.message, 'error');
    }
}

// =====================================
// 4. مشغل السينما الذكي (Video vs Audio)
// =====================================
function switchCinemaLang(langCode) {
    const data = cinemaResults[langCode];
    if (!data) return;

    document.querySelectorAll('.side-lang-card').forEach(c => c.classList.remove('active'));
    document.getElementById(`side-${langCode}`)?.classList.add('active');

    const playerContainer = document.getElementById('mainPlayer');
    const dlArea          = document.getElementById('dlArea');
    const dlBtn           = document.getElementById('masterDl');

    if (activeWavesurfer) { activeWavesurfer.destroy(); activeWavesurfer = null; }

    dlArea.style.display = 'block';
    dlBtn.href = data.url;

    const isVideo = /\.(mp4|mov|webm)(\?|$)/i.test(data.url);

    if (isVideo) {
        playerContainer.innerHTML = `<video controls autoplay src="${data.url}" style="width:100%;height:100%;object-fit:contain;"></video>`;
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
            container:     '#waveform',
            waveColor:     '#4b5563',
            progressColor: '#3b82f6',
            cursorColor:   '#fff',
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
            const cur   = formatTime(activeWavesurfer.getCurrentTime());
            const total = formatTime(activeWavesurfer.getDuration());
            const el    = document.getElementById('waveTime');
            if (el) el.innerText = `${cur} / ${total}`;
        });

        document.getElementById('wavePlayBtn').onclick = () => {
            activeWavesurfer.playPause();
            document.getElementById('wavePlayBtn').innerHTML = activeWavesurfer.isPlaying()
                ? '<i class="fas fa-pause"></i>'
                : '<i class="fas fa-play"></i>';
        };
    }
}

// =====================================
// 5. أدوات مساعدة
// =====================================
async function waitForJob(id, token) {
    while (true) {
        const res  = await fetch(`${window.API_BASE}/api/job/${id}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.status === 'completed') return data;
        if (data.status === 'failed')    throw new Error("فشلت معالجة الفيديو في السيرفر");
        await new Promise(r => setTimeout(r, 4000));
    }
}

function updateProgress(txt, pct) {
    const sTxt  = document.getElementById('statusTxt');
    const sPct  = document.getElementById('statusPct');
    const pFill = document.getElementById('progFill');
    if (sTxt)  sTxt.innerText      = txt;
    if (sPct)  sPct.innerText      = Math.round(pct) + "%";
    if (pFill) pFill.style.width   = pct + "%";
}

function formatTime(s) {
    const min = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

// ربط زر الدبلجة بعد تحميل DOM
document.addEventListener('DOMContentLoaded', () => {
    const dubBtn = document.getElementById('dubBtn');
    if (dubBtn) dubBtn.onclick = startDubbing;
});
