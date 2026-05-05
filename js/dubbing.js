// dubbing.js — V9.5 (Cinema Master + Integrated Identity)

window.selectedLangs = new Set(); 
let cinemaResults = {};

// =====================================
// 1. التهيئة عند تحميل الصفحة
// =====================================
document.addEventListener('DOMContentLoaded', () => {
    const langList = document.getElementById('langList');
    
    // رسم قائمة اللغات
    if (langList && window.LANGUAGES) {
        langList.innerHTML = ''; 
        window.LANGUAGES.forEach(lang => {
            const item = document.createElement('div');
            item.className = 'lang-item-ui'; 
            item.style = 'display: flex; align-items: center; gap: 10px; margin-bottom: 5px;';
            
            item.innerHTML = `
                <input type="checkbox" id="lang_${lang.code}" value="${lang.code}" style="cursor: pointer; width: 16px; height: 16px; accent-color: #10b981;">
                <label for="lang_${lang.code}" style="cursor: pointer; flex: 1; display: flex; gap: 10px; align-items: center;">
                    <span style="font-size: 1.2rem;">${lang.flag}</span> 
                    <span style="font-weight: 500;">${lang.name_ar}</span>
                </label>
            `;
            
            // تتبع الاختيار
            item.querySelector('input').addEventListener('change', (e) => {
                if(e.target.checked) window.selectedLangs.add(lang.code);
                else window.selectedLangs.delete(lang.code);
            });
            langList.appendChild(item);
        });
    }

    // ربط زر الدبلجة
    document.getElementById('dubBtn')?.addEventListener('click', startDubbing);
});

// إغلاق قائمة اللغات المنسدلة عند الضغط في أي مكان آخر
window.onclick = function(event) {
    if (!event.target.closest('.drop-btn')) {
        document.querySelectorAll('.drop-btn').forEach(d => d.classList.remove('active'));
    }
};

// =====================================
// 2. معاينة الوسائط المرفوعة (Preview)
// =====================================
document.getElementById('mediaFile')?.addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;

    const url = URL.createObjectURL(file);
    const dropZone = document.getElementById('dropZone');
    const previewArea = document.getElementById('previewArea');
    const dubBtn = document.getElementById('dubBtn');
    const vPreview = document.getElementById('videoPreview');
    const aPreview = document.getElementById('audioPreviewLabel');

    if(dropZone) dropZone.style.display = 'none';
    if(previewArea) previewArea.style.display = 'block';
    if(dubBtn) dubBtn.style.display = 'block';

    if (file.type.startsWith('video/')) {
        if(vPreview) { vPreview.src = url; vPreview.style.display = 'block'; }
        if(aPreview) aPreview.style.display = 'none';
    } else {
        if(vPreview) vPreview.style.display = 'none';
        if(aPreview) {
            aPreview.style.display = 'block';
            document.getElementById('audioFileName').innerText = file.name;
        }
    }
});

