// js/dubbing.js — V12.7 (job status via EventSource/SSE only — no waitForJob, no setInterval)
let cinemaResults = {};
/** يمنع تكرار addEventListener إذا أُعيد تحميل السكربت أو استُدعيت التهيئة مرتين */
let _dubbingMediaInputInitialized = false;
let activeWavesurfer = null;
let dubbingWorkAbort = null;
let dubbingProgressMonotonic = 50;

/** آخر ملف مختار (سحب/إفلات أو اختيار) — احتياط عندما لا يقبل المتصفح تعيين input.files */
let selectedDubbingFile = null;
/** يمنع ضغطتين متتاليتين على زر البدء قبل إخفاء الزر */
let _dubbingStartLocked = false;

function lockDubBtn() {
    _dubbingStartLocked = true;
    const dubBtn = document.getElementById('dubBtn');
    if (dubBtn) dubBtn.disabled = true;
}

function unlockDubBtn() {
    _dubbingStartLocked = false;
    const dubBtn = document.getElementById('dubBtn');
    if (dubBtn) dubBtn.disabled = false;
}

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

/** Same base as shared.js — `${API_BASE}/api/...` (no trailing slash, no double slashes). */
function getApiBase() {
    const raw = window.API_BASE || window.APP_CONFIG?.API_BASE || 'https://api.glotix.ai';
    return String(raw).replace(/\/$/, '').replace(/([^:]\/)\/+/g, '$1');
}

const GET_API_URL = getApiBase;

/** GET /api/dub/status/<job_id> — backend SSE stream (EventSource cannot send Authorization headers). */
function buildDubStatusStreamUrl(jobId) {
    const id = String(jobId || '').trim();
    if (!id) throw new Error('Missing job id for status stream');
    const token = localStorage.getItem('token');
    if (!token) throw new Error('Session expired — please sign in again');
    return (
        `${getApiBase()}/api/dub/status/${encodeURIComponent(id)}` +
        `?access_token=${encodeURIComponent(token)}`
    );
}

function buildJobPollUrl(jobId) {
    const id = String(jobId || '').trim();
    if (!id) throw new Error('Missing job id for status poll');
    return `${getApiBase()}/api/job/${encodeURIComponent(id)}`;
}

function extractJobIdFromDubResponse(body) {
    if (!body || typeof body !== 'object') return '';
    return String(body.job_id || body.id || '').trim();
}

/** Retry on 429 (Cloudflare / edge) so parallel dub starts do not all fail at once. */
async function fetchWithRetry(url, options, { retries = 3, baseDelayMs = 500 } = {}) {
    let res;
    for (let attempt = 0; attempt <= retries; attempt++) {
        res = await fetch(url, options);
        if (res.status !== 429 || attempt === retries) return res;
        const retryAfter = parseInt(res.headers.get('Retry-After') || '0', 10);
        const waitMs = retryAfter > 0 ? retryAfter * 1000 : baseDelayMs * Math.pow(2, attempt);
        console.warn('[dubbing] rate limited (429), retrying', { attempt: attempt + 1, waitMs });
        await new Promise((r) => setTimeout(r, waitMs));
    }
    return res;
}

function abortActiveDubbingWork() {
    if (dubbingWorkAbort) {
        dubbingWorkAbort.abort();
        dubbingWorkAbort = null;
    }
}

window.addEventListener('beforeunload', abortActiveDubbingWork);

