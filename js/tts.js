// tts.js — V3.3 (Smart Polling + Fast Mode Support + Secure Auth)
const SERVER_BASE = 'https://web-production-14a1.up.railway.app';
const SAMPLES_BASE = 'samples';

// =======================
// مساعدة: إعداد fetch مع دعم token أو cookie
// =======================
function makeFetchOptions(method = 'GET', token = null, body = null, isJson = true) {
    const opts = { method };
    if (token) {
        opts.headers = { 'Authorization': `Bearer ${token}` };
        if (isJson) opts.headers['Content-Type'] = 'application/json';
    } else {
        // الاعتماد على HttpOnly cookie
        opts.credentials = 'include';
        if (isJson) opts.headers = { 'Content-Type': 'application/json' };
    }
    if (body !== null) opts.body = body;
    return opts;
}

// =======================
// العينات (samples)
// =======================
async function renderSampleVoices() {
    const select = document.getElementById('voiceSelect');
    if (!select) return;

    select.innerHTML = '<option value="">🎤 اختر عينة جاهزة</option>';

    try {
        const res = await fetch(`${SAMPLES_BASE}/manifest.json?t=${Date.now()}`);
        if (!res.ok) throw new Error('manifest.json not found');
        const data = await res.json();
        const voices = Array.isArray(data.voices) ? data.voices : [];
        voices.forEach(v => {
            const opt = document.createElement('option');
            opt.value = v.id;
            opt.textContent = `${v.icon || '🎤'} ${v.label || v.id}`;
            opt.dataset.file = v.file || `${v.id}.mp3`;
            select.appendChild(opt);
        });
    } catch (e) {
        console.warn('manifest.json failed:', e);
    }
}

function handleCustomVoice(input) {
    const txt = document.getElementById('customVoiceTxt');
    const voiceSelect = document.getElementById('voiceSelect');
    if (input.files && input.files[0]) {
        if (txt) {
            txt.innerText = '✓ تم اختيار: ' + input.files[0].name;
            txt.style.color = '#10b981';
        }
        if (voiceSelect) voiceSelect.value = '';
    }
}

