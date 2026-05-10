// js/dubbing.js — Advanced Cinema Edition (V12.0 - Fixed UI & Bugs)
let cinemaResults = {};
let activeWavesurfer = null;

// =====================================
// 1. Preview Media
// =====================================
document.getElementById('mediaFile')?.addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;

    const url = URL.createObjectURL(file);

    // Show preview, hide upload
    document.getElementById('dropZone').style.display = 'none';
    document.getElementById('previewArea').style.display = 'block';
    document.getElementById('dubBtn').style.display = 'block';

    if (file.type.startsWith('video/')) {
        document.getElementById('videoPreview').src = url;
        document.getElementById('videoPreview').style.display = 'block';
        document.getElementById('audioPreviewLabel').style.display = 'none';
    } else {
        document.getElementById('videoPreview').style.display = 'none';
        document.getElementById('audioPreviewLabel').style.display = 'block';
        document.getElementById('audioFileName').innerText = file.name;
    }
});

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
                const overallProgress = 10 + (pct * 0.4); 
                updateProgress("📤 Uploading file to cloud...", overallProgress);
            }
        };
        
        xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) resolve();
            else reject(new Error(`Upload failed (Status: ${xhr.status})`));
        };
        
        xhr.onerror = () => reject(new Error("Network error during upload"));
        xhr.send(file);
    });
}

// =====================================
// 3. Main Dubbing Controller
// =====================================
async function startDubbing() {
    const file = document.getElementById('mediaFile')?.files[0];
    const token = localStorage.getItem('token');
    
    if (!token) return window.showToast?.("Please sign in first", "error");
    if (!file) return window.showToast?.("Please select a file!", "error");
    if (!window.selectedLangs || window.selectedLangs.size === 0) return window.showToast?.("Select at least one language!", "error");

    document.getElementById('dubBtn').style.display = 'none';
    document.getElementById('progressArea').style.display = 'block';
    document.getElementById('resultsCard').style.display = 'block';
    const sidebar = document.getElementById('cinemaLangs');
    sidebar.innerHTML = '';
    cinemaResults = {};

    try {
        updateProgress("⚡ Initializing upload link...", 5);
        
        const strictContentType = file.type || 'application/octet-stream';
        const API = window.API_BASE; // Centralized API from shared.js

        // 1. Get upload URL
        const urlRes = await fetch(`${API}/api/upload-url`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                filename: file.name, 
                content_type: strictContentType 
            })
        });
        
        if (!urlRes.ok) throw new Error("Server failed to generate upload link");
        const urlData = await urlRes.json();
        
        updateProgress("📤 Starting upload...", 10);

        // 2. Upload to R2
        await uploadToR2(urlData.upload_url, file, strictContentType);

        updateProgress("⚙️ Upload complete, AI processing started...", 50);

        // 3. Send dubbing requests
        const langCodes = Array.from(window.selectedLangs);
        let completed = 0;

        for (const langCode of langCodes) {
            const langInfo = window.LANGUAGES.find(l => l.code === langCode);
            
            const item = document.createElement('div');
            item.className = 'side-lang-card';
            item.id = `side-${langCode}`;
            // ✅ تم الإصلاح: عرض اسم اللغة بالإنجليزية
            item.innerHTML = `<i class="fas fa-spinner fa-spin"></i> <span>${langInfo.name_en}</span>`;
            sidebar.appendChild(item);

            // ✅ تم الإصلاح: تجنب انهيار السكريبت إذا كان زر Lipsync محذوفاً من الواجهة
            const lipsyncChecked = document.getElementById('lipsyncToggle')?.checked || false;
            const videoChecked = document.getElementById('videoToggle')?.checked ?? true;

            fetch(`${API}/api/dub`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    file_key: urlData.file_key,
                    lang: langCode,
                    with_lipsync: lipsyncChecked,
                    video_output: videoChecked
                })
            }).then(res => res.json()).then(async (data) => {
                const job = await waitForJob(data.job_id, token);
                
                cinemaResults[langCode] = { 
                    url: job.output_url, 
                    name: langInfo.name_en, // ✅ English Name
                    flag: langInfo.flag 
                };

                item.innerHTML = `<span>${langInfo.flag}</span> <span>${langInfo.name_en}</span> <i class="fas fa-check-circle" style="color:var(--accent-green); margin-right:auto;"></i>`;
                item.onclick = () => switchCinemaLang(langCode);

                if (Object.keys(cinemaResults).length === 1) switchCinemaLang(langCode);

                completed++;
                const pct = 50 + (completed / langCodes.length * 50);
                updateProgress(completed === langCodes.length ? "✅ All languages completed!" : "⏳ Processing languages...", pct);
                
                // تحديث الرصيد تلقائياً بعد الانتهاء
                if (completed === langCodes.length && typeof window.checkAuth === 'function') {
                    window.checkAuth(); 
                }

            }).catch(err => {
                item.innerHTML = `<span>${langInfo.flag}</span> <span>${langInfo.name_en}</span> <i class="fas fa-times-circle" style="color:var(--error); margin-right:auto;"></i>`;
                console.error("Dubbing error for " + langCode, err);
            });
        }

    } catch (e) {
        console.error("Dubbing Error:", e);
        window.showToast?.("Technical error: " + e.message, "error");
        document.getElementById('dubBtn').style.display = 'block';
        document.getElementById('progressArea').style.display = 'none';
    }
}

// =====================================
// 4. Smart Cinema Player
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
                    <span>Dubbed Version - ${data.name}</span>
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
// 5. Utils (Wait & Format)
// =====================================
async function waitForJob(id, token) {
    while(true) {
        const res = await fetch(`${window.API_BASE}/api/job/${id}`, { headers: { 'Authorization': `Bearer ${token}` } });
        const data = await res.json();
        if (data.status === 'completed') return data;
        if (data.status === 'failed') throw new Error("Server processing failed");
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

const dubBtn = document.getElementById('dubBtn');
if (dubBtn) dubBtn.onclick = startDubbing;
