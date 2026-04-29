// js/shared.js - المحرك المشترك لنظام الحماية والتنبيهات والتحكم بالشريط الجانبي
const API_BASE = 'https://web-production-14a1.up.railway.app';
const OVERLAY_ID = 'sidebarOverlay';

// -----------------------------
// 🟢 إظهار التنبيهات الجمالية
// -----------------------------
function showToast(msg, color = '#ef4444') {
    const t = document.getElementById('toasts');
    if (!t) return;
    const box = document.createElement('div');
    box.className = 'toast';
    box.style.cssText = `
        background: ${color};
        color: #fff;
        padding: 10px 16px;
        border-radius: 10px;
        margin-top: 8px;
        box-shadow: 0 6px 18px rgba(0,0,0,0.35);
        transition: opacity 0.3s ease, transform 0.3s ease;
        opacity: 1;
    `;
    box.innerHTML = escapeHtml(String(msg));
    t.appendChild(box);
    // اختفاء تدريجي
    setTimeout(() => {
        box.style.opacity = '0';
        box.style.transform = 'translateY(6px)';
        setTimeout(() => {
            try { box.remove(); } catch (e) {}
        }, 300);
    }, 4000);
}

// -----------------------------
// 🟢 دالة مساعدة: تأمين النص قبل العرض
// -----------------------------
function escapeHtml(unsafe) {
    return String(unsafe)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// -----------------------------
// 🟢 إعداد fetch يدعم token أو HttpOnly cookie
// -----------------------------
function makeFetchOptions(method = 'GET', token = null, body = null, isJson = true) {
    const opts = { method };
    if (token) {
        opts.headers = { 'Authorization': `Bearer ${token}` };
        if (isJson) opts.headers['Accept'] = 'application/json';
        if (isJson && body) opts.headers['Content-Type'] = 'application/json';
    } else {
        // الاعتماد على HttpOnly cookie
        opts.credentials = 'include';
        if (isJson) opts.headers = { 'Accept': 'application/json', 'Content-Type': 'application/json' };
    }
    if (body !== null) opts.body = body;
    return opts;
}

// -----------------------------
// 🟢 التحقق من تسجيل الدخول وجلب الرصيد (Token or Cookie Based)
// -----------------------------
async function checkAuth() {
    const authSection = document.getElementById('authSection');
    const token = localStorage.getItem('token');

    if (!authSection) return;

    // Helper: render unauthenticated UI
    const renderUnauth = () => {
        authSection.innerHTML = `<a href="login.html" style="color:#ffd700; text-decoration:none; font-weight:bold;">Login</a>`;
    };

    // إذا لا توكن محلي، حاول الاعتماد على الكوكي
    if (!token) {
        try {
            const res = await fetch(`${API_BASE}/api/user`, { method: 'GET', credentials: 'include' });
            if (!res.ok) {
                renderUnauth();
                return;
            }
            const d = await res.json().catch(() => null);
            if (d && d.success && d.user) {
                renderAuthUI(d.user, d.can_send_email);
                return;
            } else {
                renderUnauth();
                return;
            }
        } catch (e) {
            console.warn('Cookie auth check failed:', e);
            renderUnauth();
            return;
        }
    }

    // إذا وُجد توكن محلي
    try {
        const opts = makeFetchOptions('GET', token, null, false);
        const r = await fetch(`${API_BASE}/api/user`, opts);
        if (!r.ok) {
            if (r.status === 401 || r.status === 403) {
                localStorage.removeItem('token');
                showToast('انتهت صلاحية الجلسة. الرجاء تسجيل الدخول مجدداً.', '#f59e0b');
                renderUnauth();
                return;
            }
            console.warn('Auth check returned non-ok status', r.status);
            renderUnauth();
            return;
        }

        const d = await r.json().catch(() => null);
        if (!d) {
            console.warn('Auth check: invalid JSON response');
            renderUnauth();
            return;
        }

        if (d.success && d.user) {
            renderAuthUI(d.user, d.can_send_email);
        } else {
            localStorage.removeItem('token');
            renderUnauth();
        }
    } catch (e) {
        console.error("Auth check failed", e);
        showToast('فشل الاتصال بخدمة المصادقة. تحقق من الخادم.', '#ef4444');
        renderUnauth();
    }
}

// -----------------------------
// 🟢 عرض واجهة المستخدم للمستخدم المسجل
// -----------------------------
function renderAuthUI(userObj, canSendEmail = false) {
    const authSection = document.getElementById('authSection');
    if (!authSection) return;
    const name = escapeHtml(userObj?.name || 'User');
    const credits = Number(userObj?.credits || 0);
    authSection.innerHTML = `
        <div style="display:flex; gap:12px; align-items:center; justify-content:flex-start;">
            <div style="text-align:right">
                <div style="font-weight:700; color:#fff">${name}</div>
                <div style="background:rgba(255,255,255,0.06); padding:4px 10px; border-radius:8px; font-size:0.8rem; color:#ffd700">
                    Balance: ${credits} 💰
                </div>
            </div>
            <div style="display:flex; flex-direction:column; gap:8px;">
                ${canSendEmail ? '<button id="sendAvatarEmailBtn" style="background:#06b6d4; color:#fff; border:none; padding:6px 10px; border-radius:8px; cursor:pointer;">Send Avatar</button>' : ''}
                <button id="logoutBtn" style="background:#7c3aed; color:#fff; border:none; padding:8px 15px; border-radius:10px; cursor:pointer; font-weight:bold;">Logout</button>
            </div>
        </div>`;
    const lb = document.getElementById('logoutBtn');
    if (lb) {
        lb.removeEventListener('click', logout); // حماية من ربط مزدوج
        lb.addEventListener('click', logout);
    }
    const sb = document.getElementById('sendAvatarEmailBtn');
    if (sb) {
        sb.removeEventListener('click', sendAvatarEmailHandler);
        sb.addEventListener('click', sendAvatarEmailHandler);
    }
}

// -----------------------------
// 🟢 تسجيل الخروج (محسّن: يخطر الخادم ويدعم cookie/header)
// -----------------------------
async function logout() {
    try {
        const token = localStorage.getItem('token');
        const opts = token ? makeFetchOptions('POST', token, null, false) : { method: 'POST', credentials: 'include' };
        // حاول إخطار الخادم؛ لا نمنع المستخدم من الخروج إن فشل الطلب
        await fetch(`${API_BASE}/api/logout`, opts).catch(() => {});
    } catch (e) {
        console.warn('Logout request failed:', e);
    } finally {
        localStorage.removeItem('token');
        // إعادة تحميل الواجهة لإظهار حالة غير مسجل
        try { location.reload(); } catch (e) {}
    }
}
window.logout = logout;

// -----------------------------
// 🟢 إرسال الصورة عبر الإيميل (زر في الواجهة)
// -----------------------------
async function sendAvatarEmailHandler() {
    try {
        const token = localStorage.getItem('token');
        const opts = token ? makeFetchOptions('POST', token, null, false) : { method: 'POST', credentials: 'include' };
        const res = await fetch(`${API_BASE}/api/user/send-avatar-email`, opts);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            showToast(data.error || 'فشل إرسال الإيميل', '#ef4444');
            return;
        }
        showToast('تم إرسال الإيميل بنجاح', '#10b981');
    } catch (e) {
        console.error('sendAvatarEmailHandler error:', e);
        showToast('حدث خطأ أثناء إرسال الإيميل', '#ef4444');
    }
}

