// stt.js — Speech to Text Logic V2.0 (Fixed)

let currentMode = 'fast';

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

    if (!token) return showToast("Please sign in", "error");
    if (!file) return showToast("Please select a file", "error");

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
        // Step 1: Get upload URL
        const BE = window.API_BASE || 'https://api.glotix.ai';
        const urlRes = await fetch(`${BE}/upload-url`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename: file.name, content_type: file.type, size: file.size })
        });
        const urlData = await urlRes.json();
        if (!urlRes.ok) throw new Error(urlData.error);

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
            xhr.onload = () => xhr.status === 200 ? resolve() : reject("Upload failed");
            xhr.onerror = () => reject("Network error");
            xhr.send(file);
        });

        // Step 3: Start processing
        statusTxt.innerText = "Starting AI processing...";
        const sttRes = await fetch(`${BE}/stt`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                file_key: urlData.file_key,
                language: lang,
                mode: currentMode,
                diarize: diarize,
                translate: translate
            })
        });
        const sttData = await sttRes.json();
        if (!sttRes.ok) throw new Error(sttData.error);

        // Step 4: Poll status
        pollStatus(sttData.job_id, token);

    } catch (e) {
        showToast(e.message, "error");
        btn.disabled = false;
        progArea.style.display = 'none';
    }
}

async function pollStatus(jobId, token) {
    const BE = window.API_BASE || 'https://api.glotix.ai';
    const progFill = document.getElementById('progFill');
    const statusTxt = document.getElementById('statusTxt');

    const interval = setInterval(async () => {
        try {
            const res = await fetch(`${BE}/job/${jobId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();

            if (data.status === 'completed') {
                clearInterval(interval);
                showResult(data);
                if (typeof checkAuth === 'function') checkAuth();
            } else if (data.status === 'failed') {
                clearInterval(interval);
                showToast("Processing failed: " + data.error, "error");
                document.getElementById('sttBtn').disabled = false;
            } else {
                progFill.style.width = "75%";
                statusTxt.innerText = "Extracting text... (may take minutes)";
            }
        } catch (e) { console.error(e); }
    }, 4000);
}

function showResult(data) {
    document.getElementById('progressArea').style.display = 'none';
    document.getElementById('sttBtn').disabled = false;
    document.getElementById('resultsCard').style.display = 'block';

    const box = document.getElementById('transcriptBox');

    if (data.segments) {
        box.innerHTML = data.segments.map(s => `
            <div class="segment">
                <span class="timestamp">[${formatTime(s.start)}]</span>
                ${s.speaker ? `<span class="speaker">Speaker ${s.speaker}</span>` : ''}
                <span class="text">${escapeHtml(s.text)}</span>
            </div>
        `).join('');
    } else {
        box.innerText = data.transcript || data.output_text || "No text found.";
    }

    if(data.output_url) {
        const dlBtn = document.createElement('a');
        dlBtn.href = data.output_url;
        dlBtn.className = 'btn';
        dlBtn.style.marginTop = '15px';
        dlBtn.innerHTML = '<i class="fas fa-download"></i> Download Subtitle';
        box.parentElement.appendChild(dlBtn);
    }
}

function formatTime(seconds) {
    const s = Math.floor(seconds);
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
}

function escapeHtml(u) {
    return String(u||'').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#039;"}[m]));
}

function showToast(msg, type) {
    const t = document.getElementById('toasts');
    if (!t) { alert(msg); return; }
    const box = document.createElement('div');
    box.className = 'toast';
    box.textContent = msg;
    box.style.background = (type === 'error') ? '#ef4444' : '#10b981';
    t.appendChild(box);
    setTimeout(() => box.remove(), 4000);
}
