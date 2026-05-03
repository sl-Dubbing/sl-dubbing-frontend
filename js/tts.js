// js/tts.js - Text to Speech Logic (إصدار مدير الملفات)

document.addEventListener('DOMContentLoaded', () => {
    const ttsInput = document.getElementById('ttsInput');
    const charCount = document.getElementById('charCount');
    const modeOptions = document.querySelectorAll('.mode-option');

    // 1. تحديث عداد الحروف اللحظي
    ttsInput?.addEventListener('input', () => {
        if (charCount) charCount.innerText = ttsInput.value.length;
    });

    // 2. إدارة تبديل الأوضاع (سريع / عالي الجودة)
    modeOptions.forEach(opt => {
        opt.addEventListener('click', () => {
            modeOptions.forEach(o => o.classList.remove('active'));
            opt.classList.add('active');
            // تغيير السمة في body للتحكم في ظهور العناصر عبر CSS
            document.body.setAttribute('data-mode', opt.dataset.mode);
        });
    });

    // 3. ربط زر التوليد بالدالة الأساسية
    document.getElementById('ttsBtn')?.addEventListener('click', startTTSGeneration);
});

/**
 * دالة البدء في عملية تحويل النص لصوت
 */
async function startTTSGeneration() {
    const text = document.getElementById('ttsInput').value.trim();
    const token = localStorage.getItem('token');
    const mode = document.body.getAttribute('data-mode') || 'fast';
    const voiceId = document.getElementById('voiceSelect')?.value || 'source';
    const customVoice = document.getElementById('customVoice')?.files[0];

    // التحقق من المتطلبات
    if (!token) return showToast("يرجى تسجيل الدخول أولاً", "error");
    if (!text) return showToast("اكتب النص الذي تريد تحويله", "warning");
    if (!window.selectedLangs || window.selectedLangs.size === 0) 
        return showToast("يرجى اختيار لغة واحدة على الأقل من القائمة", "warning");

    const btn = document.getElementById('ttsBtn');
    const resultsCard = document.getElementById('resultsCard');
    const resultsList = document.getElementById('resultsList');
    const progArea = document.getElementById('progressArea');
    const progFill = document.getElementById('progFill');
    const statusTxt = document.getElementById('statusTxt');

    // تجهيز الواجهة
    btn.disabled = true;
    progArea.style.display = 'block';
    resultsCard.style.display = 'block';
    resultsList.innerHTML = ''; 
    progFill.style.width = '10%';
    statusTxt.innerText = "جاري إرسال الطلبات للسيرفر...";

    try {
        let sample_b64 = "";
        // إذا كان الوضع "عالي الجودة" وهناك ملف صوتي مرفوع
        if (mode === 'quality' && customVoice) {
            statusTxt.innerText = "جاري معالجة البصمة الصوتية...";
            sample_b64 = await fileToBase64(customVoice);
        }

        const langs = [...window.selectedLangs];
        const total = langs.length;
        let started = 0;

        // إرسال الطلبات لكل اللغات المحددة بالتوازي
        const promises = langs.map(async (langCode) => {
            try {
                const res = await fetch(`${window.API_BASE}/api/tts`, {
                    method: 'POST',
                    headers: { 
                        'Authorization': `Bearer ${token}`, 
                        'Content-Type': 'application/json' 
                    },
                    body: JSON.stringify({
                        text: text,
                        filename: text.substring(0, 20) + "...", // إرسال جزء من النص كاسم للملف في "ملفاتي"
                        lang: langCode,
                        mode: mode,
                        voice_id: voiceId,
                        sample_b64: sample_b64
                    })
                });

                const data = await res.json();
                if (data.success) {
                    started++;
                    progFill.style.width = (10 + (started / total) * 20) + "%";
                    return pollTTSJob(data.job_id, langCode);
                } else {
                    throw new Error(data.error || `فشل البدء في لغة ${langCode}`);
                }
            } catch (err) {
                renderErrorItem(langCode, err.message);
            }
        });

        await Promise.all(promises);
        showToast("اكتملت كافة الطلبات بنجاح!", "success");
        
        // تحديث الرصيد في الواجهة لأن الـ TTS يستهلك نقاطاً
        if (typeof checkAuth === 'function') checkAuth();

    } catch (e) {
        showToast(e.message, "error");
    } finally {
        btn.disabled = false;
        progFill.style.width = '100%';
        statusTxt.innerText = "اكتملت معالجة كافة اللغات";
    }
}

/**
 * مراقبة حالة المهمة حتى اكتمال الصوت
 */
async function pollTTSJob(jobId, langCode) {
    const token = localStorage.getItem('token');
    const start = Date.now();
    const resultsList = document.getElementById('resultsList');
    const langObj = window.LANGUAGES?.find(l => l.code === langCode);
    const langName = langObj ? langObj.name_ar : langCode.toUpperCase();

    // إنشاء عنصر "جاري المعالجة" في القائمة
    const item = document.createElement('div');
    item.className = 'result-item';
    item.id = `tts-res-${jobId}`;
    item.innerHTML = `
        <div class="result-item-header">
            <strong>${langName}</strong>
            <span class="status-wait">⏳ جاري التوليد...</span>
        </div>
    `;
    resultsList.appendChild(item);

    // فحص الحالة كل 3 ثوانٍ (بحد أقصى 5 دقائق)
    while (Date.now() - start < 300000) {
        try {
            const res = await fetch(`${window.API_BASE}/api/job/${jobId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();

            if (data.status === 'completed') {
                item.innerHTML = `
                    <div class="result-item-header">
                        <strong>${langName}</strong>
                        <span class="success">✓ جاهز</span>
                    </div>
                    <audio controls src="${data.audio_url}" style="width:100%; margin-top:8px; height:35px;"></audio>
                    <div style="margin-top:8px; font-size:0.75rem; color:#86868b;">* تم حفظه في "ملفاتي"</div>
                `;
                return data;
            }
            
            if (data.status === 'failed') {
                item.innerHTML = `
                    <div class="result-item-header">
                        <strong>${langName}</strong>
                        <span class="error">✗ فشل</span>
                    </div>
                    <div style="color:#ef4444; font-size:0.8rem; margin-top:5px;">${data.error || 'خطأ غير معروف'}</div>
                `;
                return;
            }
        } catch (e) {
            console.warn("فشل في تحديث حالة TTS:", e);
        }
        await new Promise(r => setTimeout(r, 3000));
    }
    
    item.innerHTML = `<div class="result-item-header"><strong>${langName}</strong> <span class="error">✗ انتهت المهلة</span></div>`;
}

/**
 * عرض خطأ في حال فشل لغة معينة قبل البدء
 */
function renderErrorItem(langCode, errorMsg) {
    const resultsList = document.getElementById('resultsList');
    const item = document.createElement('div');
    item.className = 'result-item';
    item.innerHTML = `
        <div class="result-item-header">
            <strong>${langCode.toUpperCase()}</strong>
            <span class="error">✗ خطأ</span>
        </div>
        <div style="color:#ef4444; font-size:0.8rem; margin-top:5px;">${errorMsg}</div>
    `;
    resultsList.appendChild(item);
}

/**
 * تحويل الملف الصوتي لـ Base64
 */
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result.split(',')[1]);
        r.onerror = (err) => reject(new Error("فشل قراءة ملف الصوت"));
        r.readAsDataURL(file);
    });
}