// =====================================
// 3. منطق الدبلجة ومشغل السينما
// =====================================
async function startDubbing() {
    const file = document.getElementById('mediaFile')?.files[0];
    const token = localStorage.getItem('token');
    
    if (!token && typeof showToast === 'function') return showToast("يرجى تسجيل الدخول أولاً", "warning");
    if (!file) return alert("يرجى اختيار ملف الوسائط!");
    if (window.selectedLangs.size === 0) return alert("يرجى اختيار لغة واحدة على الأقل!");

    const dubBtn = document.getElementById('dubBtn');
    const resultsCard = document.getElementById('resultsCard');
    const sidebar = document.getElementById('cinemaLangs');
    const processingTxt = document.getElementById('processingTxt');

    if(dubBtn) dubBtn.style.display = 'none';
    if(resultsCard) resultsCard.style.display = 'block';
    if(sidebar) sidebar.innerHTML = '';
    if(processingTxt) processingTxt.innerText = "جاري رفع ومعالجة الطلبات...";
    
    cinemaResults = {};
    const langs = [...window.selectedLangs];

    // محاكاة الحصول على رابط الرفع (نفس منطقك الأصلي)
    let fileKey = "temp_key_" + Date.now();

    langs.forEach(async (langCode) => {
        const lang = window.LANGUAGES.find(l => l.code === langCode);
        if(!lang) return;

        // إنشاء بطاقة الانتظار في القائمة الجانبية للمشغل
        const item = document.createElement('div');
        item.className = 'side-lang-card';
        item.id = `cinema-${langCode}`;
        item.innerHTML = `<i class="fas fa-spinner fa-spin"></i> <span>${lang.name_ar}</span>`;
        sidebar.appendChild(item);

        try {
            // إرسال الطلب
            const res = await fetch(`${window.API_BASE}/api/dub`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    file_key: fileKey,
                    lang: langCode,
                    with_lipsync: document.getElementById('lipsyncToggle')?.checked || false,
                    return_video: document.getElementById('videoToggle')?.checked || false
                })
            });
            
            const data = await res.json();
            if (!data.success) throw new Error(data.error);

            // انتظار المهمة
            const job = await waitForJob(data.job_id, token);

            // حفظ النتيجة وتحديث بطاقة اللغة
            cinemaResults[langCode] = { url: job.output_url, name: lang.name_ar, flag: lang.flag };
            
            item.innerHTML = `<span>${lang.flag}</span> <span>${lang.name_ar}</span> <i class="fas fa-check-circle" style="color:#10b981; margin-right:auto;"></i>`;
            item.onclick = () => switchCinemaLang(langCode);

            // عرض الفيديو تلقائياً فور اكتمال أول لغة
            if (Object.keys(cinemaResults).length === 1) {
                switchCinemaLang(langCode);
            }

        } catch (e) { 
            item.innerHTML = `❌ <span>${lang.name_ar}</span>`; 
            console.error(`خطأ في الدبلجة للغة ${langCode}:`, e);
        }
    });
}

function switchCinemaLang(langCode) {
    const data = cinemaResults[langCode];
    if(!data) return;

    const player = document.getElementById('mainPlayer');
    const dlBtn = document.getElementById('masterDl');
    const dlArea = document.getElementById('dlArea');

    // تمييز العنصر النشط في القائمة
    document.querySelectorAll('.side-lang-card').forEach(c => c.classList.remove('active'));
    const activeCard = document.getElementById(`cinema-${langCode}`);
    if(activeCard) activeCard.classList.add('active');

    // تشغيل النتيجة بناءً على نوع الملف
    const isMp4 = data.url.toLowerCase().includes('.mp4');
    if (isMp4) {
        player.innerHTML = `<video controls autoplay src="${data.url}" style="width:100%; height:100%; object-fit: contain;"></video>`;
    } else {
        player.innerHTML = `<div style="width:85%; display:flex; flex-direction:column; align-items:center;"><div id="wsWave" style="width:100%;"></div><p style="color:#888; margin-top:15px; font-weight:bold;">${data.flag} ${data.name}</p></div>`;
        WaveSurfer.create({ container: '#wsWave', waveColor: '#555', progressColor: '#fff', height: 80, url: data.url }).on('ready', function() { this.play(); });
    }

    // إظهار وتحديث زر التحميل
    if(dlArea) dlArea.style.display = 'block';
    if(dlBtn) dlBtn.href = data.url;
}

// =====================================
// 4. دالة الاستعلام (Polling) للمهمة
// =====================================
async function waitForJob(id, token) {
    while(true) {
        const r = await fetch(`${window.API_BASE}/api/job/${id}`, { headers: {'Authorization': `Bearer ${token}`} });
        const d = await r.json();
        if (d.status === 'completed') return d;
        if (d.status === 'failed') throw new Error(d.error || "فشل السيرفر في المعالجة");
        await new Promise(res => setTimeout(res, 4000));
    }
}
