// dubbing.js — V6.0 (Direct Upload + Parallel Multi-Lang + LipSync + Custom Voice)

async function startDubbing() {
    const file = document.getElementById('mediaFile')?.files?.[0];
    const voiceSelect = document.getElementById('voiceSelect');
    
    // التحديث 1: ربط العناصر الجديدة بالواجهة
    const customVoiceInput = document.getElementById('customVoiceInput');
    const lipsyncToggle = document.getElementById('lipsyncToggle');
    const token = localStorage.getItem('token');

    // 1. التحقق من المدخلات الأساسية
    if (!token) return showToast('يرجى تسجيل الدخول أولاً', '#f59e0b');
    if (!file) return showToast('يرجى اختيار ملف فيديو أو صوت', '#ef4444');
    if (!window.selectedLangs || window.selectedLangs.size === 0)
        return showToast('يرجى اختيار لغة واحدة على الأقل', '#ef4444');

    const dubBtn = document.getElementById('dubBtn');
    const progressArea = document.getElementById('progressArea');
    const resultsCard = document.getElementById('resultsCard');
    const resultsList = document.getElementById('resultsList');
    const statusTxt = document.getElementById('statusTxt');
    const progFill = document.getElementById('progFill');

    // تجهيز الواجهة للبدء
    dubBtn.style.display = 'none'; // إخفاء الزر أثناء المعالجة كالتصميم الجديد
    progressArea.style.display = 'block';
    resultsCard.style.display = 'block';
    resultsList.innerHTML = '';
    progFill.style.width = '5%';
    statusTxt.innerText = '⚡ جاري تجهيز الرابط الآمن...';

    try {
        // ============================================
        // 🚀 الخطوة 1: طلب رابط رفع مباشر (Presigned URL)
        // ============================================
        const urlRes = await fetch(`${window.API_BASE}/api/upload-url`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                filename: file.name,
                content_type: file.type || 'video/mp4',
                size: file.size
            })
        });

        const urlData = await urlRes.json();
        if (!urlRes.ok || !urlData.success) {
            throw new Error(urlData.error || 'فشل الحصول على رابط الرفع');
        }

        const { upload_url, file_key } = urlData;
        progFill.style.width = '10%';
        statusTxt.innerText = `📤 جاري الرفع المباشر (${(file.size/1024/1024).toFixed(1)}MB)...`;

        // ============================================
        // 🚀 الخطوة 2: الرفع المباشر إلى Cloudflare R2
        // ============================================
        await uploadToR2(upload_url, file, (pct) => {
            progFill.style.width = (10 + pct * 0.5) + '%';
            statusTxt.innerText = `📤 اكتمل الرفع بنسبة ${pct.toFixed(0)}%...`;
        }, file.type);

        progFill.style.width = '60%';
        statusTxt.innerText = '✅ اكتمل الرفع، يبدأ الآن سحر الذكاء الاصطناعي...';

        // ============================================
        // 🚀 الخطوة 3: إرسال طلبات الدبلجة بالتوازي
        // ============================================
        const langs = [...window.selectedLangs];
        const total = langs.length;
        let completed = 0;

        // إنشاء بطاقات النتائج في الواجهة مسبقاً
        langs.forEach(code => {
            const lang = window.LANGUAGES?.find(l => l.code === code);
            if (!lang) return;
            const card = document.createElement('div');
            card.className = 'result-item';
            card.id = `result-${code}`;
            card.innerHTML = `
                <div class="result-item-header">
                    <span class="result-item-flag">${lang.flag}</span>
                    <span class="result-item-name">${lang.name_ar}</span>
                    <span class="result-item-status" id="status-${code}">في الانتظار</span>
                </div>
                <div id="body-${code}" style="font-size:0.85rem;color:#9aa1ac;padding:6px;">⏳ جاري إرسال الطلب...</div>
            `;
            resultsList.appendChild(card);
        });

        // التحديث 2: تحضير بيانات الصوت المخصص وقراءة زر LipSync
        let sample_b64 = '';
        let voice_id_val = 'source'; // افتراضياً يستنسخ الصوت الأصلي

        if (voiceSelect?.value === 'custom' && customVoiceInput?.files?.[0]) {
            // إذا اختار عينة مخصصة ورفعها
            sample_b64 = await fileToBase64(customVoiceInput.files[0]);
            voice_id_val = 'source'; // السيرفر يقرأ العينة ويستنسخها
        } else if (voiceSelect?.value && voiceSelect.value !== 'source' && voiceSelect.value !== 'custom') {
            // إذا اختار صوت جاهز (ذكر أو أنثى)
            voice_id_val = voiceSelect.value;
        }

        const isLipSyncEnabled = lipsyncToggle ? lipsyncToggle.checked : false;

        // تشغيل الطلبات لكل اللغات في نفس الوقت
        const promises = langs.map(async (langCode) => {
            const lang = window.LANGUAGES?.find(l => l.code === langCode);
            const statusEl = document.getElementById(`status-${langCode}`);
            const bodyEl = document.getElementById(`body-${langCode}`);

            try {
                statusEl.textContent = 'جاري الإرسال...';

                const res = await fetch(`${window.API_BASE}/api/dub`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        file_key: file_key,
                        filename: file.name,
                        lang: langCode,
                        voice_id: voice_id_val,
                        sample_b64: sample_b64,
                        with_lipsync: isLipSyncEnabled, // التحديث 3: إرسال حالة زر مزامنة الشفاه
                        engine: 'auto'
                    })
                });

                const data = await res.json().catch(() => ({}));
                if (!res.ok || !data.success) throw new Error(data.error || `Error ${res.status}`);

                statusEl.textContent = 'جاري المعالجة...';
                bodyEl.innerHTML = '<div style="font-size:0.85rem;color:#2563eb;padding:6px;">🎬 جاري العمل على الملف...</div>';

                // الانتظار حتى اكتمال المهمة (Polling)
                const finalData = await waitForJob(data.job_id, token, statusEl);

                statusEl.textContent = '✓ اكتمل';
                statusEl.classList.add('success');
                
                // تحديد ما إذا كان الناتج فيديو أو صوت
                const isVideo = finalData.output_url.toLowerCase().endsWith('.mp4');
                const mediaElement = isVideo 
                    ? `<video controls src="${finalData.output_url}" style="width:100%; border-radius:8px; margin-top:8px;"></video>`
                    : `<audio controls src="${finalData.output_url}" style="width:100%; height:35px; margin-top:8px;"></audio>`;

                bodyEl.innerHTML = `
                    ${mediaElement}
                    <a href="${finalData.output_url}" download="dub_${langCode}" class="btn-download" style="margin-top:8px; display:inline-block;">
                        <i class="fas fa-download"></i> تحميل ملف الـ ${lang.name_ar}
                    </a>
                `;
            } catch (e) {
                console.error(`Lang ${langCode} failed:`, e);
                statusEl.textContent = '✗ فشل';
                statusEl.classList.add('error');
                bodyEl.innerHTML = `<div style="color:#ef4444;font-size:0.85rem;padding:6px;">${e.message}</div>`;
            } finally {
                completed++;
                const pct = 60 + Math.round((completed / total) * 40);
                progFill.style.width = pct + '%';
                statusTxt.innerText = `تمت معالجة ${completed} من أصل ${total} لغة`;
            }
        });

        await Promise.all(promises);

        progFill.style.width = '100%';
        statusTxt.innerText = `✓ اكتملت المعالجة لـ ${total} لغة بنجاح!`;
        showToast(`تمت المعالجة بنجاح! يمكنك العثور على الملفات في "ملفاتي"`, '#10b981');
        
        // تحديث الرصيد في الواجهة
        if (typeof checkAuth === 'function') checkAuth();

    } catch (e) {
        console.error('Dubbing error:', e);
        showToast(e.message || 'حدث خطأ أثناء المعالجة', '#ef4444');
        statusTxt.innerText = '✗ فشل العملية: ' + e.message;
        progFill.style.background = '#ef4444';
    } finally {
        dubBtn.style.display = 'block'; // إعادة إظهار الزر
        dubBtn.disabled = false;
    }
}

