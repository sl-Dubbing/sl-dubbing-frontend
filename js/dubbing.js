// js/dubbing.js — V12.5 (file init + drag/drop fallback + upload logging)
let cinemaResults = {};
let activeWavesurfer = null;

/** آخر ملف مختار (سحب/إفلات أو اختيار) — احتياط عندما لا يقبل المتصفح تعيين input.files */
let selectedDubbingFile = null;

function getDubbingFileInput() {
    return document.getElementById('mediaFile');
}

function getUploadAuthHeaders() {
    if (typeof window.getApiAuthHeaders !== 'function') {
        console.warn('[dubbing] getApiAuthHeaders missing — ensure shared.js loads before dubbing.js');
        return null;
    }
    const h = window.getApiAuthHeaders();
    if (!h) console.warn('[dubbing] getApiAuthHeaders() returned null (no token or JWT sub)');
    return h;
}

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

async function uploadToR2(url, file, contentType) {
    console.log('[dubbing] R2 PUT start', { name: file?.name, size: file?.size, contentType });
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('PUT', url, true);
        xhr.setRequestHeader('Content-Type', contentType || 'application/octet-stream');
        xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
                const pct = Math.round((e.loaded / e.total) * 100);
                if (pct % 10 === 0 || pct === 100) console.log('[dubbing] R2 upload progress', pct + '%');
                updateProgress("Uploading File...", 10 + (pct * 0.4));
            }
        };
        xhr.onload = () => {
            console.log('[dubbing] R2 PUT response', { status: xhr.status, statusText: xhr.statusText });
            if (xhr.status >= 200 && xhr.status < 300) resolve();
            else reject(new Error('Storage Upload Failed: HTTP ' + xhr.status));
        };
        xhr.onerror = () => {
            console.error('[dubbing] R2 PUT network error');
            reject(new Error('Network Error during upload'));
        };
        xhr.send(file);
    });
}

async function startDubbing() {
    const inputEl = getDubbingFileInput();
    const file = selectedDubbingFile || (inputEl && inputEl.files && inputEl.files[0]);
    const authHeaders = getUploadAuthHeaders();
    const token = localStorage.getItem('token');

    console.log('[dubbing] startDubbing', {
        hasInput: !!inputEl,
        fromMemory: !!selectedDubbingFile,
        fromInput: !!(inputEl && inputEl.files && inputEl.files[0]),
        fileName: file?.name,
        hasAuthHeaders: !!authHeaders,
        hasToken: !!token,
        langCount: window.selectedLangs?.size || 0
    });

    if (!authHeaders || !token) {
        console.warn('[dubbing] blocked: not signed in or headers incomplete');
        return window.showToast?.('Please sign in first', 'error');
    }
    if (!file) {
        console.warn('[dubbing] blocked: no file');
        return window.showToast?.('Please select a media file', 'error');
    }
    if (!window.selectedLangs?.size) {
        console.warn('[dubbing] blocked: no languages');
        return window.showToast?.('Select target languages', 'error');
    }

    // إعداد واجهة الانتظار
    document.getElementById('dubBtn').style.display = 'none';
    document.getElementById('progressArea').style.display = 'block';
    document.getElementById('resultsCard').style.display = 'block';
    document.getElementById('cinemaLangs').innerHTML = '';
    cinemaResults = {};

    try {
        updateProgress("Initializing...", 5);

        const uploadUrlEndpoint = `${GET_API_URL()}/api/upload-url`;
        const uploadHeaders = Object.assign(
            {},
            authHeaders,
            { 'Content-Type': 'application/json' }
        );
        console.log('[dubbing] POST /api/upload-url', {
            url: uploadUrlEndpoint,
            hasAuthorization: !!uploadHeaders['Authorization'],
            hasXUserId: !!uploadHeaders['X-User-Id'],
            xUserIdPreview: uploadHeaders['X-User-Id'] ? String(uploadHeaders['X-User-Id']).slice(0, 8) + '…' : null,
            filename: file.name,
            content_type: file.type || '(empty)'
        });

        // 1. طلب رابط الرفع (Authorization + X-User-Id من shared.js عبر getApiAuthHeaders)
        const urlRes = await fetch(uploadUrlEndpoint, {
            method: 'POST',
            headers: uploadHeaders,
            body: JSON.stringify({ filename: file.name, content_type: file.type || 'application/octet-stream' })
        });

        console.log('[dubbing] upload-url response', { ok: urlRes.ok, status: urlRes.status, statusText: urlRes.statusText });

        if (!urlRes.ok) {
            const errText = await urlRes.text().catch(() => '');
            let errData = {};
            try { errData = errText ? JSON.parse(errText) : {}; } catch (parseErr) { errData = { raw: errText }; }
            console.error('[dubbing] upload-url error body', errData);
            throw new Error(errData.error || ('upload-url failed: HTTP ' + urlRes.status));
        }

        const urlData = await urlRes.json();
        console.log('[dubbing] upload-url OK', { file_key: urlData.file_key, hasUploadUrl: !!urlData.upload_url });

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
                headers: Object.assign({}, authHeaders, { 'Content-Type': 'application/json' }),
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
                const job = await waitForJob(data.job_id, authHeaders);
                
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
        console.error('[dubbing] Critical Error:', e);
        window.showToast?.(e.message, 'error');
        document.getElementById('dubBtn').style.display = 'block';
        updateProgress("Process Interrupted", 0);
    }
}

