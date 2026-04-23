// ==========================================
// 🚀 AI Dubbing Logic & UI Renderer
// ==========================================

let selectedVoiceId = 'source';
let selectedLang = ''; // سيتحدد عند اختيار المستخدم من القائمة
let customVoiceBase64 = ''; 

// 1. قائمة اللغات المدعومة
const LANGS = [
    {c:'ar', n:'Arabic', f:'🇸🇦'}, {c:'en', n:'English', f:'🇺🇸'},
    {c:'es', n:'Spanish', f:'🇪🇸'}, {c:'fr', n:'French', f:'🇫🇷'},
    {c:'de', n:'German', f:'🇩🇪'}, {c:'it', n:'Italian', f:'🇮🇹'},
    {c:'pt', n:'Portuguese', f:'🇵🇹'}, {c:'tr', n:'Turkish', f:'🇹🇷'},
    {c:'ru', n:'Russian', f:'🇷🇺'}, {c:'hi', n:'Hindi', f:'🇮🇳'},
    {c:'zh', n:'Chinese', f:'🇨🇳'}, {c:'ja', n:'Japanese', f:'🇯🇵'}
];

// 2. دالة رسم اللغات داخل القائمة المنسدلة (Dropdown)
function renderLangs() {
    const select = document.getElementById('langSelect');
    if (!select) return;

    // إضافة الخيارات من مصفوفة اللغات
    LANGS.forEach(l => {
        const option = document.createElement('option');
        option.value = l.c;
        option.textContent = `${l.f} ${l.n}`;
        select.appendChild(option);
    });
}

// 3. دالة التحكم في إخفاء وإظهار القائمة الجانبية (Sidebar Toggle)
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const mainContent = document.getElementById('mainContent');
    
    if (sidebar && mainContent) {
        sidebar.classList.toggle('collapsed');
        mainContent.classList.toggle('expanded');
    }
}

// 4. دالة اختيار اللغة من القائمة
function setLang(code) {
    selectedLang = code;
    console.log("اللغة المختارة:", selectedLang);
}

// 5. معالجة استنساخ الصوت (Voice Clone)
async function handleCustomVoice(input) {
    const file = input.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        // تحويل الملف لـ Base64
        customVoiceBase64 = e.target.result.split(',')[1];
        selectedVoiceId = 'custom';
        
        const txt = document.getElementById('customVoiceTxt');
        if(txt) txt.innerText = "✅ تم تحميل العينة: " + file.name;
        
        showToast("تم رفع عينة الصوت للاستنساخ", "#1e40af");
    };
    reader.readAsDataURL(file);
}

// 6. الدالة الأساسية لبدء عملية الدبلجة
async function startDubbing() {
    const mediaInput = document.getElementById('mediaFile');
    const token = localStorage.getItem('token');

    // التحقق من المدخلات
    if (!token) return showToast("يرجى تسجيل الدخول أولاً", "#b91c1c");
    if (!mediaInput.files[0]) return showToast("يرجى اختيار ملف فيديو أو صوت أولاً!", "#b91c1c");
    if (!selectedLang) return showToast("يرجى اختيار لغة الهدف!", "#b91c1c");

    const btn = document.getElementById('dubBtn');
    const progressArea = document.getElementById('progressArea');
    
    // تحضير الواجهة للانتظار
    btn.disabled = true;
    if(progressArea) progressArea.style.display = 'block';
    
    // إنشاء بيانات النموذج
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
            showToast("بدأت المعالجة، يرجى الانتظار...", "#7c3aed");
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

// 7. متابعة التقدم عبر الـ SSE (Server-Sent Events)
function startSSE(jobId) {
    const statusTxt = document.getElementById('statusTxt');
    const progFill = document.getElementById('progFill');
    const resCard = document.getElementById('resCard');
    
    const source = new EventSource(`${API_BASE}/api/progress/${jobId}`);
    
    source.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if(statusTxt) statusTxt.innerText = "الحالة: " + data.status;

        // تحديث شريط التقدم
        if (data.status === 'processing') {
            if(progFill) progFill.style.width = "60%";
        }
        
        if (data.status === 'completed') {
            if(progFill) progFill.style.width = "100%";
            
            // إظهار النتيجة (فيديو أو صوت)
            const aud = document.getElementById('dubAud');
            const vid = document.getElementById('dubVid');
            const dlBtn = document.getElementById('dlBtn');

            if(data.audio_url) {
                // إذا كان فيديو، سنظهره في عنصر الفيديو، وإذا كان صوت في عنصر الصوت
                const isVideo = data.audio_url.endsWith('.mp4');
                if(isVideo && vid) {
                    vid.src = data.audio_url;
                    vid.style.display = 'block';
                    if(aud) aud.style.display = 'none';
                } else if(aud) {
                    aud.src = data.audio_url;
                    aud.style.display = 'block';
                    if(vid) vid.style.display = 'none';
                }
                if(dlBtn) dlBtn.href = data.audio_url;
            }

            if(resCard) resCard.style.display = 'block';
            
            showToast("اكتملت الدبلجة بنجاح!", "#065f2c");
            source.close();
            document.getElementById('dubBtn').disabled = false;
        }

        if (data.status === 'failed') {
            showToast("فشلت المعالجة، تم إعادة الرصيد لحسابك.", "#b91c1c");
            source.close();
            document.getElementById('dubBtn').disabled = false;
        }
    };

    source.onerror = () => {
        source.close();
        document.getElementById('dubBtn').disabled = false;
    };
}

// 8. تشغيل الدوال عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', () => {
    renderLangs(); // تعبئة القائمة المنسدلة
    
    // تحديث اسم الملف عند اختياره من الجهاز
    const mediaInput = document.getElementById('mediaFile');
    if(mediaInput) {
        mediaInput.onchange = function() {
            const txt = document.getElementById('fileTxt');
            if(txt && this.files[0]) txt.innerText = "الملف المختار: " + this.files[0].name;
        };
    }
});
