// js/dubbing.js — المحرك الاحترافي للدبلجة الصوتية واستنساخ الأصوات
// V4.2 - يدعم التوليد المتوازي والمراقبة الذكية لـ Railway

const API_BASE = 'https://web-production-14a1.up.railway.app';

// -----------------------------
// 🟢 مساعدة: إعداد خيارات Fetch
// -----------------------------
function makeFetchOptions(method = 'GET', token = null, body = null) {
    const opts = { method };
    const headers = {};

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    } else {
        opts.credentials = 'include';
    }

    // ملاحظة: عند استخدام FormData، المتصفح يضع Content-Type تلقائياً مع الـ boundary
    if (body && !(body instanceof FormData)) {
        headers['Content-Type'] = 'application/json';
    }

    opts.headers = headers;
    if (body !== null) opts.body = body;
    return opts;
}

// -----------------------------
// 🟢 بدء عملية الدبلجة
// -----------------------------
async function startDubbing() {
    const fileInput = document.getElementById('mediaFile');
    const file = fileInput?.files?.[0];
    const voiceSelect = document.getElementById('voiceSelect');
    const customVoiceInput = document.getElementById('customVoice');
    
    // جلب اللغات المختارة (نعتمد على Set عالمي اسمه selectedLangs)
    if (typeof window.selectedLangs === 'undefined' || window.selectedLangs.size === 0) {
        showToast('يرجى اختيار لغة واحدة على الأقل للدبلجة', '#f59e0b');
        return;
    }

    if (!file) {
        showToast('يرجى رفع ملف الفيديو أو الصوت أولاً', '#ef4444');
        return;
    }

    // عناصر الواجهة
    const dubBtn = document.getElementById('dubBtn');
    const progressArea = document.getElementById('progressArea');
    const statusTxt = document.getElementById('statusTxt');
    const progFill = document.getElementById('progFill');
    const resultsList = document.getElementById('resultsList');
    const resultsCard = document.getElementById('resultsCard');

    // تفعيل وضع "جاري العمل"
    dubBtn.disabled = true;
    progressArea.style.display = 'block';
    resultsCard.style.display = 'block';
    resultsList.innerHTML = ''; // تنظيف النتائج السابقة
    progFill.style.width = '10%';
    statusTxt.innerText = '⏳ جاري رفع الملف وتجهيز الطلبات...';

    const token = localStorage.getItem('token');
    const langs = Array.from(window.selectedLangs);
    const totalTasks = langs.length;
    let completedTasks = 0;

    // تشغيل المهام بشكل متوازي لكل لغة
    const dubbingPromises = langs.map(async (langCode) => {
        // إنشاء بطاقة نتيجة أولية لكل لغة
        const langData = window.LANGUAGES?.find(l => l.code === langCode);
        const cardId = `res-${langCode}`;
        renderInitialResult(cardId, langData, langCode);

        try {
            const formData = new FormData();
            formData.append('media_file', file);
            formData.append('lang', langCode);

            // تحديد الصوت (مخصص أم جاهز أم أصلي)
            if (customVoiceInput?.files?.[0]) {
                formData.append('voice_sample', customVoiceInput.files[0]);
                formData.append('voice_id', 'custom');
            } else if (voiceSelect?.value && voiceSelect.value !== 'original') {
                formData.append('voice_id', voiceSelect.value);
            } else {
                formData.append('voice_id', 'original');
            }

            // 1. إرسال الطلب للسيرفر
            const res = await fetch(`${API_BASE}/api/dubbing`, makeFetchOptions('POST', token, formData));
            
            if (!res.ok) {
                const err = await res.json().catch(() => ({ error: 'Server Error' }));
                throw new Error(err.error || `Error ${res.status}`);
            }

            const data = await res.json();
            const jobId = data.job_id;

            // 2. المراقبة (Polling) لحين الانتهاء
            updateResultStatus(cardId, '⏳ جاري الدبلجة...');
            const finalData = await waitForJob(jobId, token, cardId);

            if (finalData) {
                renderFinalSuccess(cardId, langCode, langData, finalData.audio_url || finalData.result_url);
            }

        } catch (err) {
            console.error(`Dubbing failed for ${langCode}:`, err);
            renderFinalError(cardId, langCode, err.message);
        } finally {
            completedTasks++;
            const progress = 10 + ((completedTasks / totalTasks) * 90);
            progFill.style.width = `${progress}%`;
            statusTxt.innerText = `تمت معالجة ${completedTasks} من أصل ${totalTasks} لغة`;
        }
    });

    await Promise.all(dubbingPromises);
    statusTxt.innerText = '✅ اكتملت جميع مهام الدبلجة';
    dubBtn.disabled = false;
    
    // تحديث رصيد المستخدم
    if (typeof checkAuth === 'function') checkAuth();
}