async function fetchSampleAsBase64(fileName) {
    const url = `${SAMPLES_BASE}/${fileName}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('فشل جلب العينة');
    const blob = await res.blob();
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(String(reader.result || '').split(',')[1] || '');
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

async function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(String(reader.result || '').split(',')[1] || '');
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// =======================
// التشغيل الفوري (Fast Mode) 
// =======================
async function instantPlay() {
    const text = document.getElementById('ttsInput')?.value?.trim();
    // الحصول على selectedLangs من shared.js (أو استخدام 'ar' كافتراضي)
    const lang = (window.selectedLangs && window.selectedLangs.size > 0) ? [...window.selectedLangs][0] : 'ar';
    const rate = document.getElementById('rateSelect')?.value || '+0%';
    const pitch = document.getElementById('pitchSelect')?.value || '+0Hz';

    if (!text) {
        if (typeof showToast === 'function') showToast('اكتب النص أولاً', '#ef4444');
        return;
    }

    const btn = document.getElementById('ttsInstantBtn');
    const progArea = document.getElementById('progressArea');
    const resultsCard = document.getElementById('resultsCard');
    const statusTxt = document.getElementById('statusTxt');
    const progFill = document.getElementById('progFill');

    if(btn) btn.disabled = true;
    if(progArea) progArea.style.display = 'block';
    if(resultsCard) resultsCard.style.display = 'none';
    if(statusTxt) statusTxt.innerText = '⚡ التواصل مع الخادم...';
    if(progFill) progFill.style.width = '20%';

    try {
        if (typeof window.quickTTS !== 'function') {
            throw new Error('quickTTS غير محمّل. تأكد من رفع js/tts-quick.js');
        }
        
        const token = localStorage.getItem('token');
        const result = await window.quickTTS(text, { lang, rate, pitch, token });

        if(statusTxt) statusTxt.innerText = '✓ جاري التشغيل';
        if(progFill) progFill.style.width = '100%';

        if (result.audio) {
            result.audio.play().catch(() => {
                if (typeof showToast === 'function') showToast('اضغط ▶️ في المشغّل لسماع الصوت', '#f59e0b');
            });
        }

        const langData = window.LANGUAGES?.find(l => l.code === lang);
        showSingleResult(lang, langData, result.url);

        if (typeof showToast === 'function') showToast(`⚡ تم التوليد بنجاح`, '#10b981');
        
        if(typeof updateSidebarAuth === 'function') updateSidebarAuth();

    } catch (e) {
        console.error('Instant TTS error:', e);
        if (typeof showToast === 'function') showToast(e.message || 'فشل التوليد السريع', '#ef4444');
        if(statusTxt) statusTxt.innerText = '❌ فشل التوليد';
        if(progFill) { progFill.style.background = '#ef4444'; progFill.style.width = '100%'; }
    } finally {
        if(btn) btn.disabled = false;
    }
}

// =======================
// التوليد الذكي المتعدد (Smart/Quality Mode)
// =======================
async function startMultiTTS() {
    const text = document.getElementById('ttsInput')?.value?.trim();
    if (!text) {
        if(typeof showToast === 'function') showToast('يرجى كتابة النص.', '#ef4444');
        return;
    }

    const mode = document.body.getAttribute('data-mode') || 'fast';
    const rate = document.getElementById('rateSelect')?.value || '+0%';
    const pitch = document.getElementById('pitchSelect')?.value || '+0Hz';

    // جمع اللغات
    const targetLangs = (window.selectedLangs && window.selectedLangs.size > 0) ? Array.from(window.selectedLangs) : ['ar'];

    // معالجة البصمة الصوتية (الاستنساخ) إذا كنا في وضع الجودة
    let sampleB64 = '';
    let voiceId = '';

    if (mode === 'quality') {
        const fileInput = document.getElementById('customVoice');
        const selectBox = document.getElementById('voiceSelect');

        if (fileInput && fileInput.files && fileInput.files.length > 0) {
            try {
                sampleB64 = await fileToBase64(fileInput.files[0]);
            } catch (err) {
                if(typeof showToast === 'function') showToast('خطأ في قراءة ملف الصوت المخصص.', '#ef4444');
                return;
            }
        } else if (selectBox && selectBox.value) {
            voiceId = selectBox.value;
            const opt = selectBox.options[selectBox.selectedIndex];
            if (opt && opt.dataset.file) {
                try {
                    sampleB64 = await fetchSampleAsBase64(opt.dataset.file);
                } catch (err) {
                    if(typeof showToast === 'function') showToast('خطأ في جلب العينة الجاهزة.', '#ef4444');
                    return;
                }
            }
        }
    }

    // إعداد الواجهة للمعالجة
    const btn = document.getElementById('ttsBtn');
    const progArea = document.getElementById('progressArea');
    const resultsCard = document.getElementById('resultsCard');
    const statusTxt = document.getElementById('statusTxt');
    const progFill = document.getElementById('progFill');
    const resultsList = document.getElementById('resultsList');

    if(btn) btn.disabled = true;
    if(progArea) progArea.style.display = 'block';
    if(resultsCard) resultsCard.style.display = 'none';
    if(resultsList) resultsList.innerHTML = '';
    if(statusTxt) statusTxt.innerText = `⏳ جاري إرسال الطلبات لـ ${targetLangs.length} لغة...`;
    if(progFill) progFill.style.width = '10%';

    let completedCount = 0;
    const totalJobs = targetLangs.length;
    const token = localStorage.getItem('token');

    for (const lang of targetLangs) {
        try {
            // 1. طلب التوليد (بناء المهمة في السيرفر)
            const payload = {
                text: text,
                lang: lang,
                mode: mode,
                rate: rate,
                pitch: pitch,
                sample_b64: sampleB64,
                voice_id: voiceId,
                translate: true
            };

            const opts = makeFetchOptions('POST', token, JSON.stringify(payload), true);
            const res = await fetch(`${SERVER_BASE}/api/tts/smart`, opts);
            
            if (res.status === 401 || res.status === 403) {
                throw new Error("غير مصرح. يرجى تسجيل الدخول.");
            }
            if (res.status === 402) {
                throw new Error("الرصيد غير كافٍ. يرجى الترقية.");
            }

            const data = await res.json();
            if (!res.ok || !data.success) {
                throw new Error(data.error || 'خطأ في التوليد');
            }

            const jobId = data.job_id;
            if(statusTxt) statusTxt.innerText = `⏳ يتم معالجة اللغة (${lang})...`;

            // 2. الفحص المستمر (Polling) لحين انتهاء المهمة
            await pollJob(jobId, lang);
            completedCount++;
            
            // تحديث شريط التقدم
            if(progFill) progFill.style.width = `${10 + ((completedCount / totalJobs) * 90)}%`;

        } catch (error) {
            console.error(`خطأ في توليد ${lang}:`, error);
            showSingleError(lang, error.message);
        }
    }

    if(statusTxt) statusTxt.innerText = '✅ اكتملت العملية';
    if(progFill) progFill.style.width = '100%';
    if(btn) btn.disabled = false;
    
    // تحديث الرصيد بعد الانتهاء
    if(typeof updateSidebarAuth === 'function') updateSidebarAuth();
}

// =======================
// نظام الفحص (Polling) 
// =======================
async function pollJob(jobId, langCode) {
    const token = localStorage.getItem('token');
    const langData = window.LANGUAGES?.find(l => l.code === langCode);
    let attempts = 0;
    const maxAttempts = 60; // دقيقتان كحد أقصى (إذا كان الفحص كل ثانيتين)

    while (attempts < maxAttempts) {
        await new Promise(r => setTimeout(r, 2000)); // انتظار ثانيتين
        attempts++;

        try {
            const opts = makeFetchOptions('GET', token, null, true);
            const res = await fetch(`${SERVER_BASE}/api/job/${jobId}`, opts);
            if (!res.ok) continue;

            const data = await res.json();
            
            if (data.status === 'completed') {
                showSingleResult(langCode, langData, data.output_url, data.extra_data);
                return true;
            } else if (data.status === 'failed') {
                showSingleError(langCode, data.error || 'فشلت المهمة في الخادم');
                return false;
            }
        } catch (e) {
            console.warn(`Polling error for job ${jobId}:`, e);
        }
    }
    
    showSingleError(langCode, 'انتهى وقت الانتظار (Timeout)');
    return false;
}

// =======================
// عرض النتائج في الواجهة
// =======================
function showSingleResult(langCode, langData, audioUrl, translatedText = "") {
    const resultsCard = document.getElementById('resultsCard');
    const resultsList = document.getElementById('resultsList');
    
    if(resultsCard) resultsCard.style.display = 'block';

    const item = document.createElement('div');
    item.className = 'lang-item';
    
    const title = langData ? `${langData.flag} ${langData.name}` : langCode;
    const translationHtml = translatedText ? `<div style="font-size:0.85rem; color:#6b7280; margin-bottom:8px; padding:5px; background:#f9fafb; border-radius:6px;"><b>الترجمة:</b> ${translatedText}</div>` : '';

    item.innerHTML = `
        <div class="lang-info">
            <div class="lang-title">${title}</div>
            <div style="font-size:0.75rem; color:#10b981; margin-top:2px;">
                <i class="fas fa-check-circle"></i> نجاح
            </div>
        </div>
        <div style="width: 100%; display:flex; flex-direction:column; gap:10px;">
            ${translationHtml}
            <div style="display:flex; gap:10px; align-items:center;">
                <audio controls src="${audioUrl}" style="height:36px; flex-grow:1;"></audio>
                <a href="${audioUrl}" download="tts_${langCode}.mp3" class="btn-secondary" style="padding:8px; display:flex; align-items:center; justify-content:center;">
                    <i class="fas fa-download"></i>
                </a>
            </div>
        </div>
    `;
    if(resultsList) resultsList.appendChild(item);
}

function showSingleError(langCode, errorMessage) {
    const resultsCard = document.getElementById('resultsCard');
    const resultsList = document.getElementById('resultsList');
    
    if(resultsCard) resultsCard.style.display = 'block';

    const item = document.createElement('div');
    item.className = 'lang-item';
    item.style.borderLeft = '4px solid #ef4444';

    item.innerHTML = `
        <div class="lang-info">
            <div class="lang-title">${langCode}</div>
            <div style="font-size:0.75rem; color:#ef4444; margin-top:2px;">
                <i class="fas fa-exclamation-triangle"></i> فشل
            </div>
        </div>
        <div style="font-size:0.85rem; color:#ef4444; background:#fee2e2; padding:8px; border-radius:6px; flex-grow:1;">
            ${errorMessage}
        </div>
    `;
    if(resultsList) resultsList.appendChild(item);
}

// =======================
// تهيئة الأزرار عند التحميل
// =======================
document.addEventListener('DOMContentLoaded', () => {
    // تحميل العينات
    renderSampleVoices();

    // ربط رفع العينة
    const uploadBtn = document.getElementById('uploadVoiceBtn');
    const customInput = document.getElementById('customVoice');
    if (uploadBtn && customInput) {
        uploadBtn.addEventListener('click', () => customInput.click());
        customInput.addEventListener('change', function() {
            handleCustomVoice(this);
        });
    }

    // ربط أزرار التوليد
    const instantBtn = document.getElementById('ttsInstantBtn');
    if (instantBtn) instantBtn.addEventListener('click', instantPlay);

    const startBtn = document.getElementById('ttsBtn');
    if (startBtn) startBtn.addEventListener('click', startMultiTTS);

    // ربط مبدل الجودة (Fast vs Quality)
    const modeBtns = document.querySelectorAll('.mode-option');
    modeBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            modeBtns.forEach(b => b.classList.remove('active'));
            const target = e.currentTarget;
            target.classList.add('active');
            document.body.setAttribute('data-mode', target.dataset.mode);
        });
    });

    // ربط القائمة المتقدمة
    const advToggle = document.getElementById('advancedToggleBtn');
    const advOps = document.getElementById('advancedOptions');
    if (advToggle && advOps) {
        advToggle.addEventListener('click', () => {
            advOps.classList.toggle('show');
            const isShow = advOps.classList.contains('show');
            advToggle.innerHTML = isShow ? '<i class="fas fa-times"></i> إخفاء الخيارات' : '<i class="fas fa-sliders-h"></i> خيارات متقدمة';
        });
    }

    // عداد الحروف
    const ttsInput = document.getElementById('ttsInput');
    const charCount = document.getElementById('charCount');
    if (ttsInput && charCount) {
        ttsInput.addEventListener('input', () => {
            charCount.textContent = ttsInput.value.length;
        });
    }
});
