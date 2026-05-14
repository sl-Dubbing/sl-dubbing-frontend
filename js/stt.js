// stt.js — Speech to Text Logic V2.5 (SVG Flags & Dynamic Menu)
let currentMode = 'fast';

// ─── دالة جلب علم الـ SVG (لحل مشكلة ويندوز) ───
function getFlagImg(code) {
    let country = code.split('-')[1];
    if (!country) {
        const map = { 'ar':'sa', 'en':'us', 'fr':'fr', 'es':'es', 'pt':'pt', 'de':'de', 'it':'it', 'ru':'ru', 'ja':'jp' };
        country = map[code.split('-')[0]] || 'un';
    }
    return `https://hatscripts.github.io/circle-flags/flags/${country.toLowerCase()}.svg`;
}

document.addEventListener('DOMContentLoaded', () => {
    // 1. بناء قائمة اللغات برمجياً
    const langSelect = document.getElementById('langSelect');
    if (window.LANGUAGES && langSelect) {
        langSelect.innerHTML = '<option value="auto" selected>🌍 Auto Detect Language</option>';
        
        const popularGroup = document.createElement('optgroup');
        popularGroup.label = "── Popular Languages ──";
        const otherGroup = document.createElement('optgroup');
        otherGroup.label = "── All Languages ──";

        const sortedLangs = [...window.LANGUAGES].sort((a, b) => a.name_en.localeCompare(b.name_en));

        sortedLangs.forEach(lang => {
            const opt = document.createElement('option');
            opt.value = lang.base_lang; 
            opt.textContent = `${lang.name_en}`;
            // إضافة العلم كصورة خلفية ليست مدعومة في الـ <option> العادي ببعض المتصفحات
            // لذا نكتفي بالنص هنا، والأعلام تظهر في أجزاء أخرى من الموقع
            if (lang.popular) popularGroup.appendChild(opt);
            else otherGroup.appendChild(opt);
        });

        langSelect.appendChild(popularGroup);
        langSelect.appendChild(otherGroup);
    }

    // 2. معالج تبديل الأوضاع (Fast / Precise)
    const modeOptions = document.querySelectorAll('.mode-option');
    const diarizeToggle = document.getElementById('diarizeToggle');

    modeOptions.forEach(opt => {
        opt.addEventListener('click', () => {
            modeOptions.forEach(x => x.classList.remove('active'));
            opt.classList.add('active');
            currentMode = opt.dataset.mode;
            // إظهار خيار تقسيم المتحدثين فقط في وضع Precise
            if (diarizeToggle) diarizeToggle.style.display = (currentMode === 'precise') ? 'flex' : 'none';
        });
    });

    // 3. تلوين الخيارات عند التفعيل
    document.querySelectorAll('.option-toggle input').forEach(input => {
        input.addEventListener('change', (e) => {
            e.target.parentElement.classList.toggle('active', e.target.checked);
        });
    });

    // 4. ربط زر البدء
    document.getElementById('sttBtn')?.addEventListener('click', startSTT);
});

async function startSTT() {
    const file = document.getElementById('mediaFile').files[0];
    const token = localStorage.getItem('token');
    const lang = document.getElementById('langSelect').value;
    const translate = document.getElementById('translateChk').checked;
    const diarize = document.getElementById('diarizeChk')?.checked || false;

    if (!token) return window.showToast?.("Please sign in first", "error");
    if (!file) return window.showToast?.("Please select a file", "error");

    const btn = document.getElementById('sttBtn');
    const progArea = document.getElementById('progressArea');
    const progFill = document.getElementById('progFill');
    const statusTxt = document.getElementById('statusTxt');
    const resultsCard = document.getElementById('resultsCard');

    btn.disabled = true;
    progArea.style.display = 'block';
    resultsCard.style.display = 'none';
    progFill.style.width = '5%';
    statusTxt.innerText = "Preparing secure upload...";

    try {
        const API = (window.API_BASE || 'https://api.glotix.ai').replace(/\/$/, "");
        
        // الخطوة 1: طلب رابط الرفع
        const urlRes = await fetch(`${API}/api/upload-url`, { 
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename: file.name, content_type: file.type, size: file.size })
        });
        
        const urlData = await urlRes.json();
        if (!urlRes.ok) throw new Error(urlData.error || "Failed to fetch upload URL");

        // الخطوة 2: الرفع إلى Cloudflare R2
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
            xhr.onerror = () => reject("Network error during upload");
            xhr.send(file);
        });

        // الخطوة 3: بدء معالجة الذكاء الاصطناعي
        statusTxt.innerText = "Processing with AI...";
        const sttRes = await fetch(`${API}/api/stt`, {
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
        if (!sttRes.ok) throw new Error(sttData.error || "Failed to start STT job");

        // الخطوة 4: تتبع الحالة
        pollStatus(sttData.job_id, token);

    } catch (e) {
        window.showToast?.(e.message, "error");
        btn.disabled = false;
        progArea.style.display = 'none';
    }
}

async function pollStatus(jobId, token) {
    const API = (window.API_BASE || 'https://api.glotix.ai').replace(/\/$/, "");
    const progFill = document.getElementById('progFill');
    const statusTxt = document.getElementById('statusTxt');

    const interval = setInterval(async () => {
        try {
            const res = await fetch(`${API}/api/job/${jobId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();

            if (data.status === 'completed') {
                clearInterval(interval);
                showResult(data);
                if (typeof window.checkAuth === 'function') window.checkAuth();
            } else if (data.status === 'failed') {
                clearInterval(interval);
                window.showToast?.("Processing failed: " + (data.error || "Unknown error"), "error");
                document.getElementById('sttBtn').disabled = false;
            } else {
                progFill.style.width = "75%";
                statusTxt.innerText = "Extracting text and timestamps... (may take minutes)";
            }
        } catch (e) { console.error("Polling error:", e); }
    }, 4000);
}

function showResult(data) {
    document.getElementById('progressArea').style.display = 'none';
    document.getElementById('sttBtn').disabled = false;
    document.getElementById('resultsCard').style.display = 'block';

    const box = document.getElementById('transcriptBox');
    const downloadRow = document.getElementById('downloadRow');
    if (downloadRow) downloadRow.innerHTML = '';

    if (data.segments && data.segments.length > 0) {
        box.innerHTML = data.segments.map(s => `
            <div class="segment">
                <span class="timestamp">[${formatTime(s.start)}]</span>
                ${s.speaker ? `<span class="speaker">Speaker ${s.speaker}</span>` : ''}
                <span class="text">${window.escapeHtml?.(s.text) || s.text}</span>
            </div>
        `).join('');
    } else {
        box.innerText = data.transcript || data.output_text || "No text could be extracted.";
    }

    // إضافة أزرار التحميل إذا وُجدت روابط
    if (data.output_url && downloadRow) {
        const dlBtn = document.createElement('a');
        dlBtn.href = data.output_url;
        dlBtn.className = 'btn';
        dlBtn.innerHTML = '<i class="fa-solid fa-download"></i> Download Subtitles (.SRT)';
        downloadRow.appendChild(dlBtn);
    }
}

function formatTime(seconds) {
    const s = Math.floor(seconds);
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
}
