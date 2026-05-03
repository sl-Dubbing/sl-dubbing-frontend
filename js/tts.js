// js/tts.js - Text to Speech Logic

document.addEventListener('DOMContentLoaded', () => {
    const ttsInput = document.getElementById('ttsInput');
    const charCount = document.getElementById('charCount');
    const modeOptions = document.querySelectorAll('.mode-option');

    // تحديث عداد الحروف
    ttsInput?.addEventListener('input', () => {
        charCount.innerText = ttsInput.value.length;
    });

    // تبديل الأوضاع
    modeOptions.forEach(opt => {
        opt.addEventListener('click', () => {
            modeOptions.forEach(o => o.classList.remove('active'));
            opt.classList.add('active');
            document.body.setAttribute('data-mode', opt.dataset.mode);
        });
    });

    document.getElementById('ttsBtn')?.addEventListener('click', startTTSGeneration);
});

async function startTTSGeneration() {
    const text = document.getElementById('ttsInput').value.trim();
    const token = localStorage.getItem('token');
    const mode = document.body.getAttribute('data-mode') || 'fast';
    const voiceId = document.getElementById('voiceSelect').value;
    const customVoice = document.getElementById('customVoice').files[0];

    if (!token) return showToast("يرجى تسجيل الدخول", "error");
    if (!text) return showToast("اكتب النص أولاً", "warning");
    if (!window.selectedLangs || window.selectedLangs.size === 0) return showToast("اختر لغة واحدة على الأقل", "warning");

    const btn = document.getElementById('ttsBtn');
    const resultsList = document.getElementById('resultsList');
    const progArea = document.getElementById('progressArea');
    const progFill = document.getElementById('progFill');
    const statusTxt = document.getElementById('statusTxt');

    btn.disabled = true;
    progArea.style.display = 'block';
    resultsList.innerHTML = '';
    progFill.style.width = '10%';
    statusTxt.innerText = "جاري إرسال الطلبات...";

    try {
        let sample_b64 = "";
        if (mode === 'quality' && customVoice) {
            sample_b64 = await fileToBase64(customVoice);
        }

        const langs = [...window.selectedLangs];
        const promises = langs.map(async (langCode) => {
            const res = await fetch(`${window.API_BASE}/api/tts`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text: text,
                    lang: langCode,
                    mode: mode,
                    voice_id: voiceId || 'source',
                    sample_b64: sample_b64
                })
            });
            const data = await res.json();
            if (data.success) return pollTTSJob(data.job_id, langCode);
            throw new Error(data.error || "فشل التوليد");
        });

        await Promise.all(promises);
        showToast("اكتمل توليد كافة اللغات", "success");
        if (typeof checkAuth === 'function') checkAuth();

    } catch (e) {
        showToast(e.message, "error");
    } finally {
        btn.disabled = false;
        progFill.style.width = '100%';
        statusTxt.innerText = "اكتملت المهمة";
    }
}

async function pollTTSJob(jobId, langCode) {
    const token = localStorage.getItem('token');
    const start = Date.now();
    const resultsList = document.getElementById('resultsList');
    document.getElementById('resultsCard').style.display = 'block';

    while (Date.now() - start < 300000) { // 5 mins timeout
        const res = await fetch(`${window.API_BASE}/api/job/${jobId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        if (data.status === 'completed') {
            const item = document.createElement('div');
            item.className = 'result-item';
            item.innerHTML = `
                <div class="result-item-header">
                    <strong>${langCode.toUpperCase()}</strong>
                    <span class="success">✓ جاهز</span>
                </div>
                <audio controls src="${data.audio_url}" style="width:100%; margin-top:8px;"></audio>
            `;
            resultsList.appendChild(item);
            return data;
        }
        if (data.status === 'failed') throw new Error(`فشلت اللغة ${langCode}`);
        await new Promise(r => setTimeout(r, 3000));
    }
}

function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result.split(',')[1]);
        r.onerror = reject;
        r.readAsDataURL(file);
    });
}
