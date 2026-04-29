// dubbing.js — مُدقّق ومُحسّن
// ==========================================
// 🎬 إعدادات أساسية
// ==========================================
const API_BASE = 'https://web-production-14a1.up.railway.app';
const SAMPLES_BASE = 'samples';

// ==========================================
// 🛠️ مساعدة: إعداد خيارات fetch مع دعم token أو cookie
// ==========================================
function makeFetchOptions(method = 'GET', token = null, body = null, isJson = true) {
    const opts = { method };
    if (token) {
        opts.headers = { 'Authorization': `Bearer ${token}` };
        if (isJson) opts.headers['Accept'] = 'application/json';
        if (isJson && body) opts.headers['Content-Type'] = 'application/json';
    } else {
        // الاعتماد على HttpOnly cookie
        opts.credentials = 'include';
        if (isJson) opts.headers = { 'Accept': 'application/json', 'Content-Type': 'application/json' };
    }
    if (body !== null) opts.body = body;
    return opts;
}

// ==========================================
// 🎬 بدء الدبلجة بنظام الموجه الذكي (Async Dispatch)
// ==========================================
async function startDubbing() {
    // عناصر DOM الأساسية
    const fileInput = document.getElementById('mediaFile');
    const file = fileInput?.files?.[0] || null;
    const voiceSelect = document.getElementById('voiceSelect');
    const customVoiceInput = document.getElementById('customVoice');

    // token محلي (إن وُجد)
    let token = localStorage.getItem('token') || sessionStorage.getItem('token') || null;

    // عناصر واجهة المستخدم
    const dubBtn = document.getElementById('dubBtn');
    const progressArea = document.getElementById('progressArea');
    const resultsCard = document.getElementById('resultsCard');
    const resultsList = document.getElementById('resultsList');
    const statusTxt = document.getElementById('statusTxt');
    const progFill = document.getElementById('progFill');
    const miniStatus = document.getElementById('miniStatus');

    // حماية DOM
    if (!dubBtn || !progressArea || !resultsList || !statusTxt || !progFill) {
        console.error('Missing required DOM elements for dubbing UI.');
        return;
    }

    // تحقق أساسي من الجلسة: إذا لا توكن محلي، حاول التحقق عبر الكوكي
    if (!token) {
        try {
            const check = await fetch(`${API_BASE}/api/user`, { method: 'GET', credentials: 'include' });
            if (check.ok) {
                const d = await check.json().catch(() => null);
                if (d && (d.success || d.user)) {
                    // لا حاجة لتغيير token؛ سنعتمد على الكوكي في الطلبات التالية
                    token = null;
                } else {
                    showToast('يرجى تسجيل الدخول أولاً', 'error');
                    return;
                }
            } else {
                showToast('يرجى تسجيل الدخول أولاً', 'error');
                return;
            }
        } catch (e) {
            console.warn('Auth cookie check failed:', e);
            showToast('فشل التحقق من الجلسة. يرجى تسجيل الدخول.', 'error');
            return;
        }
    }

    // تحقق من الملف واللغات
    if (!file) {
        showToast('يرجى اختيار ملف فيديو/صوت', 'error');
        return;
    }

    if (typeof selectedLangs === 'undefined' || !(selectedLangs instanceof Set) || selectedLangs.size === 0) {
        showToast('يرجى اختيار لغة هدف واحدة على الأقل', 'error');
        return;
    }

    // تهيئة الواجهة
    dubBtn.disabled = true;
    progressArea.style.display = 'block';
    resultsCard.style.display = 'block';
    resultsList.innerHTML = '';
    progFill.style.width = '5%';
    progFill.style.background = '';
    statusTxt.innerText = 'جاري توجيه الطلبات للمحرك...';
    if (miniStatus) miniStatus.innerText = 'قيد الإرسال';

    const langs = [...selectedLangs];
    const total = langs.length;
    let completed = 0;

    // إنشاء بطاقات النتائج فوراً
    langs.forEach(code => {
        const lang = (typeof LANGUAGES !== 'undefined') ? LANGUAGES.find(l => l.code === code) : null;
        const card = document.createElement('div');
        card.className = 'result-item';
        card.id = `result-${code}`;
        card.innerHTML = `
            <div class="result-item-header">
                <span class="result-item-flag">${lang?.flag || '🌍'}</span>
                <span class="result-item-name">${lang?.name_ar || code}</span>
                <span class="result-item-status" id="status-${code}">إرسال للـ Gateway...</span>
            </div>
            <div class="result-item-body" id="body-${code}">
                <div class="loading-spinner-small" aria-hidden="true"></div>
            </div>
        `;
        resultsList.appendChild(card);
    });

    // دالة مساعدة لتحديث التقدّم العام
    function updateGlobalProgress() {
        completed++;
        const pct = Math.round((completed / total) * 95) + 5;
        progFill.style.width = pct + '%';
        statusTxt.innerText = `${completed}/${total} لغة مكتملة`;
        if (miniStatus) miniStatus.innerText = `${completed}/${total}`;
    }

    // إرسال طلب لكل لغة (متوازي)
    const tasks = langs.map(async (langCode) => {
        const statusEl = document.getElementById(`status-${langCode}`);
        const bodyEl = document.getElementById(`body-${langCode}`);

        try {
            // بناء FormData
            const formData = new FormData();
            formData.append('media_file', file);
            formData.append('lang', langCode);

            // بصمة صوتية: ملف مرفوع أم اختيار من القائمة
            if (customVoiceInput?.files?.[0]) {
                formData.append('voice_sample', customVoiceInput.files[0]);
                formData.append('voice_id', 'custom');
            } else if (voiceSelect?.value) {
                formData.append('voice_id', voiceSelect.value);
            } else {
                formData.append('voice_id', 'source');
            }

            // ملاحظة: عند إرسال FormData لا نحدد Content-Type يدوياً
            const opts = token
                ? { method: 'POST', headers: { 'Authorization': `Bearer ${token}` }, body: formData }
                : { method: 'POST', credentials: 'include', body: formData };

            const res = await fetch(`${API_BASE}/api/tts`, opts);
            let data = null;
            try { data = await res.json().catch(() => null); } catch (e) { data = null; }

            if (!res.ok) {
                const msg = (data && (data.error || data.message)) ? (data.error || data.message) : `HTTP ${res.status}`;
                throw new Error(msg);
            }

            if (!data || !data.job_id) {
                throw new Error(data?.error || 'لم يتم استلام معرف المهمة من الخادم');
            }

            // تم استلام job_id — نبدأ المراقبة
            if (statusEl) statusEl.textContent = 'في الطابور...';
            const final = await waitForJob(data.job_id, token, statusEl, bodyEl, langCode);

            if (final) {
                // تم التوليد بنجاح
                if (statusEl) {
                    statusEl.textContent = '✓ مكتمل';
                    statusEl.classList.add('success');
                }
            } else {
                // فشل أو مهلة
                if (statusEl) {
                    statusEl.textContent = '✗ فشل';
                    statusEl.classList.add('error');
                }
            }
        } catch (err) {
            console.error(`Dubbing ${langCode} error:`, err);
            if (statusEl) {
                statusEl.textContent = '✗ فشل التوجيه';
                statusEl.classList.add('error');
            }
            if (bodyEl) {
                bodyEl.innerHTML = `<div class="error-msg" style="color:#ef4444; padding:6px;">${escapeHtml(err.message || 'خطأ غير معروف')}</div>`;
            }
        } finally {
            updateGlobalProgress();
        }
    });

    // انتظر اكتمال كل المهام
    await Promise.all(tasks);

    // إنهاء الواجهة
    progFill.style.width = '100%';
    statusTxt.innerText = '✓ اكتملت جميع العمليات';
    dubBtn.disabled = false;

    // تحديث الرصيد/الواجهة
    if (typeof updateSidebarAuth === 'function') {
        try { updateSidebarAuth(); } catch (e) { console.warn('updateSidebarAuth failed', e); }
    }
}