// -----------------------------
// 🟢 إدارة الشريط الجانبي (overlay + open/close)
// -----------------------------
function createOverlay() {
    let ov = document.getElementById(OVERLAY_ID);
    if (!ov) {
        ov = document.createElement('div');
        ov.id = OVERLAY_ID;
        ov.style.position = 'fixed';
        ov.style.inset = '0';
        ov.style.background = 'rgba(0,0,0,0.45)';
        ov.style.zIndex = '1050';
        ov.style.display = 'block';
        document.body.appendChild(ov);
        ov.addEventListener('click', () => {
            closeSidebarMobile();
        });
    } else {
        ov.style.display = 'block';
    }
}

function removeOverlay() {
    const ov = document.getElementById(OVERLAY_ID);
    if (ov) {
        // أخفِ العنصر بدلاً من حذفه لتقليل عمليات DOM المكلفة
        ov.style.display = 'none';
    }
}

function openSidebarMobile() {
    const sidebar = document.getElementById('sidebar');
    const menuToggle = document.getElementById('menuToggle');
    if (!sidebar) return;
    sidebar.classList.remove('collapsed');
    sidebar.classList.add('open');
    if (menuToggle) menuToggle.classList.remove('sidebar-collapsed');
    createOverlay();
    updateMenuAria();
}

