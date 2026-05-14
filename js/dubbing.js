// js/dubbing.js — V12.2 (English UI & Smart Output)
let cinemaResults = {};
let activeWavesurfer = null;

// =====================================
// 2. Upload to Cloudflare R2
// =====================================
async function uploadToR2(url, file, contentType) {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('PUT', url, true);
        xhr.setRequestHeader('Content-Type', contentType);

        xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
                const pct = Math.round((e.loaded / e.total) * 100);
                updateProgress("Uploading...", 10 + (pct * 0.4));
            }
        };

        xhr.onload  = () => (xhr.status >= 200 && xhr.status < 300) ? resolve() : reject(new Error(`Upload failed (${xhr.status})`));
        xhr.onerror = () => reject(new Error("Network error during upload"));
        xhr.send(file);
    });
}

// =====================================
// 3. Main Dubbing Controller
// =====================================
async function startDubbing() {
    const file  = document.getElementById('mediaFile')?.files[0];
    const token = localStorage.getItem('token');

    if (!token) return window.showToast?.("Please login first", "error") || alert("Please login first");
    if (!file)  return window.showToast?.("Please select a file", "error") || alert("Please select a file");
    if (!window.selectedLangs || window.selectedLangs.size === 0) return window.showToast?.("Select at least one language", "error") || alert("Select at least one language");

    const voiceMode      = window.voiceMode      || 'original'; 
    const selectedSample = window.selectedSample || '';

    if (voiceMode === 'sample' && !selectedSample) {
        return window.showToast?.("Please select a premium voice", "error") || alert("Please select a premium voice");
    }

    document.getElementById('dubBtn').style.display       = 'none';
    document.getElementById('progressArea').style.display = 'block';
    document.getElementById('resultsCard').style.display  = 'block';

    const sidebar = document.getElementById('cinemaLangs');
    sidebar.innerHTML = '';
    cinemaResults = {};

    try {
        updateProgress("Initializing...", 5);

        const strictContentType = file.type || 'application/octet-stream';
        const isVideoUpload = strictContentType.startsWith('video/');

        // 1. Get upload URL
        const urlRes = await fetch(`${window.API_BASE}/api/upload-url`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename: file.name, content_type: strictContentType })
        });

        if (!urlRes.ok) throw new Error("Server failed to generate upload URL");
        const urlData = await urlRes.json();

        updateProgress("Starting upload...", 10);

        // 2. Upload to R2
        await uploadToR2(urlData.upload_url, file, strictContentType);

        updateProgress("Processing...", 50);

        // 3. Send dubbing requests
        const langCodes = Array.from(window.selectedLangs);
        const completedSet = new Set();

        for (const langCode of langCodes) {
            const langInfo = window.LANGUAGES?.find(l => l.code === langCode);

            const item = document.createElement('div');
            item.className = 'side-lang-card';
            item.id        = `side-${langCode}`;
            // استخدام الاسم الإنجليزي
            item.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> <span style="margin-left:8px;">${langInfo?.name_en || langCode}</span>`;
            sidebar.appendChild(item);

            fetch(`${window.API_BASE}/api/dub`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    file_key:     urlData.file_key,
                    lang:         langCode,
                    voice_mode:   voiceMode,
                    sample_file:  selectedSample,
                    video_output: isVideoUpload 
                })
            })
            .then(res => res.json())
            .then(async (data) => {
                const job = await waitForJob(data.job_id, token);

                cinemaResults[langCode] = {
                    url:  job.output_url,
                    name: langInfo?.name_en || langCode,
                    flag: langInfo?.flag    || '🌐'
                };

                // تحديث العنصر عند النجاح (بالإنجليزي)
                item.innerHTML = `<span>${langInfo?.flag || '🌐'}</span> <span style="margin-left:8px;">${langInfo?.name_en || langCode}</span> <i class="fa-solid fa-circle-check" style="color:var(--accent-green); margin-left:auto;"></i>`;
                item.onclick   = () => switchCinemaLang(langCode);

                if (Object.keys(cinemaResults).length === 1) switchCinemaLang(langCode);

                completedSet.add(langCode);
                const pct = 50 + (completedSet.size / langCodes.length * 50);
                updateProgress(
                    completedSet.size === langCodes.length ? "Completed!" : "Processing...",
                    pct
                );
            })
            .catch(err => {
                // تحديث العنصر عند الفشل
                item.innerHTML = `<span>${langInfo?.flag || '🌐'}</span> <span style="margin-left:8px;">${langInfo?.name_en || langCode}</span> <i class="fa-solid fa-circle-xmark" style="color:var(--error); margin-left:auto;"></i>`;
                console.error(`Error dubbing ${langCode}:`, err);
            });
        }

    } catch (e) {
        console.error("Dubbing Error:", e);
        updateProgress("Error: " + e.message, 0);
        document.getElementById('dubBtn').style.display = 'block';
        document.getElementById('progressArea').style.display = 'none';
        window.showToast?.(e.message, 'error');
    }
}

// =====================================
// 4. Cinema Player Switcher
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
        // نصوص مشغل الصوت بالإنجليزي
        playerContainer.innerHTML = `
            <div class="audio-player-wrapper">
                <div class="audio-player-header">
                    <span class="flag">${data.flag}</span>
                    <span>Dubbed Version - ${data.name}</span>
                </div>
                <div id="waveform" class="audio-waveform"></div>
                <div class="audio-controls">
                    <button class="play-btn" id="wavePlayBtn"><i class="fa-solid fa-play"></i></button>
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
            document.getElementById('wavePlayBtn').innerHTML = '<i class="fa-solid fa-pause"></i>';
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
                ? '<i class="fa-solid fa-pause"></i>'
                : '<i class="fa-solid fa-play"></i>';
        };
    }
}

// =====================================
// 5. Utils
// =====================================
async function waitForJob(id, token) {
    while (true) {
        const res  = await fetch(`${window.API_BASE}/api/job/${id}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.status === 'completed') return data;
        if (data.status === 'failed')    throw new Error("Processing failed");
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

document.addEventListener('DOMContentLoaded', () => {
    const dubBtn = document.getElementById('dubBtn');
    if (dubBtn) dubBtn.onclick = startDubbing;
});
