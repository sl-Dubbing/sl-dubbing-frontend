```javascript
// js/dubbing.js (ألوان معدّلة ومركزّة في أعلى الملف)
// نسخة مُحسّنة: استبدلت كل ألوان النصوص والتنبيهات بثوابت لونية في الأعلى
// ملاحظة: لا تغيّر ترتيب تحميل هذا الملف — يجب أن يُحمّل بعد DOM أو مع defer.

const API_BASE = 'https://web-production-14a1.up.railway.app';
const FETCH_TIMEOUT_MS = 10000; // مهلة الشبكة بالمللي ثانية

// -----------------------------
// 🟢 ثوابت الألوان (عدل هنا لتغيير الألوان في كل الملف)
// -----------------------------
const COLORS = {
    ACCENT: '#7c3aed',         // اللون الرئيسي
    ACCENT_2: '#2563eb',       // لون ثانوي للتدرجات
    GOLD: '#ffb800',           // لون التمييز
    TEXT: '#e0e0ff',           // لون النص العام
    MUTED_TEXT: '#9ca3af',     // نص ثانوي
    PROGRESS: '#34d399',       // تعبئة شريط التقدم
    DOWNLOAD_BG: '#065f2c',    // زر التحميل
    TOAST_ERROR: '#ef4444',    // تنبيه خطأ
    TOAST_WARNING: '#f59e0b',  // تحذير / انتهاء صلاحية
    TOAST_INFO: '#f97316',     // معلومات عامة
    TOAST_SUCCESS: '#10b981'   // نجاح
};

// -----------------------------
// 🟢 مساعدة: fetch مع مهلة
// -----------------------------
async function fetchWithTimeout(url, opts = {}, timeout = FETCH_TIMEOUT_MS) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    opts.signal = controller.signal;
    try {
        const res = await fetch(url, opts);
        clearTimeout(id);
        return res;
    } catch (err) {
        clearTimeout(id);
        throw err;
    }
}

// -----------------------------
// 🟢 إظهار التنبيهات (toast)
// -----------------------------
function showToast(msg, color = COLORS.TOAST_ERROR) {
    const t = document.getElementById('toasts');
    if (!t) return;
    const box = document.createElement('div');
    box.className = 'toast';
    box.style.cssText = `
        position: fixed;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: ${color};
        color: white;
        padding: 12px 25px;
        border-radius: 10px;
        z-index: 9999;
        font-weight: bold;
        box-shadow: 0 6px 18px rgba(0,0,0,0.35);
        max-width: calc(100% - 40px);
        text-align: center;
    `;
    box.innerText = msg;
    t.appendChild(box);
    setTimeout(() => {
        try { box.remove(); } catch (e) {}
    }, 4000);
}

// -----------------------------
// 🟢 إدارة المصادقة (Token Based)
// -----------------------------
async function checkAuth() {
    const authSection = document.getElementById('authSection');
    const token = localStorage.getItem('token');

    if (!authSection) return;

    // حالة عدم وجود توكن
    if (!token) {
        authSection.innerHTML = `<a href="login.html" style="color:${COLORS.GOLD}; text-decoration:none; font-weight:bold; display:block; text-align:center;">تسجيل الدخول</a>`;
        return;
    }

    try {
        const r = await fetchWithTimeout(`${API_BASE}/api/user`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' }
        });

        // فشل الشبكة أو CORS سيؤدي إلى رمي استثناء قبل الوصول إلى هنا
        if (!r.ok) {
            // حالات شائعة: 401 (غير مصرح)، 403، 500
            if (r.status === 401 || r.status === 403) {
                localStorage.removeItem('token');
                showToast('انتهت صلاحية الجلسة. الرجاء تسجيل الدخول مجدداً.', COLORS.TOAST_WARNING);
                authSection.innerHTML = `<a href="login.html" style="color:${COLORS.GOLD}; text-decoration:none; font-weight:bold; display:block; text-align:center;">تسجيل الدخول</a>`;
                return;
            }
            // عرض رسالة عامة مع رمز الحالة
            showToast(`خطأ في المصادقة: ${r.status}`, COLORS.TOAST_INFO);
            return;
        }

        const d = await r.json().catch(() => null);
        if (!d) {
            showToast('استجابة الخادم غير صالحة.', '#f43f5e');
            return;
        }

        if (d.success) {
            authSection.innerHTML = `
                <div style="text-align:center; background:rgba(255,255,255,0.03); padding:10px; border-radius:12px;">
                    <div style="font-weight:bold; color:${COLORS.TEXT}">${escapeHtml(d.user.name || 'مستخدم')}</div>
                    <div style="color:${COLORS.GOLD}; font-size:0.85rem; margin:5px 0;">الرصيد: ${Number(d.user.credits || 0)} 💰</div>
                    <button id="logoutBtn" style="background:none; border:1px solid #f87171; color:#f87171; padding:4px 10px; border-radius:8px; cursor:pointer; font-size:0.8rem;">خروج</button>
                </div>`;
            const lb = document.getElementById('logoutBtn');
            if (lb) lb.addEventListener('click', () => { logout(); });
        } else {
            localStorage.removeItem('token');
            showToast('فشل التحقق من المستخدم. الرجاء تسجيل الدخول.', COLORS.TOAST_INFO);
            authSection.innerHTML = `<a href="login.html" style="color:${COLORS.GOLD}; text-decoration:none; font-weight:bold; display:block; text-align:center;">تسجيل الدخول</a>`;
        }
    } catch (e) {
        // قد يكون سبب الخطأ: CORS، انقطاع الشبكة، مهلة، أو خطأ في الخادم
        console.error("Auth check failed", e);
        showToast('فشل الاتصال بالخادم. تحقق من إعدادات CORS أو حالة الخادم.', COLORS.TOAST_ERROR);
    }
}

// -----------------------------
// 🟢 دوال مساعدة صغيرة
// -----------------------------
function logout() {
    localStorage.removeItem('token');
    location.reload();
}
window.logout = logout;

function escapeHtml(unsafe) {
    return String(unsafe)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// -----------------------------
// 🟢 واجهة المستخدم: ملفات وحقول
// -----------------------------
function updateFileName() {
    const inp = document.getElementById('mediaFile');
    const txt = document.getElementById('fileTxt');
    if (!inp || !txt) return;
    if (inp.files && inp.files.length > 0) {
        txt.innerText = inp.files[0].name;
    } else {
        txt.innerText = 'لم يتم اختيار ملف بعد';
    }
}

function setLang(val) {
    const sel = document.getElementById('langSelect');
    if (sel) sel.value = val;
}

function handleCustomVoice(input) {
    const txt = document.getElementById('customVoiceTxt');
    if (!input || !txt) return;
    if (input.files && input.files.length > 0) {
        txt.innerText = input.files[0].name;
    } else {
        txt.innerText = '';
    }
}

// -----------------------------
// 🟢 زر الدبلجة: تنفيذ رفع الملف واستدعاء API
// -----------------------------
async function startDubbing() {
    const mediaInput = document.getElementById('mediaFile');
    const langSelect = document.getElementById('langSelect');
    const sampleInput = document.getElementById('customVoice');

    if (!mediaInput || !mediaInput.files || mediaInput.files.length === 0) {
        showToast('اختر ملف وسائط أولاً.', COLORS.TOAST_INFO);
        return;
    }

    const token = localStorage.getItem('token');
    if (!token) {
        showToast('الرجاء تسجيل الدخول قبل البدء.', COLORS.TOAST_WARNING);
        return;
    }

    const file = mediaInput.files[0];
    const lang = (langSelect && langSelect.value) ? langSelect.value : 'ar';

    // عرض واجهة التقدم
    const progressArea = document.getElementById('progressArea');
    const statusTxt = document.getElementById('statusTxt');
    const progFill = document.getElementById('progFill');
    if (progressArea) progressArea.style.display = 'block';
    if (statusTxt) statusTxt.innerText = 'الحالة: جاري رفع الملف...';
    if (progFill) progFill.style.width = '10%';

    try {
        const form = new FormData();
        form.append('media', file);
        form.append('lang', lang);

        // إضافة عينة الصوت إن وُجدت
        if (sampleInput && sampleInput.files && sampleInput.files.length > 0) {
            form.append('sample', sampleInput.files[0]);
        }

        const res = await fetchWithTimeout(`${API_BASE}/api/dub`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: form
        }, 120000); // مهلة أطول للرفع والمعالجة

        if (!res.ok) {
            if (res.status === 401) {
                showToast('غير مصرح. الرجاء تسجيل الدخول مجدداً.', COLORS.TOAST_WARNING);
                localStorage.removeItem('token');
                checkAuth();
                return;
            }
            const txt = await res.text().catch(() => null);
            showToast(`فشل الطلب: ${res.status}`, COLORS.TOAST_ERROR);
            console.error('Dubbing failed:', res.status, txt);
            if (statusTxt) statusTxt.innerText = `الحالة: فشل (${res.status})`;
            return;
        }

        // استجابة ناجحة
        const data = await res.json().catch(() => null);
        if (!data) {
            showToast('استجابة الخادم غير صالحة.', COLORS.TOAST_ERROR);
            if (statusTxt) statusTxt.innerText = 'الحالة: استجابة غير صالحة';
            return;
        }

        // تحديث الواجهة بالنتيجة
        if (statusTxt) statusTxt.innerText = 'الحالة: اكتملت المعالجة';
        if (progFill) progFill.style.width = '100%';

        const resCard = document.getElementById('resCard');
        const dubAud = document.getElementById('dubAud');
        const dubVid = document.getElementById('dubVid');
        const dlBtn = document.getElementById('dlBtn');

        if (resCard) resCard.style.display = 'block';
        if (dubAud && data.audio_url) {
            dubAud.src = data.audio_url;
            dubAud.style.display = 'block';
        }
        if (dubVid && data.video_url) {
            dubVid.src = data.video_url;
            dubVid.style.display = 'block';
        } else if (dubVid) {
            dubVid.style.display = 'none';
        }
        if (dlBtn && data.audio_url) {
            dlBtn.href = data.audio_url;
            dlBtn.style.display = 'block';
            // تأكد من أن زر التحميل يتماشى لونيًا مع الثوابت
            dlBtn.style.background = COLORS.DOWNLOAD_BG;
            dlBtn.style.color = '#fff';
        }

        showToast('تمت الدبلجة بنجاح!', COLORS.TOAST_SUCCESS);
    } catch (err) {
        console.error('startDubbing error', err);
        if (err.name === 'AbortError') {
            showToast('انتهت مهلة الاتصال. حاول مرة أخرى لاحقاً.', COLORS.TOAST_INFO);
            if (statusTxt) statusTxt.innerText = 'الحالة: مهلة الاتصال';
        } else {
            showToast('حدث خطأ أثناء المعالجة. تحقق من الخادم وإعدادات CORS.', COLORS.TOAST_ERROR);
            if (statusTxt) statusTxt.innerText = 'الحالة: خطأ أثناء المعالجة';
        }
    } finally {
        // تحديث شريط التقدم إن لم يتم تغييره
        const progFillFinal = document.getElementById('progFill');
        if (progFillFinal && progFillFinal.style.width === '') progFillFinal.style.width = '0%';
    }
}

// -----------------------------
// 🟢 دالة تبديل الشريط الجانبي (تتوافق مع CSS المعدّل)
// -----------------------------
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const main = document.getElementById('mainContent');
    const btn = document.querySelector('.hamburger-menu');

    if (!sidebar || !main || !btn) return;

    sidebar.classList.toggle('collapsed');
    main.classList.toggle('expanded');
    btn.classList.toggle('sidebar-collapsed', sidebar.classList.contains('collapsed'));

    // عند فتح الشريط على الشاشات الصغيرة، أضف overlay
    if (window.innerWidth <= 1024) {
        let overlay = document.querySelector('.overlay-for-sidebar');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.className = 'overlay-for-sidebar visible';
            // طبق لون overlay من الثوابت (CSS سيغطي العرض إن وُجد)
            overlay.style.background = 'rgba(0,0,0,0.45)';
            document.body.appendChild(overlay);
            overlay.addEventListener('click', () => {
                sidebar.classList.add('collapsed');
                main.classList.remove('expanded');
                btn.classList.add('sidebar-collapsed');
                overlay.remove();
            });
        } else {
            overlay.classList.toggle('visible');
            if (!overlay.classList.contains('visible')) overlay.remove();
        }
    }
}

// -----------------------------
// 🟢 تهيئة عند تحميل الصفحة
// -----------------------------
document.addEventListener('DOMContentLoaded', () => {
    checkAuth();

    // ربط أزرار/حقول إن لم تكن مربوطة في HTML
    const mediaFile = document.getElementById('mediaFile');
    if (mediaFile) mediaFile.addEventListener('change', updateFileName);

    const customVoice = document.getElementById('customVoice');
    if (customVoice) customVoice.addEventListener('change', function() { handleCustomVoice(this); });

    const dubBtn = document.getElementById('dubBtn');
    if (dubBtn) dubBtn.addEventListener('click', startDubbing);

    // زر الهامبرغر قد يكون في DOM قبل هذا الملف
    const hb = document.querySelector('.hamburger-menu');
    if (hb) hb.addEventListener('click', toggleSidebar);
});
```
