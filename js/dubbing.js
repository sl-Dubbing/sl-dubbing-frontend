// ==========================================
// 🎨 ثوابت الألوان والإعدادات
// ==========================================
const API_BASE = 'https://web-production-14a1.up.railway.app';
const COLORS = {
    ACCENT: '#7c3aed',
    GOLD: '#ffb800',
    TEXT: '#e0e0ff',
    PROGRESS: '#34d399',
    DOWNLOAD_BG: '#065f2c',
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
    box.style.cssText = `
        position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%);
        background: ${color}; color: white; padding: 12px 25px; border-radius: 10px;
        z-index: 9999; font-weight: bold; box-shadow: 0 6px 18px rgba(0,0,0,0.3);
    `;
    box.innerText = msg;
    t.appendChild(box);
    setTimeout(() => box.remove(), 4000);
}

// ==========================================
// 🟢 التحكم في القائمة الجانبية (Sidebar)
// ==========================================
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const mainContent = document.getElementById('mainContent');
    
    // التبديل بين الكلاسات
    sidebar.classList.toggle('collapsed');
    mainContent.classList.toggle('expanded');
}

// ==========================================
// 🟢 جلب بيانات المستخدم (المصادقة والرصيد)
// ==========================================
async function checkAuth() {
    const authBox = document.getElementById('authSection');
    const token = localStorage.getItem('token');
    
    if (!token) {
        authBox.innerHTML = `<a href="login.html" style="color:${COLORS.GOLD}; text-decoration:none; font-weight:bold;">تسجيل الدخول</a>`;
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/api/user`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        
        if (data.success) {
            authBox.innerHTML = `
                <div style="font-weight:bold; color:#fff;">${data.user.name}</div>
                <div style="color:${COLORS.GOLD}; font-size:0.9rem; margin-top:5px;">الرصيد: ${data.user.credits} نقطة 💰</div>
                <button onclick="logout()" style="background:none; border:1px solid #f87171; color:#f87171; padding:4px 10px; border-radius:8px; cursor:pointer; font-size:0.8rem; margin-top:8px;">تسجيل خروج</button>
            `;
        } else {
            localStorage.removeItem('token');
            authBox.innerHTML = `<a href="login.html" style="color:${COLORS.GOLD}; text-decoration:none; font-weight:bold;">تسجيل الدخول</a>`;
        }
    } catch (e) {
        console.error("Auth Error:", e);
        authBox.innerHTML = `<div style="color:#ff4444; font-size:0.8rem;">خطأ في الاتصال</div>`;
    }
}

// دالة تسجيل الخروج
function logout() {
    localStorage.removeItem('token');
    location.reload();
}

// ==========================================
// 🟢 تحديث واجهة المستخدم (تغيير النصوص)
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
    console.log("تم اختيار لغة الهدف:", val);
}

// ==========================================
// 🟢 بدء الدبلجة (إرسال البيانات للسيرفر)
// ==========================================
async function startDubbing() {
    const mediaInput = document.getElementById('mediaFile');
    const langSelect = document.getElementById('langSelect');
    const customVoiceInput = document.getElementById('customVoice');
    const token = localStorage.getItem('token');

    // التحققات قبل البدء
    if (!token) return showToast("يرجى تسجيل الدخول أولاً", COLORS.TOAST_WARNING);
    if (!mediaInput || mediaInput.files.length === 0) return showToast("يرجى رفع ملف الفيديو أو الصوت أولاً", COLORS.TOAST_ERROR);

    // تجهيز واجهة التحميل
    const dubBtn = document.getElementById('dubBtn');
    const progressArea = document.getElementById('progressArea');
    const statusTxt = document.getElementById('statusTxt');
    const progFill = document.getElementById('progFill');
    const resCard = document.getElementById('resCard');

    dubBtn.disabled = true;
    progressArea.style.display = 'block';
    resCard.style.display = 'none';
    statusTxt.innerText = "الحالة: جاري رفع الملفات ومعالجتها...";
    progFill.style.width = '30%';

    const fd = new FormData();
    fd.append('media_file', mediaInput.files[0]);
    fd.append('lang', langSelect.value || 'ar');
    
    // إذا تم رفع عينة صوت استنساخ
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
            statusTxt.innerText = "الحالة: تمت الدبلجة بنجاح!";
            showToast("اكتملت المعالجة بنجاح!", COLORS.TOAST_SUCCESS);
            
            // إظهار النتائج
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
// 🟢 تهيئة الأحداث عند تحميل الصفحة
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    // جلب بيانات المستخدم
    checkAuth();

    // ربط زر الدبلجة بالدالة إذا لم يكن مربوطاً في HTML
    const dubBtn = document.getElementById('dubBtn');
    if (dubBtn) {
        dubBtn.addEventListener('click', startDubbing);
    }
});
