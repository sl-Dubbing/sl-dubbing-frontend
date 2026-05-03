// js/stt.js — Speech to Text Logic V1.0

let currentMode = 'fast';

document.addEventListener('DOMContentLoaded', () => {
    // 1. التعامل مع تبديل الأوضاع (سريع / دقيق)
    const modeOptions = document.querySelectorAll('.mode-option');
    const diarizeToggle = document.getElementById('diarizeToggle');

    modeOptions.forEach(opt => {
        opt.addEventListener('click', () => {
            modeOptions.forEach(x => x.classList.remove('active'));
            opt.classList.add('active');
            currentMode = opt.dataset.mode;

            // إظهار خيار كشف المتحدثين فقط في الوضع الدقيق
            diarizeToggle.style.display = (currentMode === 'precise') ? 'flex' : 'none';
        });
    });

    // 2. تلوين الأزرار عند الضغط عليها (Toggles)
    document.querySelectorAll('.option-toggle input').forEach(input => {
        input.addEventListener('change', (e) => {
            e.target.parentElement.classList.toggle('active', e.target.checked);
        });
    });

    // 3. زر البدء
    document.getElementById('sttBtn').addEventListener('click', startSTT);
});

async function startSTT() {
    const file = document.getElementById('mediaFile').files[0];
    const token = localStorage.getItem('token');
    const lang = document.getElementById('langSelect').value;
    const translate = document.getElementById('translateChk').checked;
    const diarize = document.getElementById('diarizeChk').checked;

    if (!token) return showToast("يرجى تسجيل الدخول", "error");
    if (!file) return showToast("يرجى اختيار ملف أولاً", "error");

    const btn = document.getElementById('sttBtn');
    const progArea = document.getElementById('progressArea');
    const progFill = document.getElementById('progFill');
    const statusTxt = document.getElementById('statusTxt');
    const resultsCard = document.getElementById('resultsCard');
    const transcriptBox = document.getElementById('transcriptBox');

    btn.disabled = true;
    progArea.style.display = 'block';
    resultsCard.style.display = 'none';
    progFill.style.width = '5%';
    statusTxt.innerText = "⚡ تجهيز الرفع المباشر...";

    try {
        // الخطوة 1: الحصول على رابط الرفع
        const urlRes = await fetch(`${window.API_BASE}/api/upload-url`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename: file.name, content_type: file.type, size: file.size })
        });
        const urlData = await urlRes.json();
        if (!urlRes.ok) throw new Error(urlData.error);

        // الخطوة 2: الرفع لـ R2
        statusTxt.innerText = "📤 جاري رفع الملف...";
        const xhr = new XMLHttpRequest();
        await new Promise((resolve, reject) => {
            xhr.open('PUT', urlData.upload_url);
            xhr.setRequestHeader('Content-Type', file.type);
            xhr.upload.onprogress = (e) => {
                if (e.lengthComputable) {
                    const pct = Math.round((e.loaded / e.total) * 100);
                    progFill.style.width = (5 + (pct * 0.4)) + "%";
                    statusTxt.innerText = `📤 جاري الرفع (${pct}%)`;
                }
            };
            xhr.onload = () => xhr.status === 200 ? resolve() : reject("فشل الرفع");
            xhr.onerror = () => reject("خطأ شبكة");
            xhr.send(file);
        });

        // الخطوة 3: إرسال المهمة للسيرفر
        statusTxt.innerText = "⚙️ بدء المعالجة بالذكاء الاصطناعي...";
        const sttRes = await fetch(`${window.API_BASE}/api/stt`, {
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

        // الخطوة 4: المتابعة (Polling)
        pollStatus(sttData.job_id, token);

    } catch (e) {
        showToast(e.message, "error");
        btn.disabled = false;
        progArea.style.display = 'none';
    }
}

async function pollStatus(jobId, token) {
    const progFill = document.getElementById('progFill');
    const statusTxt = document.getElementById('statusTxt');
    
    const interval = setInterval(async () => {
        try {
            const res = await fetch(`${window.API_BASE}/api/job/${jobId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();

            if (data.status === 'completed') {
                clearInterval(interval);
                showResult(data);
            } else if (data.status === 'failed') {
                clearInterval(interval);
                showToast("فشلت المعالجة: " + data.error, "error");
                document.getElementById('sttBtn').disabled = false;
            } else {
                progFill.style.width = "75%";
                statusTxt.innerText = "🎬 جاري استخراج النص... (قد يستغرق دقائق)";
            }
        } catch (e) { console.error(e); }
    }, 4000);
}

function showResult(data) {
    document.getElementById('progressArea').style.display = 'none';
    document.getElementById('sttBtn').disabled = false;
    document.getElementById('resultsCard').style.display = 'block';
    
    const box = document.getElementById('transcriptBox');
    
    // إذا كان هناك بيانات مفصلة (WhisperX)
    if (data.segments) {
        box.innerHTML = data.segments.map(s => `
            <div class="segment">
                <span class="timestamp">[${formatTime(s.start)}]</span>
                ${s.speaker ? `<span class="speaker">المتحدث ${s.speaker}</span>` : ''}
                <span class="text">${escapeHtml(s.text)}</span>
            </div>
        `).join('');
    } else {
        box.innerText = data.transcript || "لم يتم العثور على نص.";
    }
}

function formatTime(seconds) {
    const s = Math.floor(seconds);
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
}
