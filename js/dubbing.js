// js/dubbing.js — V12.4 (Ultimate CORS Fix & SVG Flags)
let cinemaResults = {};
let activeWavesurfer = null;

// دالة مساعدة لجلب صور الأعلام بدلاً من الإيموجي (لحل مشكلة ويندوز)
function getFlagImg(code) {
    let country = code.split('-')[1];
    if (!country) {
        const map = { 'ar':'sa', 'en':'us', 'fr':'fr', 'es':'es', 'pt':'pt', 'de':'de', 'it':'it', 'ru':'ru', 'ja':'jp' };
        country = map[code.split('-')[0]] || 'un';
    }
    return `<img src="https://hatscripts.github.io/circle-flags/flags/${country.toLowerCase()}.svg" style="width:18px; height:18px; border-radius:50%; vertical-align:middle;" alt="flag">`;
}

// تنظيف رابط الـ API
const GET_API_URL = () => {
    let base = window.API_BASE || 'https://api.glotix.ai';
    return String(base).replace(/\/$/, '').replace(/([^:]\/)\/+/g, '$1');
};

/** يستخرج sub من JWT (Supabase) لإرسال X-User-Id مع طلبات الرفع */
function getUserIdFromAccessToken(token) {
    if (!token || typeof token !== 'string') return null;
    try {
        const parts = token.split('.');
        if (parts.length < 2) return null;
        let b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
        while (b64.length % 4) b64 += '=';
        const payload = JSON.parse(atob(b64));
        return payload.sub || null;
    } catch (e) {
        return null;
    }
}

async function uploadToR2(url, file, contentType) {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('PUT', url, true);
        xhr.setRequestHeader('Content-Type', contentType);
        xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
                const pct = Math.round((e.loaded / e.total) * 100);
                updateProgress("Uploading File...", 10 + (pct * 0.4));
            }
        };
        xhr.onload = () => (xhr.status >= 200 && xhr.status < 300) ? resolve() : reject(new Error("Storage Upload Failed"));
        xhr.onerror = () => reject(new Error("Network Error during upload"));
        xhr.send(file);
    });
}

