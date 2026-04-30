// js/shared.js - المحرك المشترك لنظام الحماية والتنبيهات والتحكم بالشريط الجانبي
// V3.5 - تحسين نظام المصادقة والربط مع Railway
const API_BASE = 'https://web-production-14a1.up.railway.app';
const OVERLAY_ID = 'sidebarOverlay';

// -----------------------------
// 🟢 إظهار التنبيهات الجمالية (Toasts)
// -----------------------------
function showToast(msg, color = '#ef4444') {
    const t = document.getElementById('toasts');
    if (!t) {
        alert(msg); // Fallback إذا لم يوجد حاوية التنبيهات
        return;
    }
    const box = document.createElement('div');
    box.className = 'toast';
    box.style.cssText = `
        background: ${color};
        color: #fff;
        padding: 12px 20px;
        border-radius: 12px;
        margin-top: 10px;
        box-shadow: 0 10px 25px rgba(0,0,0,0.2);
        transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        opacity: 0;
        transform: translateY(-20px);
        font-weight: 600;
        z-index: 9999;
    `;
    box.innerHTML = escapeHtml(String(msg));
    t.appendChild(box);
    
    // ظهور الانيميشن
    setTimeout(() => {
        box.style.opacity = '1';
        box.style.transform = 'translateY(0)';
    }, 10);

    // اختفاء تدريجي
    setTimeout(() => {
        box.style.opacity = '0';
        box.style.transform = 'scale(0.9)';
        setTimeout(() => {
            try { box.remove(); } catch (e) {}
        }, 400);
    }, 4500);
}

// -----------------------------
// 🟢 دالة مساعدة: تأمين النص قبل العرض (XSS Protection)
// -----------------------------
function escapeHtml(unsafe) {
    return String(unsafe || "")
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
    const headers = {};

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    } else {
        opts.credentials = 'include'; // لدعم الجلسات عبر الكوكيز
    }

    if (isJson) {
        headers['Accept'] = 'application/json';
        if (body) headers['Content-Type'] = 'application/json';
    }

    opts.headers = headers;
    if (body !== null) opts.body = body;
    return opts;
}

// -----------------------------
// 🟢 التحقق من تسجيل الدخول وجلب الرصيد
// -----------------------------
async function checkAuth() {
    const authSection = document.getElementById('authSection');
    const topBadge = document.getElementById('topAccountBadge');
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');

    if (!authSection && !topBadge) return;

    const renderUnauth = () => {
        if (authSection) authSection.innerHTML = `<div style="text-align:center; padding:10px;"><a href="login.html" class="btn-login-sidebar" style="background:#7c3aed; color:white; padding:8px 15px; border-radius:8px; text-decoration:none; display:inline-block; font-weight:bold;">تسجيل الدخول</a></div>`;
        if (topBadge) {
            topBadge.innerHTML = `<a href="login.html" style="color:inherit; text-decoration:none;"><i class="fas fa-sign-in-alt"></i> دخول</a>`;
            topBadge.style.background = '#f3f4f6';
        }
    };

    try {
        const opts = token ? makeFetchOptions('GET', token, null, false) : { method: 'GET', credentials: 'include' };
        const res = await fetch(`${API_BASE}/api/user`, opts);

        if (!res.ok) {
            if (res.status === 401 || res.status === 403) localStorage.removeItem('token');
            renderUnauth();
            return;
        }

        const d = await res.json();
        if (d && (d.success || d.user)) {
            renderAuthUI(d.user, d.can_send_email);
        } else {
            renderUnauth();
        }
    } catch (e) {
        console.warn('Auth check failed:', e);
        renderUnauth();
    }
}

