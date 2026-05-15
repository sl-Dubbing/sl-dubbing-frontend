// stt.js — Speech to Text Logic V2.2 (X-User-Id + API base normalization)

let currentMode = 'fast';
let sttPollIntervalId = null;

window.addEventListener('beforeunload', () => {
    if (sttPollIntervalId) {
        clearInterval(sttPollIntervalId);
        sttPollIntervalId = null;
    }
});

function getApiBase() {
    const raw = window.API_BASE || 'https://api.glotix.ai';
    return String(raw).replace(/\/$/, '').replace(/([^:]\/)\/+/g, '$1');
}

document.addEventListener('DOMContentLoaded', () => {
    // Mode switcher
    const modeOptions = document.querySelectorAll('.mode-option');
    const diarizeToggle = document.getElementById('diarizeToggle');

    modeOptions.forEach(opt => {
        opt.addEventListener('click', () => {
            modeOptions.forEach(x => x.classList.remove('active'));
            opt.classList.add('active');
            currentMode = opt.dataset.mode;
            diarizeToggle.style.display = (currentMode === 'precise') ? 'flex' : 'none';
        });
    });

    // Toggle coloring
    document.querySelectorAll('.option-toggle input').forEach(input => {
        input.addEventListener('change', (e) => {
            e.target.parentElement.classList.toggle('active', e.target.checked);
        });
    });

    // Start button
    document.getElementById('sttBtn').addEventListener('click', startSTT);
});

async function startSTT() {
    const file = document.getElementById('mediaFile').files[0];
    const token = localStorage.getItem('token');
    const lang = document.getElementById('langSelect').value;
    const translate = document.getElementById('translateChk').checked;
    const diarize = document.getElementById('diarizeChk').checked;

    if (!token) return window.showToast?.("Please sign in", "error");
    if (!file) return window.showToast?.("Please select a file", "error");

    const userId = typeof window.parseJwtSub === 'function' ? window.parseJwtSub(token) : null;
    if (!userId) return window.showToast?.("Invalid session — please sign in again", "error");

    const btn = document.getElementById('sttBtn');
    const progArea = document.getElementById('progressArea');
    const progFill = document.getElementById('progFill');
    const statusTxt = document.getElementById('statusTxt');
    const resultsCard = document.getElementById('resultsCard');

    btn.disabled = true;
    progArea.style.display = 'block';
    resultsCard.style.display = 'none';
    progFill.style.width = '5%';
    statusTxt.innerText = "Preparing upload...";

    try {
        const API = getApiBase();

        const urlRes = await fetch(`${API}/api/upload-url`, { 
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'X-User-Id': userId
            },
            body: JSON.stringify({ filename: file.name, content_type: file.type, size: file.size })
        });

        const urlData = await urlRes.json().catch(() => ({}));
        if (!urlRes.ok) throw new Error(urlData.error || "Failed to fetch upload URL");

        // Step 2: Upload to R2
        statusTxt.innerText = "Uploading file...";
        const xhr = new XMLHttpRequest();
        await new Promise((resolve, reject) => {
            xhr.open('PUT', urlData.upload_url);
            xhr.setRequestHeader('Content-Type', file.type);
            xhr.upload.onprogress = (e) => {
                if (e.lengthComputable) {
                    const pct = Math.round((e.loaded / e.total) * 100);
                    progFill.style.width = (5 + (pct * 0.4)) + "%";
                    statusTxt.innerText = `Uploading (${pct}%)`;
                }
            };
            xhr.onload = () => (xhr.status === 200 ? resolve() : reject(new Error('Upload failed (HTTP ' + xhr.status + ')')));
            xhr.onerror = () => reject(new Error("Network error"));
            xhr.send(file);
        });

        // Step 3: Start processing
        statusTxt.innerText = "Starting AI processing...";
        const sttRes = await fetch(`${API}/api/stt`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'X-User-Id': userId
            },
            body: JSON.stringify({
                file_key: urlData.file_key,
                language: lang,
                mode: currentMode,
                diarize: diarize,
                translate: translate
            })
        });
        const sttData = await sttRes.json().catch(() => ({}));
        if (!sttRes.ok) throw new Error(sttData.error || "Failed to start STT job");

        // Step 4: Poll status
        pollStatus(sttData.job_id);

    } catch (e) {
        const msg = e && e.message ? e.message : String(e);
        window.showToast?.(msg, "error");
        btn.disabled = false;
        progArea.style.display = 'none';
    }
}

