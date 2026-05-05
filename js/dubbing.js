// dubbing.js — V8.5 (Cinema Master)

let dubbingResults = {}; 

async function startDubbing() {
    const file = document.getElementById('mediaFile')?.files?.[0];
    const token = localStorage.getItem('token');
    
    if (!file) return alert("يرجى اختيار ملف");

    const dubBtn = document.getElementById('dubBtn');
    const resultsCard = document.getElementById('resultsCard');
    const sidebar = document.getElementById('langSidebarList');

    dubBtn.style.display = 'none';
    resultsCard.style.display = 'block';
    sidebar.innerHTML = ''; 
    dubbingResults = {};

    try {
        // محاكاة الرفع والحصول على الروابط (نفس منطقك السابق)
        const fileKey = "temporary_key_" + Date.now(); 
        const langs = [...window.selectedLangs];

        langs.forEach(async (langCode) => {
            const lang = window.LANGUAGES.find(l => l.code === langCode);
            
            // عنصر القائمة الجانبية (قيد المعالجة)
            const sideItem = document.createElement('div');
            sideItem.id = `side-${langCode}`;
            sideItem.className = 'lang-item';
            sideItem.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${lang.name_ar}`;
            sidebar.appendChild(sideItem);

            try {
                // إرسال الطلب للسيرفر
                const res = await fetch(`${window.API_BASE}/api/dub`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        file_key: fileKey,
                        lang: langCode,
                        return_video: document.getElementById('videoToggle').checked
                    })
                });
                
                const data = await res.json();
                const final = await waitForJob(data.job_id, token);

                // تخزين النتيجة وتفعيل الضغط
                dubbingResults[langCode] = { url: final.output_url, name: lang.name_ar };
                
                sideItem.innerHTML = `<span>${lang.flag}</span> <span>${lang.name_ar}</span>`;
                sideItem.onclick = () => switchCinemaLanguage(langCode);

                // عرض أول لغة تكتمل تلقائياً
                if (Object.keys(dubbingResults).length === 1) switchCinemaLanguage(langCode);

            } catch (err) {
                sideItem.innerHTML = `❌ ${lang.name_ar}`;
            }
        });

    } catch (e) { console.error(e); }
}

function switchCinemaLanguage(langCode) {
    const res = dubbingResults[langCode];
    const wrapper = document.getElementById('mainMediaWrapper');
    const dlArea = document.getElementById('downloadArea');
    const dlBtn = document.getElementById('masterDownloadBtn');

    // تمييز اللغة النشطة
    document.querySelectorAll('.lang-item').forEach(el => el.classList.remove('active'));
    document.getElementById(`side-${langCode}`).classList.add('active');

    // تحديث المشغل (فيديو أو صوت)
    const isMp4 = res.url.toLowerCase().includes('.mp4');
    if (isMp4) {
        wrapper.innerHTML = `<video controls autoplay src="${res.url}" style="width:100%; height:100%;"></video>`;
    } else {
        wrapper.innerHTML = `<div id="cinemaWave" style="width:80%;"></div>`;
        WaveSurfer.create({ container: '#cinemaWave', waveColor: '#555', progressColor: '#fff', height: 80, url: res.url }).on('ready', function() { this.play(); });
    }

    // إظهار زر التحميل في الزاوية
    dlArea.style.display = 'block';
    dlBtn.href = res.url;
}

// دالة فتح القوائم المنسدلة
function toggleDrop(id) {
    const el = document.getElementById(id);
    const wasActive = el.classList.contains('active');
    document.querySelectorAll('.icon-btn').forEach(b => b.classList.remove('active'));
    if (!wasActive) el.classList.add('active');
}

// دالة انتظار المهمة (Poling)
async function waitForJob(id, token) {
    while(true) {
        const r = await fetch(`${window.API_BASE}/api/job/${id}`, { headers: {'Authorization': `Bearer ${token}`} });
        const d = await r.json();
        if (d.status === 'completed') return d;
        await new Promise(res => setTimeout(res, 4000));
    }
}