function dubbingMaxUploadBytes() {
    const mb = Number(window.APP_CONFIG && window.APP_CONFIG.MAX_UPLOAD_MB);
    return (mb > 0 ? mb : 500) * 1024 * 1024;
}

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
    if (_dubbingStartLocked) return;
    lockDubBtn();

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
        unlockDubBtn();
        return window.showToast?.('Please sign in first', 'error');
    }
    if (!file) {
        console.warn('[dubbing] blocked: no file');
        unlockDubBtn();
        return window.showToast?.('Please select a media file', 'error');
    }
    const maxBytes = dubbingMaxUploadBytes();
    if (file.size > maxBytes) {
        const mb = Math.round(maxBytes / 1024 / 1024);
        console.warn('[dubbing] blocked: file too large', file.size);
        unlockDubBtn();
        return window.showToast?.('File too large (max ' + mb + ' MB)', 'error');
    }
    if (!window.selectedLangs?.size) {
        console.warn('[dubbing] blocked: no languages');
        unlockDubBtn();
        return window.showToast?.('Select target languages', 'error');
    }

    abortActiveDubbingWork();
    dubbingWorkAbort = new AbortController();
    const workSignal = dubbingWorkAbort.signal;

    // إعداد واجهة الانتظار
    document.getElementById('dubBtn').style.display = 'none';
    document.getElementById('progressArea').style.display = 'block';
    document.getElementById('resultsCard').style.display = 'block';
    document.getElementById('cinemaLangs').innerHTML = '';
    cinemaResults = {};
    dubbingProgressMonotonic = 50;

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

        const fileKey = urlData.file_key;
        if (!fileKey) {
            throw new Error('Missing file_key from upload-url response');
        }

        // 3. إرسال طلبات الدبلجة لكل لغة مختارة
        const langArray = Array.from(window.selectedLangs);
        const dubEndpoint = `${GET_API_URL()}/api/dub`;
        const dubHeaders = Object.assign({}, authHeaders, { 'Content-Type': 'application/json' });
        const videoOutput = typeof file.type === 'string' && file.type.startsWith('video/');
        const cinemaList = document.getElementById('cinemaLangs');

        console.log('[dubbing] starting dub requests', {
            endpoint: dubEndpoint,
            file_key: fileKey,
            langs: langArray,
            hasAuthorization: !!dubHeaders['Authorization'],
            hasXUserId: !!dubHeaders['X-User-Id']
        });

        const dubOneLanguage = async (langCode) => {
            const langInfo = window.LANGUAGES?.find(l => l.code === langCode);
            const item = document.createElement('div');
            item.className = 'side-lang-card';
            item.id = `side-${langCode}`;
            item.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> <span style="margin-left:8px;">${langInfo?.name_en || langCode}</span>`;
            if (cinemaList) cinemaList.appendChild(item);

            try {
                console.log('Sending to /api/dub...', { lang: langCode, file_key: fileKey });

                const dubRes = await fetchWithRetry(dubEndpoint, {
                    method: 'POST',
                    headers: dubHeaders,
                    signal: workSignal,
                    body: JSON.stringify({
                        file_key: fileKey,
                        lang: langCode,
                        voice_mode: window.voiceMode || 'original',
                        sample_file: window.selectedSample || '',
                        video_output: videoOutput
                    })
                });

                console.log('[dubbing] /api/dub response', {
                    lang: langCode,
                    ok: dubRes.ok,
                    status: dubRes.status,
                    statusText: dubRes.statusText
                });

                const dubData = await dubRes.json().catch(() => ({}));
                if (!dubRes.ok) {
                    throw new Error(dubData.error || ('dub failed: HTTP ' + dubRes.status));
                }
                const jobId = extractJobIdFromDubResponse(dubData);
                if (!jobId) {
                    throw new Error('Missing job_id from /api/dub response');
                }

                console.log('[dubbing] tracking job', {
                    lang: langCode,
                    job_id: jobId,
                    statusStream: `${getApiBase()}/api/dub/status/${jobId}`
                });
                const job = await watchJob(jobId, workSignal, () => {
                    dubbingProgressMonotonic = Math.min(94, dubbingProgressMonotonic + 1);
                    updateProgress('Dubbing in progress...', dubbingProgressMonotonic);
                });

                cinemaResults[langCode] = {
                    url: job.output_url,
                    name: langInfo?.name_en || langCode,
                    flag: langCode
                };

                item.innerHTML = `
                    ${getFlagImg(langCode)} 
                    <span style="margin-left:8px;">${langInfo?.name_en}</span> 
                    <i class="fa-solid fa-circle-check" style="color:var(--accent-green); margin-left:auto;"></i>
                `;
                item.onclick = () => switchCinemaLang(langCode);

                if (Object.keys(cinemaResults).length === 1) switchCinemaLang(langCode);

                const completedCount = Object.keys(cinemaResults).length;
                const nextPct = 50 + (completedCount / langArray.length * 50);
                dubbingProgressMonotonic = Math.max(dubbingProgressMonotonic, nextPct);
                updateProgress("Dubbing in progress...", dubbingProgressMonotonic);

                if (completedCount === langArray.length) updateProgress("All Done!", 100);
            } catch (err) {
                if (err && err.name === 'AbortError') return;
                console.error('[dubbing] /api/dub or poll failed', { lang: langCode, error: err });
                const icon = document.createElement('i');
                icon.className = 'fa-solid fa-circle-xmark';
                icon.style.color = 'var(--error)';
                const span = document.createElement('span');
                span.style.marginLeft = '8px';
                span.textContent = langCode + ' Error';
                item.replaceChildren(icon, span);
                window.showToast?.(`Language ${langCode}: ${err.message}`, 'error');
            }
        };

        // Sequential starts avoid edge 429 bursts; each job still tracks via SSE in parallel.
        for (let i = 0; i < langArray.length; i++) {
            if (i > 0) await new Promise((r) => setTimeout(r, 350));
            await dubOneLanguage(langArray[i]);
        }
    } catch (e) {
        if (e && e.name === 'AbortError') {
            console.warn('[dubbing] work aborted');
            return;
        }
        console.error('[dubbing] Critical Error:', e);
        window.showToast?.(e.message, 'error');
        unlockDubBtn();
        document.getElementById('dubBtn').style.display = 'block';
        updateProgress("Process Interrupted", 0);
    }
}

/** SSE at GET /api/dub/status/<id>; on mount/CORS failure fall back to GET /api/job/<id>. */
async function watchJob(jobId, signal, onProgressTick) {
    try {
        return await watchJobViaSSE(jobId, signal, onProgressTick);
    } catch (sseErr) {
        const msg = sseErr && sseErr.message ? sseErr.message : String(sseErr);
        console.warn('[dubbing] SSE unavailable, polling /api/job/', { jobId, reason: msg });
        return watchJobViaPoll(jobId, signal, onProgressTick);
    }
}

/**
 * Poll legacy job status (works on plain Gunicorn/Flask).
 */
function watchJobViaPoll(jobId, signal, onProgressTick) {
    return new Promise((resolve, reject) => {
        const headers = getUploadAuthHeaders();
        if (!headers) {
            window.clearSessionAndGuestUI?.('Session expired — please sign in again');
            reject(new Error('Session expired — please sign in again'));
            return;
        }

        const url = buildJobPollUrl(jobId);
        let settled = false;
        let timer = null;
        const maxMs = 45 * 60 * 1000;
        const started = Date.now();

        const cleanup = () => {
            if (timer) clearInterval(timer);
            if (signal) signal.removeEventListener('abort', onAbort);
        };

        const finish = (fn, value) => {
            if (settled) return;
            settled = true;
            cleanup();
            fn(value);
        };

        const onAbort = () => finish(reject, new DOMException('Aborted', 'AbortError'));

        if (signal) {
            if (signal.aborted) {
                onAbort();
                return;
            }
            signal.addEventListener('abort', onAbort, { once: true });
        }

        const tick = async () => {
            if (settled) return;
            if (Date.now() - started > maxMs) {
                finish(reject, new Error('Dubbing timed out — please try again'));
                return;
            }
            try {
                const res = await fetch(url, { headers, signal });
                const data = await res.json().catch(() => ({}));
                if (!res.ok) throw new Error(data.error || ('status poll failed: HTTP ' + res.status));
                if (data.status === 'completed') {
                    finish(resolve, { status: 'completed', output_url: data.output_url || '' });
                } else if (data.status === 'failed') {
                    finish(reject, new Error(data.error || 'Worker encountered an error'));
                } else if (typeof onProgressTick === 'function') {
                    onProgressTick();
                }
            } catch (err) {
                if (err && err.name === 'AbortError') finish(reject, err);
            }
        };

        tick();
        timer = setInterval(tick, 2500);
    });
}

/**
 * Subscribe to job status via Server-Sent Events (no HTTP polling).
 * EventSource cannot send Authorization headers — token is passed as access_token query param.
 */
function watchJobViaSSE(jobId, signal, onProgressTick) {
    return new Promise((resolve, reject) => {
        let sseUrl;
        try {
            sseUrl = buildDubStatusStreamUrl(jobId);
        } catch (authErr) {
            window.clearSessionAndGuestUI?.(authErr.message);
            reject(authErr);
            return;
        }

        const sseUrlForLog = sseUrl.replace(/access_token=[^&]+/, 'access_token=***');

        let settled = false;
        let eventSource = null;
        let connectTimer = null;

        const closeSource = () => {
            if (connectTimer) {
                clearTimeout(connectTimer);
                connectTimer = null;
            }
            if (eventSource) {
                eventSource.close();
                eventSource = null;
            }
        };

        const finish = (fn, value) => {
            if (settled) return;
            settled = true;
            closeSource();
            if (signal) signal.removeEventListener('abort', onAbort);
            fn(value);
        };

        const onAbort = () => {
            finish(reject, new DOMException('Aborted', 'AbortError'));
        };

        if (signal) {
            if (signal.aborted) {
                onAbort();
                return;
            }
            signal.addEventListener('abort', onAbort, { once: true });
        }

        const handleStatusPayload = (data) => {
            const status = (data && data.status) || '';
            if (status === 'completed') {
                finish(resolve, {
                    status: 'completed',
                    output_url: (data && data.output_url) || ''
                });
                return true;
            }
            if (status === 'failed') {
                finish(reject, new Error((data && data.error) || 'Worker encountered an error'));
                return true;
            }
            return false;
        };

        eventSource = new EventSource(sseUrl);

        eventSource.onopen = () => {
            console.log('[dubbing] SSE connected', { jobId, url: sseUrlForLog });
            if (typeof onProgressTick === 'function') onProgressTick();
        };

        eventSource.addEventListener('completed', (ev) => {
            try {
                const data = JSON.parse(ev.data || '{}');
                if (!handleStatusPayload(data)) {
                    finish(resolve, { status: 'completed', output_url: data.output_url || '' });
                }
            } catch (parseErr) {
                finish(reject, parseErr);
            }
        });

        eventSource.addEventListener('failed', (ev) => {
            try {
                const data = JSON.parse(ev.data || '{}');
                handleStatusPayload(data);
            } catch (_parseErr) {
                finish(reject, new Error('Worker encountered an error'));
            }
        });

        eventSource.onmessage = (ev) => {
            try {
                const data = JSON.parse(ev.data || '{}');
                handleStatusPayload(data);
            } catch (_parseErr) {
                /* ignore non-JSON pings */
            }
        };

        connectTimer = setTimeout(() => {
            if (settled || !eventSource) return;
            if (eventSource.readyState === EventSource.CONNECTING) {
                console.warn('[dubbing] SSE still connecting, falling back to poll', {
                    jobId,
                    url: sseUrlForLog
                });
                closeSource();
                finish(reject, new Error('SSE_UNAVAILABLE'));
            }
        }, 12000);

        eventSource.onerror = () => {
            if (settled) return;
            if (eventSource && eventSource.readyState === EventSource.CONNECTING) {
                return;
            }
            console.error('[dubbing] SSE connection failed (404/CORS/mount)', {
                jobId,
                url: sseUrlForLog,
                readyState: eventSource ? eventSource.readyState : null
            });
            closeSource();
            finish(reject, new Error('SSE_UNAVAILABLE'));
        };
    });
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
    const nameLine = document.getElementById('selectedFileNameLine');

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
        if (dubBtn) {
            dubBtn.style.display = 'none';
            unlockDubBtn();
        }
        if (uploadBox) uploadBox.classList.remove('has-file');
        if (nameLine) {
            nameLine.style.display = 'none';
            nameLine.textContent = '';
        }
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

    if (dubBtn) {
        dubBtn.style.display = 'block';
        if (!_dubbingStartLocked) dubBtn.disabled = false;
    }
    if (uploadBox) uploadBox.classList.add('has-file');
    if (nameLine) {
        const mb = (file.size / 1024 / 1024).toFixed(1);
        nameLine.textContent = file.name + ' (' + mb + ' MB)';
        nameLine.style.display = 'block';
    }
}

function initDubbingMediaInput() {
    if (_dubbingMediaInputInitialized) {
        console.warn('[dubbing] initDubbingMediaInput: already initialized — skipping duplicate listeners');
        return;
    }
    const input = getDubbingFileInput();
    const dropZone = document.getElementById('dropZone');

    if (!input) {
        console.error('[dubbing] initDubbingMediaInput: #mediaFile not found — file picker will not work');
        return;
    }
    if (!dropZone) console.warn('[dubbing] initDubbingMediaInput: #dropZone not found — drag/drop disabled');

    _dubbingMediaInputInitialized = true;

    /** يقرأ الملف من هدف الحدث دائماً (صحيح حتى مع إعادة ربط الـ input) */
    function onMediaFileChange(e) {
        const inp = e.target;
        if (!inp || inp.id !== 'mediaFile') return;
        const file = inp.files && inp.files[0] ? inp.files[0] : null;
        console.log('[dubbing] input change', { hasFile: !!file, name: file?.name });
        applyDubbingMediaSelection(file);
    }
    input.addEventListener('change', onMediaFileChange);

    if (dropZone) {
        /* منطقة الرفع = <label for="mediaFile">: لا نستدعي input.click() يدوياً (كان يسبب تكرار النافذة).
         * مسح القيمة قبل فتح اللاقط يسمح بإعادة اختيار نفس الملف ويُطلق change دائماً. */
        dropZone.addEventListener('mousedown', (e) => {
            if (e.target === input) return;
            try {
                input.value = '';
            } catch (clearErr) {
                console.warn('[dubbing] could not clear input.value before picker', clearErr);
            }
        });

        /* stopPropagation فقط: يقلل تداخل فقاعة الحدث مع مستمعات document في الصفحة.
         * لا نستخدم preventDefault هنا لأنه يمنع ربط <label for="mediaFile"> بفتح نافذة الملفات. */
        dropZone.addEventListener('click', (e) => {
            e.stopPropagation();
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