async function waitForJob(id, authHeaders) {
    let attempts = 0;
    while (attempts < 150) { // حد أقصى 10 دقائق
        try {
            const res = await fetch(`${GET_API_URL()}/api/job/${id}`, { 
                method: 'GET',
                headers: authHeaders
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

let _dubbingMediaObjectUrl = null;

function revokeDubbingMediaPreviewUrl() {
    if (_dubbingMediaObjectUrl) {
        try { URL.revokeObjectURL(_dubbingMediaObjectUrl); } catch (e) {}
        _dubbingMediaObjectUrl = null;
    }
}

/** بعد اختيار ملف: معاينة + اسم الملف + إظهار زر البدء */
function applyDubbingMediaSelection(file) {
    const previewArea = document.getElementById('previewArea');
    const videoEl = document.getElementById('videoPreview');
    const audioLabel = document.getElementById('audioPreviewLabel');
    const audioName = document.getElementById('audioFileName');
    const dubBtn = document.getElementById('dubBtn');
    const uploadBox = document.getElementById('dropZone');

    if (!previewArea || !videoEl || !audioLabel) {
        console.error('[dubbing] applyDubbingMediaSelection: missing DOM nodes', {
            previewArea: !!previewArea,
            videoPreview: !!videoEl,
            audioPreviewLabel: !!audioLabel
        });
        return;
    }

    if (!file) {
        selectedDubbingFile = null;
        revokeDubbingMediaPreviewUrl();
        videoEl.removeAttribute('src');
        videoEl.load?.();
        previewArea.style.display = 'none';
        videoEl.style.display = 'none';
        audioLabel.style.display = 'none';
        if (dubBtn) dubBtn.style.display = 'none';
        if (uploadBox) uploadBox.classList.remove('has-file');
        return;
    }

    selectedDubbingFile = file;
    console.log('[dubbing] file selected', { name: file.name, type: file.type, size: file.size });

    revokeDubbingMediaPreviewUrl();
    _dubbingMediaObjectUrl = URL.createObjectURL(file);

    previewArea.style.display = 'block';
    if (file.type.startsWith('video/')) {
        videoEl.style.display = 'block';
        audioLabel.style.display = 'none';
        videoEl.src = _dubbingMediaObjectUrl;
    } else {
        videoEl.style.display = 'none';
        videoEl.removeAttribute('src');
        videoEl.load?.();
        audioLabel.style.display = 'block';
        if (audioName) {
            const mb = (file.size / 1024 / 1024).toFixed(1);
            audioName.textContent = file.name + ' (' + mb + ' MB)';
        }
    }

    if (dubBtn) dubBtn.style.display = 'block';
    if (uploadBox) uploadBox.classList.add('has-file');
}

function initDubbingMediaInput() {
    const input = getDubbingFileInput();
    const dropZone = document.getElementById('dropZone');

    if (!input) {
        console.error('[dubbing] initDubbingMediaInput: #mediaFile not found — file picker will not work');
        return;
    }
    if (!dropZone) console.warn('[dubbing] initDubbingMediaInput: #dropZone not found — drag/drop disabled');

    input.addEventListener('change', () => {
        const file = input.files && input.files[0];
        console.log('[dubbing] input change', { hasFile: !!file, name: file?.name });
        applyDubbingMediaSelection(file || null);
    });

    if (dropZone) {
        dropZone.addEventListener('click', (e) => {
            if (e.target === input) return;
            const inp = getDubbingFileInput();
            if (!inp) {
                console.error('[dubbing] dropZone click: #mediaFile missing');
                return;
            }
            try {
                inp.value = '';
            } catch (clearErr) {
                console.warn('[dubbing] could not clear input.value before picker', clearErr);
            }
            inp.click();
        });

        ['dragenter', 'dragover', 'dragleave'].forEach((ev) => {
            dropZone.addEventListener(ev, (e) => {
                e.preventDefault();
                e.stopPropagation();
            });
        });

        dropZone.addEventListener('dragover', (e) => {
            if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
        });

        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
            if (!file) {
                console.warn('[dubbing] drop: no file in dataTransfer');
                return;
            }
            console.log('[dubbing] drop', { name: file.name, type: file.type, size: file.size });
            let assigned = false;
            try {
                const dt = new DataTransfer();
                dt.items.add(file);
                input.files = dt.files;
                assigned = true;
            } catch (err) {
                console.warn('[dubbing] assigning dropped file to input failed (using in-memory file)', err);
            }
            if (assigned) {
                input.dispatchEvent(new Event('change', { bubbles: true }));
            } else {
                applyDubbingMediaSelection(file);
            }
        });
    }

    console.log('[dubbing] media input initialized', { input: !!input, dropZone: !!dropZone });
}

function whenDomReady(fn) {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', fn, { once: true });
    } else {
        fn();
    }
}

whenDomReady(() => {
    const dubBtn = document.getElementById('dubBtn');
    if (dubBtn) dubBtn.onclick = startDubbing;
    else console.warn('[dubbing] #dubBtn not found');
    initDubbingMediaInput();
});
