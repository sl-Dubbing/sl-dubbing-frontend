// ==========================================
// 🎬 dubbing.js — تحديث نظام الموجه الذكي (Gateway)
// ==========================================
const API_BASE = 'https://web-production-14a1.up.railway.app';
const SAMPLES_BASE = 'samples';

// ... (تُبقى دوال Sidebar والـ Toasts كما هي بدون تغيير) ...

// ==========================================
// 🎬 بدء الدبلجة بنظام الموجه الذكي (Async Dispatch)
// ==========================================
async function startDubbing() {
    const file = document.getElementById('mediaFile')?.files?.[0];
    const voiceSelect = document.getElementById('voiceSelect');
    const customVoice = document.getElementById('customVoice');
    const token = localStorage.getItem('token');

    if (!token) { showToast('يرجى تسجيل الدخول أولاً', 'error'); return; }
    if (!file) { showToast('يرجى اختيار ملف فيديو/صوت', 'error'); return; }
    if (selectedLangs.size === 0) { showToast('يرجى اختيار لغة هدف واحدة على الأقل', 'error'); return; }

    const dubBtn = document.getElementById('dubBtn');
    const progressArea = document.getElementById('progressArea');
    const resultsCard = document.getElementById('resultsCard');
    const resultsList = document.getElementById('resultsList');
    const statusTxt = document.getElementById('statusTxt');
    const progFill = document.getElementById('progFill');
    const miniStatus = document.getElementById('miniStatus');

    dubBtn.disabled = true;
    progressArea.style.display = 'block';
    resultsCard.style.display = 'block';
    resultsList.innerHTML = '';

    const langs = [...selectedLangs];
    
    // 1. إنشاء البطاقات في الواجهة فوراً
    langs.forEach(code => {
        const lang = LANGUAGES.find(l => l.code === code);
        const card = document.createElement('div');
        card.className = 'result-item';
        card.id = `result-${code}`;
        card.innerHTML = `
            <div class="result-item-header">
                <span class="result-item-flag">${lang.flag}</span>
                <span class="result-item-name">${lang.name_ar}</span>
                <span class="result-item-status" id="status-${code}">إرسال للـ Gateway...</span>
            </div>
            <div class="result-item-body" id="body-${code}">
                <div class="loading-spinner-small"></div>
            </div>
        `;
        resultsList.appendChild(card);
    });

    statusTxt.innerText = "جاري توجيه الطلبات للمحرك...";
    progFill.style.width = '10%';

    // 2. معالجة اللغات (نرسل الطلب للـ Gateway ونحصل على ID فوراً)
    const promises = langs.map(async (langCode) => {
        const statusEl = document.getElementById(`status-${langCode}`);
        const bodyEl = document.getElementById(`body-${langCode}`);

        try {
            const formData = new FormData();
            formData.append('media_file', file);
            formData.append('lang', langCode);

            // تحديد البصمة الصوتية
            if (customVoice?.files?.[0]) {
                formData.append('voice_sample', customVoice.files[0]);
                formData.append('voice_id', 'custom');
            } else {
                formData.append('voice_id', voiceSelect.value || 'source');
            }

            // إرسال الطلب للموجه (سرعة استجابة فائقة)
            const res = await fetch(`${API_BASE}/api/tts`, { // تم تغيير المسار ليتوافق مع app.py
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'خطأ في التوجيه');

            // بمجرد استلام الـ ID، نبدأ المراقبة
            statusEl.textContent = 'في الطابور (Modal)...';
            return await waitForJob(data.job_id, token, statusEl, bodyEl, langCode);

        } catch (e) {
            statusEl.textContent = '✗ فشل التوجيه';
            statusEl.classList.add('error');
            bodyEl.innerHTML = `<div class="error-msg">${e.message}</div>`;
        }
    });

    await Promise.all(promises);
    
    dubBtn.disabled = false;
    statusTxt.innerText = "اكتملت جميع العمليات";
    progFill.style.width = '100%';
    updateSidebarAuth(); // لتحديث الرصيد بعد الخصم
}

// ==========================================
// 🔄 نظام المراقبة الذكي (The Polling Mechanism)
// ==========================================
async function waitForJob(jobId, token, statusEl, bodyEl, langCode) {
    const lang = LANGUAGES.find(l => l.code === langCode);
    let attempts = 0;
    const MAX_ATTEMPTS = 200; // حوالي 10 دقائق

    return new Promise((resolve) => {
        const interval = setInterval(async () => {
            attempts++;
            try {
                const res = await fetch(`${API_BASE}/api/job/${jobId}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const data = await res.json();

                if (data.status === 'completed') {
                    clearInterval(interval);
                    statusEl.textContent = '✓ جاهز';
                    statusEl.classList.add('success');
                    bodyEl.innerHTML = `
                        <audio controls src="${data.audio_url}"></audio>
                        <a href="${data.audio_url}" download class="btn-download">تحميل ${lang.name_ar}</a>
                    `;
                    resolve(data);
                } else if (data.status === 'failed') {
                    clearInterval(interval);
                    statusEl.textContent = '✗ فشل في Modal';
                    statusEl.classList.add('error');
                    bodyEl.innerHTML = `<div class="error-msg">فشل استنساخ الصوت</div>`;
                    resolve(null);
                } else {
                    // تحديث الحالة للمستخدم (شعور بالحركة)
                    statusEl.textContent = `جاري المعالجة... (${attempts}ث)`;
                }
            } catch (e) {
                console.warn("Polling error:", e);
            }

            if (attempts >= MAX_ATTEMPTS) {
                clearInterval(interval);
                statusEl.textContent = '✗ انتهت المهلة';
                resolve(null);
            }
        }, 3000); // الفحص كل 3 ثوانٍ
    });
}

// ... (باقي الكود الخاص بـ DOMContentLoaded والـ Exports يُبقى كما هو) ...
