// dubbing.js — V9.0 (متوافق 100% مع الهوية الأصلية للموقع)

// --- 1. تهيئة اللغات عند تحميل الصفحة ---
window.selectedLangs = new Set(); 

document.addEventListener('DOMContentLoaded', () => {
    const langList = document.getElementById('langList');
    
    // قراءة بيانات اللغات من languages-data.js ورسمها داخل القائمة
    if (langList && window.LANGUAGES) {
        langList.innerHTML = ''; 
        window.LANGUAGES.forEach(lang => {
            const item = document.createElement('div');
            item.className = 'lang-item-ui'; 
            item.style = 'display: flex; align-items: center; gap: 10px; margin-bottom: 5px; cursor: pointer; padding: 10px; border-radius: 8px; color: #000;';
            
            // عند المرور بالماوس (Hover) باستخدام الجافاسكريبت البسيط لضمان التنسيق الأبيض/الأسود
            item.onmouseover = () => item.style.backgroundColor = "#f3f4f6";
            item.onmouseout = () => item.style.backgroundColor = "transparent";

            item.innerHTML = `
                <input type="checkbox" id="lang_${lang.code}" value="${lang.code}" style="cursor: pointer; width: 16px; height: 16px; accent-color: #10b981;">
                <label for="lang_${lang.code}" style="cursor: pointer; flex: 1; display: flex; gap: 10px; align-items: center;">
                    <span style="font-size: 1.2rem;">${lang.flag}</span> 
                    <span style="font-weight: bold;">${lang.name_ar}</span>
                </label>
            `;
            
            // حفظ اللغات المحددة
            item.querySelector('input').addEventListener('change', (e) => {
                e.target.checked ? window.selectedLangs.add(lang.code) : window.selectedLangs.delete(lang.code);
            });
            langList.appendChild(item);
        });
    }
});

// --- 2. إدارة معاينة الملف المرفوع (Preview) ---
document.getElementById('mediaFile')?.addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (file) {
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
    }
});

// --- 3. منطق الدبلجة ومشغل السينما ---
let cinemaResults = {};

async function startDubbing() {
    const file = document.getElementById('mediaFile')?.files[0];
    const token = localStorage.getItem('token');
    
    if (!file) return alert("يرجى اختيار ملف الوسائط أولاً!");
    if (window.selectedLangs.size === 0) return alert("يرجى اختيار لغة واحدة على الأقل من القائمة!");

    const dubBtn = document.getElementById('dubBtn');
    const resultsCard = document.getElementById('resultsCard');
    const sidebar = document.getElementById('cinemaLangs');

    if(dubBtn) dubBtn.style.display = 'none';
    if(resultsCard) resultsCard.style.display = 'block';
    if(sidebar) sidebar.innerHTML = '';
    cinemaResults = {};

    const langs = [...window.selectedLangs];

    langs.forEach(async (langCode) => {
        const lang = window.LANGUAGES.find(l => l.code === langCode);
        if(!lang) return;

        const item = document.createElement('div');
        item.className = 'side-lang-card';
        item.id = `cinema-${langCode}`;
        item.innerHTML = `<i class="fas fa-spinner fa-spin"></i> <span>${lang.name_ar}</span>`;
        sidebar.appendChild(item);

        try {
            // إرسال الطلب للسيرفر الخاص بك
            const res = await fetch(`${window.API_BASE}/api/dub`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    lang: langCode,
                    video_output: document.getElementById('videoToggle')?.checked
                })
            });
            
            const data = await res.json();
            const job = await waitForJob(data.job_id, token);

            // حفظ النتيجة وتحديث القائمة الجانبية للمشغل
            cinemaResults[langCode] = { url: job.output_url, name: lang.name_ar, flag: lang.flag };
            
            item.innerHTML = `<span>${lang.flag}</span> <span>${lang.name_ar}</span> <i class="fas fa-check-circle" style="color:#10b981; margin-right:auto;"></i>`;
            item.onclick = () => switchCinemaLang(langCode);

            // عرض الفيديو تلقائياً لأول لغة تكتمل
            if (Object.keys(cinemaResults).length === 1) switchCinemaLang(langCode);

        } catch (e) { 
            item.innerHTML = `❌ <span>${lang.name_ar}</span>`; 
        }
    });
}

function switchCinemaLang(langCode) {
    const data = cinemaResults[langCode];
    if(!data) return;

    const player = document.getElementById('mainPlayer');
    const dlBtn = document.getElementById('masterDl');
    const dlArea = document.getElementById('dlArea');

    // تمييز العنصر النشط
    document.querySelectorAll('.side-lang-card').forEach(c => c.classList.remove('active'));
    const activeCard = document.getElementById(`cinema-${langCode}`);
    if(activeCard) activeCard.classList.add('active');

    const isMp4 = data.url.toLowerCase().includes('.mp4');
    if (isMp4) {
        player.innerHTML = `<video controls autoplay src="${data.url}" style="width:100%; height:100%;"></video>`;
    } else {
        player.innerHTML = `<div id="wsWave" style="width:85%;"></div>`;
        WaveSurfer.create({ container: '#wsWave', waveColor: '#555', progressColor: '#fff', height: 80, url: data.url }).on('ready', function() { this.play(); });
    }

    if(dlArea) dlArea.style.display = 'block';
    if(dlBtn) dlBtn.href = data.url;
}

// دالة الانتظار للتحقق من انتهاء المهمة في السيرفر
async function waitForJob(id, token) {
    while(true) {
        const r = await fetch(`${window.API_BASE}/api/job/${id}`, { headers: {'Authorization': `Bearer ${token}`} });
        const d = await r.json();
        if (d.status === 'completed') return d;
        await new Promise(res => setTimeout(res, 4000));
    }
}

// ربط زر الدبلجة
document.getElementById('dubBtn')?.addEventListener('click', startDubbing);

// إغلاق القائمة المنسدلة للغات عند الضغط خارجها
window.onclick = function(event) {
    if (!event.target.closest('.drop-btn')) {
        document.querySelectorAll('.drop-btn').forEach(d => d.classList.remove('active'));
    }
};