// -----------------------------
// 🟢 عرض واجهة المستخدم للمسجلين (تحديث الاسم والرصيد)
// -----------------------------
function renderAuthUI(userObj, canSendEmail = false) {
    const authSection = document.getElementById('authSection');
    const topBadge = document.getElementById('topAccountBadge');
    
    const name = escapeHtml(userObj?.name || userObj?.full_name || 'مستخدم');
    const points = userObj?.credits !== undefined ? userObj.credits : (userObj?.points || 0);

    if (authSection) {
        authSection.innerHTML = `
            <div class="user-info-card" style="padding:15px; background:rgba(255,255,255,0.05); border-radius:12px; margin-bottom:15px;">
                <div style="font-weight:700; color:#fff; font-size:1rem; margin-bottom:5px;">
                    <i class="fas fa-user-circle"></i> ${name}
                </div>
                <div style="color:#ffd700; font-weight:bold; font-size:0.9rem; background:rgba(255,215,0,0.1); padding:4px 10px; border-radius:8px; display:inline-block;">
                    <i class="fas fa-coins"></i> الرصيد: ${points} نقطة
                </div>
                <div style="margin-top:15px; display:flex; gap:10px;">
                    ${canSendEmail ? '<button id="sendAvatarEmailBtn" class="btn-mini" style="background:#06b6d4; border:none; color:white; padding:5px 10px; border-radius:6px; cursor:pointer; font-size:0.8rem;">إرسال الأفاتار</button>' : ''}
                    <button id="logoutBtn" style="background:#ef4444; color:white; border:none; padding:5px 12px; border-radius:6px; cursor:pointer; font-size:0.8rem; font-weight:bold;">خروج</button>
                </div>
            </div>`;
        
        document.getElementById('logoutBtn')?.addEventListener('click', logout);
        document.getElementById('sendAvatarEmailBtn')?.addEventListener('click', sendAvatarEmailHandler);
    }

    if (topBadge) {
        topBadge.innerHTML = `<i class="fas fa-coins" style="color:#f59e0b;"></i> ${points} نقطة`;
        topBadge.style.background = '#ecfdf5';
        topBadge.style.color = '#10b981';
        topBadge.style.border = '1px solid #a7f3d0';
    }
}

// -----------------------------
// 🟢 تسجيل الخروج
// -----------------------------
async function logout() {
    try {
        const token = localStorage.getItem('token');
        const opts = token ? makeFetchOptions('POST', token, null, false) : { method: 'POST', credentials: 'include' };
        await fetch(`${API_BASE}/api/logout`, opts).catch(() => {});
    } catch (e) {}
    localStorage.removeItem('token');
    sessionStorage.removeItem('token');
    location.href = 'index.html';
}

// -----------------------------
// 🟢 إرسال الإيميل
// -----------------------------
async function sendAvatarEmailHandler() {
    try {
        const token = localStorage.getItem('token');
        const opts = token ? makeFetchOptions('POST', token, null, false) : { method: 'POST', credentials: 'include' };
        const res = await fetch(`${API_BASE}/api/user/send-avatar-email`, opts);
        if (res.ok) showToast('تم إرسال الإيميل بنجاح 📧', '#10b981');
        else showToast('فشل إرسال الإيميل', '#ef4444');
    } catch (e) {
        showToast('حدث خطأ في الاتصال', '#ef4444');
    }
}

// -----------------------------
// 🟢 التحكم في الشريط الجانبي (Sidebar)
// -----------------------------
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('overlay');
    if (!sidebar) return;

    sidebar.classList.toggle('active');
    if (overlay) overlay.classList.toggle('active');
    
    // منع التمرير عند فتح القائمة في الجوال
    if (window.innerWidth <= 1024) {
        document.body.style.overflow = sidebar.classList.contains('active') ? 'hidden' : '';
    }
}

// -----------------------------
// 🟢 تهيئة عند تحميل الصفحة
// -----------------------------
document.addEventListener('DOMContentLoaded', () => {
    checkAuth();

    // ربط زر القائمة
    const menuBtn = document.getElementById('menuBtn') || document.getElementById('menuToggle');
    if (menuBtn) menuBtn.addEventListener('click', (e) => {
        e.preventDefault();
        toggleSidebar();
    });

    // ربط الـ Overlay للإغلاق
    const overlay = document.getElementById('overlay');
    if (overlay) overlay.addEventListener('click', toggleSidebar);
});

// تصدير الدوال للاستخدام العالمي
window.showToast = showToast;
window.toggleSidebar = toggleSidebar;
window.API_BASE = API_BASE;