// ==========================================
// 🔄 نظام المراقبة الذكي (Polling with timeout)
// ==========================================
async function waitForJob(jobId, token, statusEl, bodyEl, langCode) {
    const lang = (typeof LANGUAGES !== 'undefined') ? LANGUAGES.find(l => l.code === langCode) : { name_ar: langCode };
    const start = Date.now();
    const TIMEOUT_MS = 10 * 60 * 1000; // 10 دقائق
    const POLL_INTERVAL = 3000; // 3 ثواني

    // Helper: safe fetch with token or cookie
    async function pollOnce() {
        const opts = token
            ? { method: 'GET', headers: { 'Authorization': `Bearer ${token}` } }
            : { method: 'GET', credentials: 'include' };
        const res = await fetch(`${API_BASE}/api/job/${jobId}`, opts);
        const data = await res.json().catch(() => null);
        return { ok: res.ok, status: res.status, data };
    }

    // Loop polling
    while (Date.now() - start < TIMEOUT_MS) {
        try {
            const { ok, status, data } = await pollOnce();

            if (!ok) {
                // إذا كانت استجابة غير OK، سجل وحاول مرة أخرى
                console.warn(`Job poll HTTP ${status}`, data);
            }

            if (data && data.status === 'completed') {
                // عرض النتيجة
                if (statusEl) {
                    statusEl.textContent = '✓ جاهز';
                    statusEl.classList.add('success');
                }
                if (bodyEl) {
                    const audioUrl = data.audio_url || data.result_url || '';
                    bodyEl.innerHTML = `
                        <audio controls src="${escapeHtml(audioUrl)}"></audio>
                        <a href="${escapeHtml(audioUrl)}" download="tts_${langCode}_${Date.now()}.mp3" class="btn-download" style="display:inline-block;margin-top:8px;">
                            <i class="fas fa-download"></i> تحميل ${escapeHtml(lang.name_ar || langCode)}
                        </a>
                    `;
                }
                return data;
            }

            if (data && data.status === 'failed') {
                if (statusEl) {
                    statusEl.textContent = '✗ فشل في المعالجة';
                    statusEl.classList.add('error');
                }
                if (bodyEl) bodyEl.innerHTML = `<div class="error-msg" style="color:#ef4444; padding:6px;">فشلت المعالجة</div>`;
                return null;
            }

            // تحديث حالة مرحلية للمستخدم
            if (statusEl) {
                const elapsed = Math.round((Date.now() - start) / 1000);
                statusEl.textContent = `جاري المعالجة... (${elapsed}s)`;
            }
        } catch (e) {
            console.warn('Polling error:', e);
            // لا نكسر الحلقة؛ ننتظر ثم نكرر
        }

        // انتظر قبل المحاولة التالية
        await new Promise(r => setTimeout(r, POLL_INTERVAL));
    }

    // انتهت المهلة
    if (statusEl) {
        statusEl.textContent = '✗ انتهت المهلة';
        statusEl.classList.add('error');
    }
    if (bodyEl) bodyEl.innerHTML = `<div class="error-msg" style="color:#ef4444; padding:6px;">انتهت مهلة المعالجة</div>`;
    return null;
}

// ==========================================
// 🧩 مساعدة: تأمين النص قبل العرض (escape)
// ==========================================
function escapeHtml(unsafe) {
    return String(unsafe || '')
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// ==========================================
// 🔌 تصدير الدوال للنافذة (للتوافق مع HTML inline أو ملفات أخرى)
// ==========================================
window.startDubbing = startDubbing;
window.waitForJob = waitForJob;

// ==========================================
// 📌 ملاحظات للمطور
// - تأكد أن المتغيرات التالية معرفة في بيئة الصفحة: selectedLangs (Set) و LANGUAGES (Array).
// - تأكد من أن shared.js يحتوي على showToast و updateSidebarAuth و دوال الـ Sidebar.
// - الخادم يجب أن يدعم استقبال FormData في مسار POST /api/tts وإرجاع { job_id }.
// - مسار /api/job/{jobId} يجب أن يعيد JSON يحتوي على status: 'pending'|'completed'|'failed' و audio_url عند الاكتمال.
// ==========================================
