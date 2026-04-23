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
// 🎙️ جلب العينات تلقائياً من Cloudinary
// ==========================================
async function renderVoices() {
    const select = document.getElementById('voiceSelect');
    if (!select) return;
    
    // الخيار الافتراضي الثابت
    select.innerHTML = '<option value="original" selected>🎙️ الصوت الأصلي للوسائط (بدون استنساخ)</option>';
    
    try {
        // 💡 السطر السحري: يجلب كل الملفات التي تحمل التاج "sl_voice" من كلاوديناري
        // ملاحظة: كلاوديناري يعتبر ملفات الصوت (video) في بنيته التحتية
        const res = await fetch('https://res.cloudinary.com/dxbmvzsiz/video/list/sl_voice.json');
        
        if (res.ok) {
            const data = await res.json();
            
            // إضافة كل ملف يعود من كلاوديناري إلى القائمة المنسدلة
            data.resources.forEach(file => {
                const opt = document.createElement('option');
                // بناء الرابط المباشر للعينة ليتم إرساله للسيرفر الخاص بك
                opt.value = `https://res.cloudinary.com/dxbmvzsiz/video/upload/v${file.version}/${file.public_id}.${file.format}`;
                
                // تنظيف اسم الملف ليكون جميلاً للعميل (إزالة العلامات السفلية)
                let cleanName = file.public_id.split('/').pop().replace(/_/g, ' ');
                opt.textContent = `👤 عينة: ${cleanName}`;
                
                select.appendChild(opt);
            });
            return; // نجح الجلب التلقائي، نخرج من الدالة
        }
    } catch (e) {
        console.warn("لم نتمكن من جلب العينات من كلاوديناري تلقائياً، سيتم استخدام الاحتياطية.");
    }

    // 🛡️ القائمة الاحتياطية (في حال لم تقومي بإعداد Cloudinary بعد)
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
// 🟢 جلب بيانات المستخدم (المصادقة والرصيد)
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

        if (!res.ok) throw new Error('الاستجابة غير صالحة');
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
            throw new Error('بيانات غير مكتملة');
        }
    } catch (e) {
        console.error("Auth Error:", e);
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
// 🟢 تحديث الواجهة عند اختيار الملفات
// ==========================================
function updateFileName() {
    const inp = document.getElementById('mediaFile');
    const txt = document.getElementById('fileTxt');
    if (inp.files && inp.files[0]) {
        txt.innerText = "✅ ملف الوسائط: " + inp.files[0].name;
        txt.style.color = COLORS.GOLD;
    }
}

// إذا اختار العميل صوتاً جاهزاً، نفرغ العينة المرفوعة لمنع التضارب
function setVoice(val) {
    const customInput = document.getElementById('customVoice');
    const customTxt = document.getElementById('customVoiceTxt');
    
    if (val !== 'original' && customInput.files.length > 0) {
        customInput.value = ''; 
        customTxt.innerText = "تم إلغاء المرفق لأنك اخترت عينة جاهزة";
        customTxt.style.color = COLORS.TOAST_WARNING;
    }
}

// إذا رفع العميل ملفاً، نعيد القائمة للوضع "الأصلي"
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
// 🟢 بدء الدبلجة (إرسال البيانات للسيرفر)
// ==========================================
async function startDubbing() {
    const mediaInput = document.getElementById('mediaFile');
    const langSelect = document.getElementById('langSelect');
    const voiceSelect = document.getElementById('voiceSelect');
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
    statusTxt.innerText = "الحالة: جاري رفع الملفات ومعالجتها...";
    progFill.style.width = '30%';

    const fd = new FormData();
    fd.append('media_file', mediaInput.files[0]);
    fd.append('lang', langSelect.value || 'ar');
    
    // 💡 الإصلاح هنا: 
    // 1. إذا رفع عينة، نرسلها.
    // 2. إذا اختار صوتاً جاهزاً (ليس original)، نرسل رابطه.
    // 3. إذا اختار "original"، لا نرسل حقل voice_id أبداً لكي لا يتعطل السيرفر.
    if (customVoiceInput && customVoiceInput.files.length > 0) {
        fd.append('voice_sample', customVoiceInput.files[0]);
        fd.append('voice_id', 'custom');
    } else if (voiceSelect && voiceSelect.value !== 'original') {
        fd.append('voice_id', voiceSelect.value);
    }

    try {
        const res = await fetch(`${API_BASE}/api/dub`, {
            method: 'POST',
            body: fd,
            headers: { 
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/json'
            }
        });
        
        // التحقق مما إذا كان السيرفر أرجع خطأ 500 قبل محاولة قراءة الـ JSON
        if (!res.ok) {
            throw new Error(`Server Error: ${res.status}`);
        }

        const data = await res.json();
        
        if (data.success) {
            progFill.style.width = '100%';
            statusTxt.innerText = "الحالة: تمت المعالجة بنجاح!";
            showToast("اكتملت الدبلجة بنجاح!", COLORS.TOAST_SUCCESS);
            
            resCard.style.display = 'block';
            const dubAud = document.getElementById('dubAud');
            const dlBtn = document.getElementById('dlBtn');

            if (data.audio_url) {
                dubAud.src = data.audio_url;
                dlBtn.href = data.audio_url;
                dubAud.style.display = 'block';
            }
        } else {
            showToast(data.error || "حدث خطأ أثناء المعالجة", COLORS.TOAST_ERROR);
            statusTxt.innerText = `الحالة: ${data.error || 'فشلت المعالجة'}`;
            progFill.style.background = COLORS.TOAST_ERROR;
        }
    } catch (e) {
        console.error("Dubbing Error:", e);
        showToast("تعطل الخادم أثناء المعالجة (الرجاء التحقق من Railway)", COLORS.TOAST_ERROR);
        statusTxt.innerText = "الحالة: خطأ داخلي في الخادم (500)";
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
    renderVoices(); // 👈 استدعاء الدالة لجلب الأصوات من كلاوديناري
});
