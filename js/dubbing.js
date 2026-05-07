// js/dubbing.js — V10.5 (Final Fix: Removed Trailing Slash & Fixed CORS)

let cinemaResults = {};

// =====================================
// 1. معاينة الوسائط المرفوعة (Preview)
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
// 2. دالة الرفع المباشر إلى Cloudflare R2
// =====================================
function uploadToR2(url, file, onProgress) {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('PUT', url, true);
        xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
        xhr.upload.onprogress = (e) => {
            if (e.lengthComputable && onProgress) {
                onProgress((e.loaded / e.total) * 100);
            }
        };
        xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) resolve();
            else reject(new Error('فشل الرفع'));
        };
        xhr.onerror = () => reject(new Error('خطأ في الشبكة أثناء الرفع'));
        xhr.send(file);
    });
}

// =====================================
// 3. منطق الدبلجة ومشغل السينما
// =====================================
async function startDubbing() {
    const file = document.getElementById('mediaFile')?.files[0];
    const token = localStorage.getItem('token');
    
    if (!token && typeof showToast === 'function') return showToast("يرجى تسجيل الدخول أولاً", "warning");
    if (!file) return alert("يرجى اختيار ملف الوسائط!");
    if (!window.selectedLangs || window.selectedLangs.size === 0) return alert("يرجى اختيار لغة واحدة على الأقل!");

    const dubBtn = document.getElementById('dubBtn');
    const resultsCard = document.getElementById('resultsCard');
    const sidebar = document.getElementById('cinemaLangs');
    const progressArea = document.getElementById('progressArea');
    const progFill = document.getElementById('progFill');
    const statusTxt = document.getElementById('statusTxt');
    const statusPct = document.getElementById('statusPct');

    if(dubBtn) dubBtn.style.display = 'none';
    if(progressArea) progressArea.style.display = 'block';
    if(resultsCard) resultsCard.style.display = 'block';
    if(sidebar) sidebar.innerHTML = '';
    
    cinemaResults = {};
    const langs = [...window.selectedLangs];

    try {
        statusTxt.innerText = "⚡ جاري تجهيز السيرفر...";
        progFill.style.width = "5%";
        statusPct.innerText = "5%";

        const urlRes = await fetch(`${window.API_BASE}/api/upload-url`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename: file.name, content_type: file.type, size: file.size })
        });
        const urlData = await urlRes.json();
        if (!urlRes.ok) throw new Error(urlData.error || "فشل الحصول على رابط الرفع");

        const { upload_url, file_key } = urlData;

        statusTxt.innerText = "📤 جاري رفع الملف...";
        await uploadToR2(upload_url, file, (pct) => {
            const overallProgress = 5 + (pct * 0.45); 
            progFill.style.width = `${overallProgress}%`;
            statusPct.innerText = `${Math.round(overallProgress)}%`;
        });

        statusTxt.innerText = "✅ اكتمل الرفع، تبدأ الآن المعالجة...";
        progFill.style.width = "50%";
        statusPct.innerText = "50%";

        let completedJobs = 0;

        langs.forEach(async (langCode) => {
            const lang = window.LANGUAGES.find(l => l.code === langCode);
            if(!lang) return;

            const item = document.createElement('div');
            item.className = 'side-lang-card';
            item.id = `cinema-${langCode}`;
            item.innerHTML = `<i class="fas fa-spinner fa-spin"></i> <span>${lang.name_ar}</span>`;
            sidebar.appendChild(item);

            try {
                const res = await fetch(`${window.API_BASE}/api/dub`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        file_key: file_key,
                        lang: langCode,
                        with_lipsync: document.getElementById('lipsyncToggle')?.checked || false,
                        return_video: document.getElementById('videoToggle')?.checked || false
                    })
                });
                
                const data = await res.json();
                if (!data.success) throw new Error(data.error);

                // استدعاء دالة الانتظار المعدلة (بدون الشرطة المائلة)
                const job = await waitForJob(data.job_id, token);

                cinemaResults[langCode] = { url: job.output_url, name: lang.name_ar, flag: lang.flag };
                
                item.innerHTML = `<span>${lang.flag}</span> <span>${lang.name_ar}</span> <i class="fas fa-check-circle" style="color:#10b981; margin-right:auto;"></i>`;
                item.onclick = () => switchCinemaLang(langCode);

                if (Object.keys(cinemaResults).length === 1) {
                    switchCinemaLang(langCode);
                }

            } catch (e) { 
                item.innerHTML = `❌ <span>${lang.name_ar}</span>`; 
                console.error(`Error processing ${langCode}:`, e);
            } finally {
                completedJobs++;
                const finalProgress = 50 + ((completedJobs / langs.length) * 50);
                progFill.style.width = `${finalProgress}%`;
                statusPct.innerText = `${Math.round(finalProgress)}%`;
                
                if (completedJobs === langs.length) {
                    statusTxt.innerText = "✓ اكتملت المعالجة لجميع اللغات بنجاح!";
                    if (typeof checkAuth === 'function') checkAuth();
                }
            }
        });

    } catch (e) {
        statusTxt.innerText = `❌ خطأ: ${e.message}`;
        progFill.style.background = "#ef4444";
        if(dubBtn) dubBtn.style.display = 'block';
    }
}

function switchCinemaLang(langCode) {
    const data = cinemaResults[langCode];
    if(!data) return;

    const player = document.getElementById('mainPlayer');
    const dlBtn = document.getElementById('masterDl');
    const dlArea = document.getElementById('dlArea');

    document.querySelectorAll('.side-lang-card').forEach(c => c.classList.remove('active'));
    const activeCard = document.getElementById(`cinema-${langCode}`);
    if(activeCard) activeCard.classList.add('active');

    const isMp4 = data.url.toLowerCase().includes('.mp4');
    if (isMp4) {
        player.innerHTML = `<video controls autoplay src="${data.url}" style="width:100%; height:100%; object-fit: contain;"></video>`;
    } else {
        player.innerHTML = `<div style="width:85%; display:flex; flex-direction:column; align-items:center;"><div id="wsWave" style="width:100%;"></div><p style="color:#888; margin-top:15px; font-weight:bold;">${data.flag} ${data.name}</p></div>`;
        WaveSurfer.create({ container: '#wsWave', waveColor: '#555', progressColor: '#fff', height: 80, url: data.url }).on('ready', function() { this.play(); });
    }

    if(dlArea) dlArea.style.display = 'block';
    if(dlBtn) dlBtn.href = data.url;
}

// =========================================================
// 🚀 الدالة النهائية: بدون شرطة مائلة لتجنب أخطاء CORS
// =========================================================
async function waitForJob(id, token) {
    while(true) {
        // تم إزالة الشرطة المائلة / من نهاية الرابط هنا:
        const r = await fetch(`${window.API_BASE}/api/job/${id}`, { 
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            } 
        });

        // التقاط الأخطاء بوضوح
        if (r.status === 401) {
            throw new Error("فشل التصريح (401): يرجى تسجيل الخروج والدخول مجدداً.");
        }
        if (!r.ok) {
             throw new Error(`خطأ من السيرفر: ${r.status}`);
        }

        const d = await r.json();
        if (d.status === 'completed') return d;
        if (d.status === 'failed') throw new Error(d.error || "فشل السيرفر في المعالجة");
        
        await new Promise(res => setTimeout(res, 4000));
    }
}

document.getElementById('dubBtn')?.addEventListener('click', startDubbing);

window.onclick = function(event) {
    if (!event.target.closest('.drop-btn')) {
        document.querySelectorAll('.drop-btn').forEach(d => d.classList.remove('active'));
    }
};