/**
 * دالة رفع الملف مباشرة إلى R2 باستخدام Presigned URL
 */
function uploadToR2(presignedUrl, file, onProgress, contentType) {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('PUT', presignedUrl, true);
        xhr.setRequestHeader('Content-Type', contentType || 'application/octet-stream');

        xhr.upload.onprogress = (e) => {
            if (e.lengthComputable && onProgress) {
                onProgress((e.loaded / e.total) * 100);
            }
        };

        xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) resolve();
            else reject(new Error(`فشل الرفع (${xhr.status})`));
        };

        xhr.onerror = () => reject(new Error('خطأ في الشبكة أثناء الرفع'));
        xhr.ontimeout = () => reject(new Error('انتهت مهلة الرفع'));

        xhr.timeout = 60 * 60 * 1000; // مهلة ساعة واحدة للملفات الكبيرة
        xhr.send(file);
    });
}

/**
 * دالة مراقبة حالة المهمة حتى تكتمل
 */
async function waitForJob(jobId, token, statusEl) {
    const start = Date.now();
    const TIMEOUT = 30 * 60 * 1000; // مهلة 30 دقيقة

    while (Date.now() - start < TIMEOUT) {
        try {
            const res = await fetch(`${window.API_BASE}/api/job/${jobId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            
            if (data.status === 'completed') return data;
            if (data.status === 'failed') throw new Error(data.error || 'فشلت معالجة الملف');
            
            // تحديث عداد الثواني للمستخدم
            if (statusEl) statusEl.textContent = `جاري المعالجة (${Math.round((Date.now()-start)/1000)}ث)`;
            
        } catch (e) {
            if (e.message.includes('فشلت')) throw e;
            console.warn('Polling status...', e);
        }
        await new Promise(r => setTimeout(r, 3000)); // فحص كل 3 ثوانٍ
    }
    throw new Error('انتهت مهلة الانتظار');
}

/**
 * تحويل الملف إلى Base64 لإرسال عينات الصوت المخصصة
 */
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onloadend = () => resolve(String(r.result).split(',')[1] || '');
        r.onerror = reject;
        r.readAsDataURL(file);
    });
}

// ربط الزر بالدالة عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', () => {
    const dubBtn = document.getElementById('dubBtn');
    if (dubBtn) {
        dubBtn.addEventListener('click', startDubbing);
    }
});

// تصدير الدوال للنافذة العالمية
window.startDubbing = startDubbing;