function closeSidebarMobile() {
    const sidebar = document.getElementById('sidebar');
    const menuToggle = document.getElementById('menuToggle');
    if (!sidebar) return;
    sidebar.classList.remove('open');
    sidebar.classList.add('collapsed');
    if (menuToggle) menuToggle.classList.add('sidebar-collapsed');
    removeOverlay();
    updateMenuAria();
}

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const main = document.getElementById('mainContent') || document.querySelector('.main-content');
    const menuToggle = document.getElementById('menuToggle');
    if (!sidebar || !menuToggle) return;

    if (window.innerWidth <= 1024) {
        // سلوك الجوال
        if (sidebar.classList.contains('open')) {
            closeSidebarMobile();
        } else {
            openSidebarMobile();
        }
    } else {
        // سلوك سطح المكتب
        if (sidebar.classList.contains('collapsed')) {
            sidebar.classList.remove('collapsed');
            if (main) main.classList.remove('expanded');
            menuToggle.classList.remove('sidebar-collapsed');
        } else {
            sidebar.classList.add('collapsed');
            if (main) main.classList.add('expanded');
            menuToggle.classList.add('sidebar-collapsed');
        }
        updateMenuAria();
    }
}
window.toggleSidebar = toggleSidebar;

// -----------------------------
// 🟢 تحديث aria-expanded للزر
// -----------------------------
function updateMenuAria() {
    const menuToggle = document.getElementById('menuToggle');
    const sidebar = document.getElementById('sidebar');
    if (!menuToggle || !sidebar) return;
    const isOpen = (!sidebar.classList.contains('collapsed') && (window.innerWidth > 1024 || sidebar.classList.contains('open')));
    menuToggle.setAttribute('aria-expanded', String(isOpen));
}

// -----------------------------
// 🟢 تهيئة عند تحميل الصفحة
// -----------------------------
document.addEventListener('DOMContentLoaded', () => {
    // تحقق المصادقة
    checkAuth();

    // ربط أحداث واجهة المستخدم
    const mediaFile = document.getElementById('mediaFile');
    if (mediaFile) mediaFile.addEventListener('change', () => {
        const txt = document.getElementById('fileTxt');
        if (mediaFile.files && mediaFile.files.length > 0 && txt) txt.innerText = mediaFile.files[0].name;
    });

    const customVoice = document.getElementById('customVoice');
    if (customVoice) customVoice.addEventListener('change', function() {
        const txt = document.getElementById('customVoiceTxt');
        if (this.files && this.files.length > 0 && txt) txt.innerText = this.files[0].name;
    });

    const dubBtn = document.getElementById('dubBtn');
    if (dubBtn) dubBtn.addEventListener('click', () => {
        // استدعاء دالة بدء الدبلجة إن وُجدت في dubbing.js
        if (typeof startDubbing === 'function') startDubbing();
        else showToast('وظيفة الدبلجة غير متاحة حالياً.', '#f97316');
    });

    // زر القائمة (menuToggle)
    const menuToggle = document.getElementById('menuToggle');
    if (menuToggle) {
        menuToggle.addEventListener('click', (e) => {
            e.preventDefault();
            toggleSidebar();
        });
    }

    // تهيئة حالة الشريط حسب حجم الشاشة
    const sidebar = document.getElementById('sidebar');
    if (sidebar) {
        if (window.innerWidth <= 1024) {
            sidebar.classList.add('collapsed');
            sidebar.classList.remove('open');
            const mt = document.getElementById('menuToggle');
            if (mt) mt.classList.add('sidebar-collapsed');
        } else {
            sidebar.classList.remove('collapsed');
            sidebar.classList.remove('open');
            const mt = document.getElementById('menuToggle');
            if (mt) mt.classList.remove('sidebar-collapsed');
        }
    }

    updateMenuAria();
});

// -----------------------------
// 🟢 استجابة لتغيير حجم النافذة
// -----------------------------
window.addEventListener('resize', () => {
    const sidebar = document.getElementById('sidebar');
    const main = document.getElementById('mainContent') || document.querySelector('.main-content');
    const menuToggle = document.getElementById('menuToggle');

    if (!sidebar) return;

    if (window.innerWidth > 1024) {
        // إزالة حالة الجوال
        sidebar.classList.remove('open');
        removeOverlay();
        // إذا لم يكن collapsed افتراضياً، اتركه مفتوح
        if (!sidebar.classList.contains('collapsed')) {
            if (main) main.classList.remove('expanded');
            if (menuToggle) menuToggle.classList.remove('sidebar-collapsed');
        }
    } else {
        // على الجوال اجعل الشريط مخفي افتراضياً إن لم يكن مفتوحاً
        if (!sidebar.classList.contains('open')) {
            sidebar.classList.add('collapsed');
            if (menuToggle) menuToggle.classList.add('sidebar-collapsed');
        }
    }
    updateMenuAria();
});