async function pollStatus(jobId) {
    const API = getApiBase();
    const progFill = document.getElementById('progFill');
    const statusTxt = document.getElementById('statusTxt');

    if (sttPollIntervalId) {
        clearInterval(sttPollIntervalId);
        sttPollIntervalId = null;
    }

    sttPollIntervalId = setInterval(async () => {
        try {
            const token = localStorage.getItem('token');
            const userId = typeof window.parseJwtSub === 'function' ? window.parseJwtSub(token) : null;
            if (!token || !userId) {
                if (sttPollIntervalId) clearInterval(sttPollIntervalId);
                sttPollIntervalId = null;
                window.showToast?.("Session expired — please sign in again", "error");
                document.getElementById('sttBtn').disabled = false;
                return;
            }

            const res = await fetch(`${API}/api/job/${jobId}`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'X-User-Id': userId
                }
            });

            if (res.status === 401) {
                if (sttPollIntervalId) clearInterval(sttPollIntervalId);
                sttPollIntervalId = null;
                window.clearSessionAndGuestUI?.('Session expired — please sign in again');
                document.getElementById('sttBtn').disabled = false;
                return;
            }

            const data = await res.json().catch(() => ({}));

            if (data.status === 'completed') {
                if (sttPollIntervalId) clearInterval(sttPollIntervalId);
                sttPollIntervalId = null;
                showResult(data);
                // تحديث الرصيد بعد الانتهاء
                if (typeof window.checkAuth === 'function') window.checkAuth();
            } else if (data.status === 'failed') {
                if (sttPollIntervalId) clearInterval(sttPollIntervalId);
                sttPollIntervalId = null;
                window.showToast?.("Processing failed: " + (data.error || 'Unknown'), "error");
                document.getElementById('sttBtn').disabled = false;
            } else {
                progFill.style.width = "75%";
                statusTxt.innerText = "Extracting text... (may take minutes)";
            }
        } catch (e) { console.error("Polling error:", e); }
    }, 4000);
}

function showResult(data) {
    document.getElementById('progressArea').style.display = 'none';
    document.getElementById('sttBtn').disabled = false;
    document.getElementById('resultsCard').style.display = 'block';

    const box = document.getElementById('transcriptBox');

    if (data.segments) {
        box.replaceChildren();
        for (let i = 0; i < data.segments.length; i++) {
            const s = data.segments[i];
            const div = document.createElement('div');
            div.className = 'segment';

            const ts = document.createElement('span');
            ts.className = 'timestamp';
            ts.textContent = '[' + formatTime(s.start) + ']';
            div.appendChild(ts);

            if (s.speaker != null && String(s.speaker) !== '') {
                const sp = document.createElement('span');
                sp.className = 'speaker';
                sp.textContent = 'Speaker ' + String(s.speaker);
                div.appendChild(sp);
            }

            const textEl = document.createElement('span');
            textEl.className = 'text';
            textEl.textContent = s.text != null ? String(s.text) : '';
            div.appendChild(textEl);

            box.appendChild(div);
        }
    } else {
        box.innerText = data.transcript || data.output_text || "No text found.";
    }

    if (data.output_url && /^https?:\/\//i.test(String(data.output_url))) {
        let dlBtn = document.getElementById('sttSubtitleDlBtn');
        if (!dlBtn) {
            dlBtn = document.createElement('a');
            dlBtn.id = 'sttSubtitleDlBtn';
            dlBtn.className = 'btn';
            dlBtn.style.marginTop = '15px';
            dlBtn.innerHTML = '<i class="fas fa-download"></i> Download Subtitle';
            box.parentElement.appendChild(dlBtn);
        }
        dlBtn.href = data.output_url;
    }
}

function formatTime(seconds) {
    const s = Math.floor(seconds);
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
}

// 💡 ملاحظة: تم حذف دوال escapeHtml و showToast المكررة من هنا 
// لأنها أصبحت تستدعى بشكل آمن من العقل المدبر shared.js (مثل window.showToast)
