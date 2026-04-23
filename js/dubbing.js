// ==========================================
// 🎨 ثوابت الألوان والإعدادات
// ==========================================
const API_BASE = 'web-production-14a1.up.railway.app';
const COLORS = {
    ACCENT: '#7c3aed', GOLD: '#ffb800', TEXT: '#e0e0ff',
    PROGRESS: '#34d399', TOAST_ERROR: '#ef4444', 
    TOAST_SUCCESS: '#10b981', TOAST_WARNING: '#f59e0b'
};

// ==========================================
// 🎙️ جلب العينات تلقائياً من Cloudinary
// ==========================================
async function renderVoices() {
    const select = document.getElementById('voiceSelect');
    if (!select) return;
    
    select.innerHTML = '<option value="original" selected>🎙️ الصوت الأصلي للوسائط (بدون استنساخ)</option>';
    
    try {
        const res = await fetch('https://res.cloudinary.com/dxbmvzsiz/video/list/sl_voice.json');
        if (res.ok) {
            const data = await res.json();
            data.resources.forEach(file => {
                const opt = document.createElement('option');
                opt.value = `https://res.cloudinary.com/dxbmvzsiz/video/upload/v${file.version}/${file.public_id}.${file.format}`;
                let cleanName = file.public_id.split('/').pop().replace(/_/g, ' ');
                opt.textContent = `👤 عينة: ${cleanName}`;
                select.appendChild(opt);
            });
            return;
        }
    } catch (e) {
        console.warn("استخدام القائمة الاحتياطية للعينات.");
    }

    // القائمة الاحتياطية
    const fallbackVoices = [
        { url: 'https://res.cloudinary.com/dxbmvzsiz/video/upload/v1776890116/muhammad_ar.wav', name: 'محمد (عينة ذكورية)' }
    ];
    fallbackVoices.forEach(v => {
        const opt = document.createElement('option');
        opt.value = v.url;
        opt.textContent = `👨 عينة: ${v.name}`;
        select.appendChild(opt);
    });
}

// ==========================================
// 🟢 إظهار التنبيهات والواجهة
// ==========================================
function showToast(msg, color = COLORS.TOAST_ERROR) {
    const t = document.getElementById('toasts');
    if (!t) return;
    const box = document.createElement('div');
    box.className = 'toast';
    box.style.background = color;
    box.innerText = msg;
    t.appendChild(box);
    setTimeout(() => box.remove(), 4000);
}

function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('active');
    document.getElementById('overlay').classList.toggle('active');
}

