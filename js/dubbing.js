// ==========================================
// 🚀 AI Dubbing Logic & UI Renderer
// ==========================================

let selectedVoiceId = 'source';
let selectedLang = 'ar'; // اللغة الافتراضية
let customVoiceBase64 = ''; 

// 1. قائمة اللغات (التي كانت مفقودة عندك)
const LANGS = [
    {c:'ar', n:'Arabic', f:'🇸🇦'}, {c:'en', n:'English', f:'🇺🇸'},
    {c:'es', n:'Spanish', f:'🇪🇸'}, {c:'fr', n:'French', f:'🇫🇷'},
    {c:'de', n:'German', f:'🇩🇪'}, {c:'it', n:'Italian', f:'🇮🇹'},
    {c:'pt', n:'Portuguese', f:'🇵🇹'}, {c:'tr', n:'Turkish', f:'🇹🇷'},
    {c:'ru', n:'Russian', f:'🇷🇺'}, {c:'hi', n:'Hindi', f:'🇮🇳'},
    {c:'zh', n:'Chinese', f:'🇨🇳'}, {c:'ja', n:'Japanese', f:'🇯🇵'}
];

// 2. دالة رسم اللغات عند تحميل الصفحة
function renderLangs() {
    const grid = document.getElementById('langGrid');
    if (!grid) return;
    
    grid.innerHTML = LANGS.map(l => `
        <div class="item-card ${l.c === selectedLang ? 'active' : ''}" onclick="setLang('${l.c}', this)">
            <div style="font-size:1.8rem; margin-bottom:5px;">${l.f}</div>
            <div style="font-size:0.8rem; font-weight:bold;">${l.n}</div>
        </div>
    `).join('');
}

// دالة اختيار اللغة
function setLang(code, el) { 
    selectedLang = code;
    document.querySelectorAll('#langGrid .item-card').forEach(x => x.classList.remove('active'));
    el.classList.add('active');
}

// 3. معالجة استنساخ الصوت (Voice Clone)
async function handleCustomVoice(input) {
    const file = input.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        customVoiceBase64 = e.target.result.split(',')[1];
        selectedVoiceId = 'custom';
        const txt = document.getElementById('customVoiceTxt');
        if(txt) txt.innerText = "✅ تم تحميل العينة: " + file.name;
        showToast("تم تحميل عينة الصوت بنجاح!", "#1e40af");
    };
    reader.readAsDataURL(file);
}

// 4. بدء عملية الدبلجة
async function startDubbing() {
    const mediaInput = document.getElementById('mediaFile');
    const token = localStorage.getItem('token');

    if (!token) return showToast("يرجى تسجيل الدخول أولاً", "#b91c1c");
    if (!mediaInput.files[0]) return showToast("يرجى اختيار ملف فيديو أو صوت!", "#b91c1c");

    const btn = document.getElementById('dubBtn');
    const progressArea = document.getElementById('progressArea');
    
    btn.disabled = true;
    if(progressArea) progressArea.style.display = 'block';
    
    const fd = new FormData();
    fd.append('media_file', mediaInput.files[0]);
    fd.append('lang', selectedLang);
    fd.append('voice_id', selectedVoiceId);
    
    if (selectedVoiceId === 'custom' && customVoiceBase64) {
        fd.append('sample_b64', customVoiceBase64);
    }

    try {
        const res = await fetch(`${API_BASE}/api/dub`, { 
            method: 'POST', 
            body: fd, 
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const data = await res.json();
        if (data.success) {
            startSSE(data.job_id);
        } else {
            showToast(data.error || "فشلت العملية", "#b91c1c");
            btn.disabled = false;
        }
    } catch(e) {
        showToast("خطأ في الاتصال بالسيرفر", "#b91c1c");
        btn.disabled = false;
    }
}

// 5. متابعة التقدم (SSE)
function startSSE(jobId) {
    const statusTxt = document.getElementById('statusTxt');
    const progFill = document.getElementById('progFill');
    const resCard = document.getElementById('resCard');
    
    const source = new EventSource(`${API_BASE}/api/progress/${jobId}`);
    
    source.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if(statusTxt) statusTxt.innerText = "الحالة: " + data.status;

        if (data.status === 'processing') if(progFill) progFill.style.width = "60%";
        
        if (data.status === 'completed') {
            if(progFill) progFill.style.width = "100%";
            const aud = document.getElementById('dubAud');
            if(aud) { aud.src = data.audio_url; aud.play(); }
            if(resCard) resCard.style.display = 'block';
            
            showToast("تمت الدبلجة بنجاح!", "#065f2c");
            source.close();
            document.getElementById('dubBtn').disabled = false;
        }

        if (data.status === 'failed') {
            showToast("فشلت المعالجة، تم إعادة الرصيد.", "#b91c1c");
            source.close();
            document.getElementById('dubBtn').disabled = false;
        }
    };

    source.onerror = () => source.close();
}

// تشغيل الدوال عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', () => {
    renderLangs(); // رسم اللغات
    // هنا يمكن إضافة loadVoicesFromGitHub() إذا أردتِ
});
