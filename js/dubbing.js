// dubbing.js — V8.5 Cinema Logic

let dubResults = {}; 

async function startDubbing() {
    const file = document.getElementById('mediaFile').files[0];
    const token = localStorage.getItem('token');
    if (!file) return;

    const dubBtn = document.getElementById('dubBtn');
    const progArea = document.getElementById('progArea');
    const resultsCard = document.getElementById('resultsCard');
    const sidebar = document.getElementById('langSidebarList');

    dubBtn.style.display = 'none';
    progArea.style.display = 'block';
    resultsCard.style.display = 'block';
    sidebar.innerHTML = '';
    dubResults = {};

    try {
        // (1) محاكاة الرفع - هنا نضع ملفك الحقيقي
        const langs = [...window.selectedLangs]; // تأكد من وجود مكتبة اختيار اللغات

        langs.forEach(async (langCode) => {
            const lang = window.LANGUAGES.find(l => l.code === langCode);
            
            const item = document.createElement('div');
            item.className = 'lang-card';
            item.id = `card-${langCode}`;
            item.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${lang.name_ar}`;
            sidebar.appendChild(item);

            try {
                // إرسال الطلب للسيرفر الخاص بك
                const res = await fetch(`${window.API_BASE}/api/dub`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        lang: langCode,
                        video_output: document.getElementById('videoToggle').checked
                    })
                });
                
                const data = await res.json();
                const job = await waitForJob(data.job_id, token);

                // حفظ النتيجة
                dubResults[langCode] = { url: job.output_url, name: lang.name_ar, flag: lang.flag };
                
                item.innerHTML = `<span>${lang.flag}</span> <span>${lang.name_ar}</span>`;
                item.onclick = () => updateCinemaPlayer(langCode);

                if (Object.keys(dubResults).length === 1) updateCinemaPlayer(langCode);

            } catch (e) { item.innerHTML = `❌ ${lang.name_ar}`; }
        });

    } catch (e) { console.error(e); }
}

function updateCinemaPlayer(code) {
    const data = dubResults[code];
    const viewer = document.getElementById('playerContent');
    const dlBtn = document.getElementById('masterDlBtn');
    const dlArea = document.getElementById('dlArea');

    // تحديد العنصر النشط في القائمة
    document.querySelectorAll('.lang-card').forEach(c => c.classList.remove('active'));
    document.getElementById(`card-${code}`).classList.add('active');

    // تحديث الفيديو/الصوت
    const isMp4 = data.url.toLowerCase().includes('.mp4');
    if (isMp4) {
        viewer.innerHTML = `<video controls autoplay src="${data.url}" style="width:100%; height:100%;"></video>`;
    } else {
        viewer.innerHTML = `<div id="wsWave" style="width:85%;"></div>`;
        WaveSurfer.create({ container: '#wsWave', waveColor: '#555', progressColor: '#fff', height: 80, url: data.url }).on('ready', function() { this.play(); });
    }

    // إظهار أيقونة التحميل في الزاوية
    dlArea.style.display = 'block';
    dlBtn.href = data.url;
}

// دالة الانتظار
async function waitForJob(id, token) {
    while(true) {
        const r = await fetch(`${window.API_BASE}/api/job/${id}`, { headers: {'Authorization': `Bearer ${token}`} });
        const d = await r.json();
        if (d.status === 'completed') return d;
        await new Promise(res => setTimeout(res, 4000));
    }
}

document.getElementById('dubBtn').onclick = startDubbing;