// ==========================================
// 🟢 المصادقة وجلب الرصيد
// ==========================================
async function updateSidebarAuth() {
    const authSection = document.getElementById('authSection');
    const token = localStorage.getItem('token');
    
    if (!token) {
        authSection.innerHTML = `
            <div class="user-info-card">
                <p style="margin-bottom:15px; font-size:0.95rem; color: #fff;">أهلاً بك في sl-Dubbing</p>
                <a href="login.html" class="btn-login-sidebar">تسجيل الدخول</a>
            </div>`;
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/api/user`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' }
        });

        if (!res.ok) throw new Error('Invalid Response');
        const data = await res.json();
        
        if (data.success || data.user) {
            const userName = data.user?.name || data.user?.username || data.name || 'مستخدم';
            const userCredits = data.user?.credits ?? data.user?.points ?? data.credits ?? 0;

            authSection.innerHTML = `
                <div class="user-info-card">
                    <div class="user-name">${userName}</div>
                    <div class="user-points">رصيدك: ${userCredits} نقطة 💰</div>
                    <button onclick="logout()" style="margin-top:12px; background:none; border:none; color:#ff4444; cursor:pointer; font-size:0.85rem; font-weight:bold;">
                        <i class="fas fa-sign-out-alt"></i> تسجيل الخروج
                    </button>
                </div>`;
        } else {
            throw new Error('Incomplete data');
        }
    } catch (e) {
        localStorage.removeItem('token');
        authSection.innerHTML = `
            <div class="user-info-card">
                <p style="margin-bottom:10px; font-size:0.85rem; color: #ff4444;">انتهت الجلسة</p>
                <a href="login.html" class="btn-login-sidebar">تسجيل الدخول مجدداً</a>
            </div>`;
    }
}

function logout() { localStorage.removeItem('token'); location.reload(); }

// ==========================================
// 🟢 إدارة الملفات المرفوعة
// ==========================================
function updateFileName() {
    const inp = document.getElementById('mediaFile');
    const txt = document.getElementById('fileTxt');
    if (inp.files && inp.files[0]) {
        txt.innerText = "✅ ملف الوسائط: " + inp.files[0].name;
        txt.style.color = COLORS.GOLD;
    }
}

function setVoice(val) {
    const customInput = document.getElementById('customVoice');
    const customTxt = document.getElementById('customVoiceTxt');
    if (val !== 'original' && customInput.files.length > 0) {
        customInput.value = ''; 
        customTxt.innerText = "تم إلغاء المرفق لأنك اخترت عينة جاهزة";
        customTxt.style.color = COLORS.TOAST_WARNING;
    }
}

function handleCustomVoice(input) {
    const txt = document.getElementById('customVoiceTxt');
    const voiceSelect = document.getElementById('voiceSelect');
    if (input.files && input.files[0]) {
        txt.innerText = "✅ عينة خاصة: " + input.files[0].name;
        txt.style.color = COLORS.PROGRESS;
        if (voiceSelect) voiceSelect.value = 'original';
    }
}

function setLang(val) { console.log("Language selected:", val); }

// ==========================================
// 🟢 بدء الدبلجة وشريط التقدم (SSE)
// ==========================================
async function startDubbing() {
    const mediaInput = document.getElementById('mediaFile');
    const langSelect = document.getElementById('langSelect');
    const voiceSelect = document.getElementById('voiceSelect');
    const customVoiceInput = document.getElementById('customVoice');
    const token = localStorage.getItem('token');

    if (!token) return showToast("يرجى تسجيل الدخول أولاً", COLORS.TOAST_WARNING);
    if (!mediaInput || mediaInput.files.length === 0) return showToast("يرجى رفع ملف الفيديو أولاً", COLORS.TOAST_ERROR);

    const dubBtn = document.getElementById('dubBtn');
    const progressArea = document.getElementById('progressArea');
    const statusTxt = document.getElementById('statusTxt');
    const progFill = document.getElementById('progFill');
    const resCard = document.getElementById('resCard');

    dubBtn.disabled = true;
    progressArea.style.display = 'block';
    resCard.style.display = 'none';
    statusTxt.innerText = "الحالة: جاري رفع الملف للسيرفر...";
    progFill.style.width = '20%';

    const fd = new FormData();
    fd.append('media_file', mediaInput.files[0]);
    fd.append('lang', langSelect.value || 'ar');
    
    if (customVoiceInput && customVoiceInput.files.length > 0) {
        fd.append('voice_sample', customVoiceInput.files[0]);
        fd.append('voice_id', 'custom');
    } else if (voiceSelect && voiceSelect.value !== 'original') {
        fd.append('voice_id', voiceSelect.value);
    }

    try {
        const res = await fetch(`${API_BASE}/api/dub`, {
            method: 'POST', body: fd, headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!res.ok) throw new Error(`Server Error: ${res.status}`);
        const data = await res.json();
        
        if (data.success && data.job_id) {
            statusTxt.innerText = "الحالة: جاري معالجة الذكاء الاصطناعي...";
            progFill.style.width = '50%';
            
            // 📡 بدء مراقبة شريط التقدم
            const evtSource = new EventSource(`${API_BASE}/api/progress/${data.job_id}`);
            
            evtSource.onmessage = function(event) {
                const progData = JSON.parse(event.data);
                
                if (progData.status === 'completed') {
                    evtSource.close();
                    progFill.style.width = '100%';
                    statusTxt.innerText = "الحالة: تمت المعالجة بنجاح!";
                    showToast("اكتملت الدبلجة بنجاح!", COLORS.TOAST_SUCCESS);
                    
                    resCard.style.display = 'block';
                    document.getElementById('dubAud').src = progData.audio_url;
                    document.getElementById('dlBtn').href = progData.audio_url;
                    document.getElementById('dubAud').style.display = 'block';
                    dubBtn.disabled = false;
                } else if (progData.status === 'failed') {
                    evtSource.close();
                    showToast("فشلت المعالجة في خادم الذكاء الاصطناعي", COLORS.TOAST_ERROR);
                    statusTxt.innerText = "الحالة: فشلت المعالجة";
                    progFill.style.background = COLORS.TOAST_ERROR;
                    dubBtn.disabled = false;
                }
            };

            evtSource.onerror = function() {
                evtSource.close();
                showToast("انقطع الاتصال بشريط التقدم", COLORS.TOAST_ERROR);
                statusTxt.innerText = "الحالة: انقطع الاتصال بالسيرفر";
                progFill.style.background = COLORS.TOAST_ERROR;
                dubBtn.disabled = false;
            };

        } else {
            throw new Error(data.error || "خطأ أثناء الرفع");
        }
    } catch (e) {
        console.error("Dubbing Error:", e);
        showToast("تعطل الخادم أثناء المعالجة", COLORS.TOAST_ERROR);
        statusTxt.innerText = `الحالة: خطأ داخلي في الخادم`;
        progFill.style.background = COLORS.TOAST_ERROR;
        dubBtn.disabled = false;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    updateSidebarAuth();
    renderVoices(); 
});