async function startDubbing() {
    const file = document.getElementById('mediaFile')?.files[0];
    const token = localStorage.getItem('token');
    
    if (!token) return window.showToast?.("Please sign in first", "error");
    if (!file) return window.showToast?.("Please select a media file", "error");
    if (!window.selectedLangs?.size) return window.showToast?.("Select target languages", "error");

    // إعداد واجهة الانتظار
    document.getElementById('dubBtn').style.display = 'none';
    document.getElementById('progressArea').style.display = 'block';
    document.getElementById('resultsCard').style.display = 'block';
    document.getElementById('cinemaLangs').innerHTML = '';
    cinemaResults = {};

    try {
        updateProgress("Initializing...", 5);
        
        const userId = getUserIdFromAccessToken(token);
        if (!userId) return window.showToast?.("Invalid session — please sign in again", "error");

        // 1. طلب رابط الرفع (X-User-Id مطلوب من السيرفر لتجنب 401)
        const urlRes = await fetch(`${GET_API_URL()}/api/upload-url`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'X-User-Id': userId
            },
            body: JSON.stringify({ filename: file.name, content_type: file.type })
        });
        
        if (!urlRes.ok) {
            const errData = await urlRes.json().catch(() => ({}));
            throw new Error(errData.error || "CORS/Connection Error to API");
        }
        
        const urlData = await urlRes.json();
        
        // 2. الرفع إلى R2
        await uploadToR2(urlData.upload_url, file, file.type);
        updateProgress("Sending processing requests...", 50);

        // 3. إرسال طلبات الدبلجة لكل لغة مختارة
        const langArray = Array.from(window.selectedLangs);
        
        for (const langCode of langArray) {
            const langInfo = window.LANGUAGES?.find(l => l.code === langCode);
            const item = document.createElement('div');
            item.className = 'side-lang-card';
            item.id = `side-${langCode}`;
            item.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> <span style="margin-left:8px;">${langInfo?.name_en || langCode}</span>`;
            document.getElementById('cinemaLangs').appendChild(item);

            // إرسال طلب الدبلجة
            fetch(`${GET_API_URL()}/api/dub`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    'X-User-Id': userId
                },
                body: JSON.stringify({
                    file_key: urlData.file_key, 
                    lang: langCode,
                    voice_mode: window.voiceMode || 'original',
                    sample_file: window.selectedSample || '',
                    video_output: file.type.startsWith('video/')
                })
            })
            .then(async res => {
                if (!res.ok) {
                    const errorJson = await res.json().catch(() => ({}));
                    throw new Error(errorJson.error || `HTTP ${res.status}`);
                }
                return res.json();
            })
            .then(async data => {
                // الانتظار حتى اكتمال المهمة
                const job = await waitForJob(data.job_id, token, userId);
                
                cinemaResults[langCode] = { 
                    url: job.output_url, 
                    name: langInfo?.name_en || langCode, 
                    flag: langCode 
                };

                // تحديث العنصر بالأعلام الدائرية (SVG)
                item.innerHTML = `
                    ${getFlagImg(langCode)} 
                    <span style="margin-left:8px;">${langInfo?.name_en}</span> 
                    <i class="fa-solid fa-circle-check" style="color:var(--accent-green); margin-left:auto;"></i>
                `;
                item.onclick = () => switchCinemaLang(langCode);
                
                if (Object.keys(cinemaResults).length === 1) switchCinemaLang(langCode);
                
                const completedCount = Object.keys(cinemaResults).length;
                updateProgress("Dubbing in progress...", 50 + (completedCount / langArray.length * 50));
                
                if (completedCount === langArray.length) updateProgress("All Done!", 100);
            })
            .catch(err => {
                item.innerHTML = `<i class="fa-solid fa-circle-xmark" style="color:var(--error);"></i> <span style="margin-left:8px;">${langCode} Error</span>`;
                window.showToast?.(`Language ${langCode}: ${err.message}`, 'error');
            });
        }
    } catch (e) {
        console.error("Critical Error:", e);
        window.showToast?.(e.message, 'error');
        document.getElementById('dubBtn').style.display = 'block';
        updateProgress("Process Interrupted", 0);
    }
}

async function waitForJob(id, token, userId) {
    let attempts = 0;
    while (attempts < 150) { // حد أقصى 10 دقائق
        try {
            const res = await fetch(`${GET_API_URL()}/api/job/${id}`, { 
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'X-User-Id': userId
                }
            });
            const d = await res.json();
            
            if (d.status === 'completed') return d;
            if (d.status === 'failed') throw new Error(d.error || "Worker encountered an error");
            
        } catch (pollErr) {
            console.warn("Polling error (might be temporary):", pollErr);
        }
        
        attempts++;
        await new Promise(r => setTimeout(r, 4000));
    }
    throw new Error("Job timed out");
}

function switchCinemaLang(langCode) {
    const data = cinemaResults[langCode];
    if (!data) return;

    document.querySelectorAll('.side-lang-card').forEach(c => c.classList.remove('active'));
    document.getElementById(`side-${langCode}`)?.classList.add('active');

    const playerContainer = document.getElementById('mainPlayer');
    document.getElementById('dlArea').style.display = 'block';
    document.getElementById('masterDl').href = data.url;

    if (activeWavesurfer) { activeWavesurfer.destroy(); activeWavesurfer = null; }

    const isVideo = /\.(mp4|mov|webm)(\?|$)/i.test(data.url);
    if (isVideo) {
        playerContainer.innerHTML = `<video controls autoplay src="${data.url}" style="width:100%;height:100%;object-fit:contain;"></video>`;
    } else {
        playerContainer.innerHTML = `
            <div class="audio-player-wrapper">
                <div class="audio-player-header">
                    ${getFlagImg(langCode)} <span style="margin-left:10px;">${data.name} Edition</span>
                </div>
                <div id="waveform" class="audio-waveform"></div>
                <div class="audio-controls">
                    <button class="play-btn" id="wavePlayBtn"><i class="fa-solid fa-play"></i></button>
                    <div class="audio-time" id="waveTime">00:00 / 00:00</div>
                </div>
            </div>`;

        activeWavesurfer = WaveSurfer.create({
            container: '#waveform', waveColor: '#4b5563', progressColor: '#3b82f6',
            cursorColor: '#fff', barWidth: 3, barRadius: 3, responsive: true, height: 80,
        });
        activeWavesurfer.load(data.url);
        activeWavesurfer.on('ready', () => {
            activeWavesurfer.play();
            document.getElementById('wavePlayBtn').innerHTML = '<i class="fa-solid fa-pause"></i>';
        });
        activeWavesurfer.on('audioprocess', () => {
            const cur = formatTime(activeWavesurfer.getCurrentTime());
            const total = formatTime(activeWavesurfer.getDuration());
            document.getElementById('waveTime').innerText = `${cur} / ${total}`;
        });
        document.getElementById('wavePlayBtn').onclick = () => {
            activeWavesurfer.playPause();
            document.getElementById('wavePlayBtn').innerHTML = activeWavesurfer.isPlaying() ? '<i class="fa-solid fa-pause"></i>' : '<i class="fa-solid fa-play"></i>';
        };
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
    return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

document.addEventListener('DOMContentLoaded', () => {
    const dubBtn = document.getElementById('dubBtn');
    if (dubBtn) dubBtn.onclick = startDubbing;
});
