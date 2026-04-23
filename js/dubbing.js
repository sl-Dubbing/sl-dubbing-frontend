// ==========================================
// 🎨 ثوابت الألوان والإعدادات
// ==========================================
const API_BASE = 'https://web-production-14a1.up.railway.app';
const COLORS = {
    ACCENT: '#7c3aed',
    GOLD: '#ffb800',
    TEXT: '#e0e0ff',
    PROGRESS: '#34d399',
    TOAST_ERROR: '#ef4444',
    TOAST_SUCCESS: '#10b981',
    TOAST_WARNING: '#f59e0b'
};

// ==========================================
// 🟢 إظهار التنبيهات (Toasts)
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

// ==========================================
// 🟢 التحكم في القائمة الجانبية (Sidebar)
// ==========================================
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('overlay');
    
    sidebar.classList.toggle('active');
    overlay.classList.toggle('active');
}

// ==========================================
// 🟢 جلب بيانات المستخدم (المصادقة والرصيد المطور)
// ==========================================
async function updateSidebarAuth() {
    const authSection = document.getElementById('authSection');
    const token = localStorage.getItem('token');
    
    // إذا لم يكن هناك توكن
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
            headers: { 
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/json'
            }
        });

        if (!res.ok) throw new Error('الاستجابة غير صالحة من السيرفر');

        const data = await res.json();
        
        // التحقق الذكي من البيانات (يدعم عدة مسميات محتملة من السيرفر)
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
                </div>
            `;
        } else {
            throw new Error('البيانات غير مكتملة');
        }
    } catch (e) {
        console.error("Auth Error:", e);
        localStorage.removeItem('token'); // مسح التوكن التالف
        authSection.innerHTML = `
            <div class="user-info-card">
                <p style="margin-bottom:10px; font-size:0.85rem; color: #ff4444;">انتهت الجلسة أو حدث خطأ</p>
                <a href="login.html" class="btn-login-sidebar">تسجيل الدخول مجدداً</a>
            </div>`;
    }
}

function logout() {
    localStorage.removeItem('token');
    location.reload();
}

// ==========================================
// 🟢 تحديث نصوص الملفات المرفوعة
// ==========================================
function updateFileName() {
    const inp = document.getElementById('mediaFile');
    const txt = document.getElementById('fileTxt');
    if (inp.files && inp.files[0]) {
        txt.innerText = "✅ الملف: " + inp.files[0].name;
        txt.style.color = COLORS.GOLD;
    }
}

function handleCustomVoice(input) {
    const txt = document.getElementById('customVoiceTxt');
    if (input.files && input.files[0]) {
        txt.innerText = "✅ عينة الصوت: " + input.files[0].name;
        txt.style.color = COLORS.PROGRESS;
    }
}

function setLang(val) {
    console.log("تم اختيار اللغة:", val);
}

// ==========================================
// 🟢 بدء الدبلجة (إرسال البيانات للسيرفر)
// ==========================================
async function startDubbing() {
    const mediaInput = document.getElementById('mediaFile');
    const langSelect = document.getElementById('langSelect');
    const customVoiceInput = document.getElementById('customVoice');
    const token = localStorage.getItem('token');

    if (!token) return showToast("يرجى تسجيل الدخول أولاً", COLORS.TOAST_WARNING);
    if (!mediaInput || mediaInput.files.length === 0) return showToast("يرجى رفع ملف الفيديو أو الصوت أولاً", COLORS.TOAST_ERROR);

    const dubBtn = document.getElementById('dubBtn');
    const progressArea = document.getElementById('progressArea');
    const statusTxt = document.getElementById('statusTxt');
    const progFill = document.getElementById('progFill');
    const resCard = document.getElementById('resCard');

    dubBtn.disabled = true;
    progressArea.style.display = 'block';
    resCard.style.display = 'none';
    statusTxt.innerText = "الحالة: جاري رفع الملفات...";
    progFill.style.width = '30%';

    const fd = new FormData();
    fd.append('media_file', mediaInput.files[0]);
    fd.append('lang', langSelect.value || 'ar');
    
    if (customVoiceInput && customVoiceInput.files.length > 0) {
        fd.append('voice_sample', customVoiceInput.files[0]);
        fd.append('voice_id', 'custom');
    }

    try {
        const res = await fetch(`${API_BASE}/api/dub`, {
            method: 'POST',
            body: fd,
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        const data = await res.json();
        
        if (data.success) {
            progFill.style.width = '100%';
            statusTxt.innerText = "الحالة: تمت المعالجة بنجاح!";
            showToast("اكتملت الدبلجة بنجاح!", COLORS.TOAST_SUCCESS);
            
            resCard.style.display = 'block';
            const dubAud = document.getElementById('dubAud');
            const dubVid = document.getElementById('dubVid');
            const dlBtn = document.getElementById('dlBtn');

            if (data.audio_url) {
                dubAud.src = data.audio_url;
                dlBtn.href = data.audio_url;
                dubAud.style.display = 'block';
            }
        } else {
            showToast(data.error || "حدث خطأ أثناء المعالجة", COLORS.TOAST_ERROR);
            statusTxt.innerText = "الحالة: فشلت المعالجة";
            progFill.style.background = COLORS.TOAST_ERROR;
        }
    } catch (e) {
        console.error("Dubbing Error:", e);
        showToast("خطأ في الاتصال بالسيرفر", COLORS.TOAST_ERROR);
        statusTxt.innerText = "الحالة: خطأ في الاتصال";
        progFill.style.background = COLORS.TOAST_ERROR;
    } finally {
        dubBtn.disabled = false;
    }
}

// ==========================================
// 🟢 تهيئة الأحداث عند التحميل
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    updateSidebarAuth();
});