// -----------------------------
// 🔄 نظام المراقبة (Polling)
// -----------------------------
async function waitForJob(jobId, token, cardId) {
    let attempts = 0;
    const maxAttempts = 100; // حوالي 5 دقائق

    while (attempts < maxAttempts) {
        await new Promise(r => setTimeout(r, 3000)); // فحص كل 3 ثواني
        attempts++;

        try {
            const res = await fetch(`${API_BASE}/api/job/${jobId}`, makeFetchOptions('GET', token));
            if (!res.ok) continue;

            const data = await res.json();
            if (data.status === 'completed') return data;
            if (data.status === 'failed') throw new Error(data.error || 'فشلت المهمة في السيرفر');

            // تحديث وقت الانتظار في البطاقة
            updateResultStatus(cardId, `⏳ جاري المعالجة (${attempts * 3}s)`);

        } catch (e) {
            console.warn("Polling error:", e);
        }
    }
    throw new Error('انتهى وقت الانتظار (Timeout)');
}

// -----------------------------
// 🎨 وظائف رسم النتائج في الواجهة
// -----------------------------
function renderInitialResult(cardId, lang, code) {
    const list = document.getElementById('resultsList');
    const div = document.createElement('div');
    div.id = cardId;
    div.className = 'result-item card';
    div.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center;">
            <div style="font-weight:bold;">${lang?.flag || '🌍'} ${lang?.name || code}</div>
            <div class="status-label" style="font-size:0.8rem; color:#aaa;">⏳ جاري الرفع...</div>
        </div>
    `;
    list.appendChild(div);
}

function updateResultStatus(cardId, text) {
    const card = document.getElementById(cardId);
    if (card) {
        const label = card.querySelector('.status-label');
        if (label) label.innerText = text;
    }
}

function renderFinalSuccess(cardId, code, lang, url) {
    const card = document.getElementById(cardId);
    if (!card) return;
    card.style.borderColor = '#10b981';
    card.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
            <div style="font-weight:bold; color:#10b981;">${lang?.flag || '🌍'} ${lang?.name || code} ✅</div>
            <a href="${url}" download="dubbed_${code}.mp3" class="btn-mini" style="background:#10b981; color:white; padding:4px 8px; border-radius:6px; font-size:0.7rem; text-decoration:none;">تحميل</a>
        </div>
        <audio controls src="${url}" style="width:100%; height:35px;"></audio>
    `;
}

function renderFinalError(cardId, code, error) {
    const card = document.getElementById(cardId);
    if (!card) return;
    card.style.borderColor = '#ef4444';
    card.innerHTML = `
        <div style="font-weight:bold; color:#ef4444; margin-bottom:5px;">${code} ❌</div>
        <div style="font-size:0.75rem; color:#ef4444; background:rgba(239,68,68,0.1); padding:5px; border-radius:5px;">${error}</div>
    `;
}

// تصدير للنافذة العالمية
window.startDubbing = startDubbing;
