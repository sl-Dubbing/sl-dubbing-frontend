// js/shared.js - المحرك المشترك لنظام الحماية والتنبيهات والتحكم بالشريط الجانبي
// V4.0 - تم التحديث ليتوافق مع Layout الـ CSS الاحترافي وربط Railway
const API_BASE = 'https://web-production-14a1.up.railway.app';
const OVERLAY_ID = 'sidebarOverlay';

// -----------------------------
// 🟢 إظهار التنبيهات الجمالية (Toasts)
// -----------------------------
function showToast(msg, color = '#ef4444') {
    const t = document.getElementById('toasts');
    if (!t) {
        console.log("Toast container missing, falling back to alert.");
        alert(msg);
        return;
    }
    const box = document.createElement('div');
    box.className = 'toast';
    box.style.cssText = `
        background: ${color};
        color: #fff;
        padding: 12px 18px;
        border-radius: 12px;
        margin-top: 10px;
        box-shadow: 0 10px 25px rgba(0,0,0,0.3);
        transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        opacity: 0;
        transform: translateY(-20px);
        font-weight: 600;
        z-index: 9999;
    `;
    box.innerHTML = escapeHtml(String(msg));
    t.appendChild(box);
    
    // أنيميشن الدخول
    setTimeout(() => {
        box.style.opacity = '1';
        box.style.transform = 'translateY(0)';
    }, 10);

    // اختفاء تدريجي بعد 4 ثوانٍ
    setTimeout(() => {
        box.style.opacity = '0';
        box.style.transform = 'scale(0.9)';
        setTimeout(() => {
            try { box.remove(); } catch (e) {}
        }, 400);
    }, 4000);
}

// -----------------------------
// 🟢 تأمين النص قبل العرض (XSS Protection)
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
// 🟢 إعداد fetch يدعم Token أو HttpOnly Cookie
// -----------------------------
function makeFetchOptions(method = 'GET', token = null, body = null, isJson = true) {
    const opts = { method };
    const headers = {};

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    } else {
        opts.credentials = 'include'; // لدعم الجلسات السحابية
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
    const token = localStorage.getItem('token');

    const renderUnauth = () => {
        if (authSection) authSection.innerHTML = `<div style="text-align:center; padding:15px;"><a href="login.html" class="btn-primary" style="text-decoration:none; display:inline-block; padding:10px 20px; border-radius:10px; background:linear-gradient(180deg,#7c3aed,#2563eb); color:#fff; font-weight:bold;">Login / Sign Up</a></div>`;
        if (topBadge) topBadge.innerHTML = `<a href="login.html" style="color:inherit; text-decoration:none;"><i class="fas fa-sign-in-alt"></i> Login</a>`;
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
// 🟢 عرض واجهة المستخدم للمسجلين
// -----------------------------
function renderAuthUI(userObj, canSendEmail = false) {
    const authSection = document.getElementById('authSection');
    const topBadge = document.getElementById('topAccountBadge');
    
    const name = escapeHtml(userObj?.name || 'User');
    const credits = Number(userObj?.credits || 0);

    if (authSection) {
        authSection.innerHTML = `
            <div class="user-card" style="padding:20px; background:rgba(255,255,255,0.05); border-radius:15px; margin-bottom:20px; border:1px solid rgba(255,255,255,0.1);">
                <div style="font-weight:800; color:#fff; font-size:1.1rem; margin-bottom:8px;">
                    <i class="fas fa-user-circle"></i> ${name}
                </div>
                <div style="color:#ffb800; font-weight:bold; font-size:0.9rem; background:rgba(255,184,0,0.1); padding:5px 12px; border-radius:8px; display:inline-block;">
                    <i class="fas fa-coins"></i> Balance: ${credits} 💰
                </div>
                <div style="margin-top:20px; display:flex; flex-direction:column; gap:10px;">
                    ${canSendEmail ? '<button id="sendAvatarEmailBtn" style="background:#06b6d4; border:none; color:white; padding:8px; border-radius:8px; cursor:pointer; font-weight:600;">Send My Avatar</button>' : ''}
                    <button id="logoutBtn" style="background:rgba(239,68,68,0.15); color:#ef4444; border:1px solid #ef4444; padding:8px; border-radius:10px; cursor:pointer; font-weight:bold;">Sign Out</button>
                </div>
            </div>`;
        
        document.getElementById('logoutBtn')?.addEventListener('click', logout);
        document.getElementById('sendAvatarEmailBtn')?.addEventListener('click', sendAvatarEmailHandler);
    }

    if (topBadge) {
        topBadge.innerHTML = `<i class="fas fa-coins" style="color:#ffb800;"></i> ${credits} Credits`;
        topBadge.style.background = 'rgba(255,184,0,0.1)';
        topBadge.style.color = '#ffb800';
    }
}

// -----------------------------
// 🟢 إدارة الشريط الجانبي (Sidebar)
// -----------------------------
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const main = document.getElementById('mainContent') || document.querySelector('.main-content');
    
    if (!sidebar) return;

    if (window.innerWidth > 1024) {
        // Desktop Mode: Toggle Collapsed state
        const isCollapsed = sidebar.classList.toggle('collapsed');
        if (main) {
            if (isCollapsed) main.classList.add('expanded');
            else main.classList.remove('expanded');
        }
    } else {
        // Mobile Mode: Toggle Open/Overlay state
        const isOpen = sidebar.classList.toggle('open');
        if (isOpen) createOverlay();
        else removeOverlay();
    }
}

function createOverlay() {
    let ov = document.getElementById(OVERLAY_ID);
    if (!ov) {
        ov = document.createElement('div');
        ov.id = OVERLAY_ID;
        ov.style.cssText = `position:fixed; inset:0; background:rgba(0,0,0,0.6); z-index:1000; backdrop-filter:blur(4px);`;
        document.body.appendChild(ov);
        ov.addEventListener('click', toggleSidebar);
    }
    ov.style.display = 'block';
}

function removeOverlay() {
    const ov = document.getElementById(OVERLAY_ID);
    if (ov) ov.style.display = 'none';
}

// -----------------------------
// 🟢 تسجيل الخروج
// -----------------------------
async function logout() {
    const token = localStorage.getItem('token');
    const opts = token ? makeFetchOptions('POST', token, null, false) : { method: 'POST', credentials: 'include' };
    
    try {
        await fetch(`${API_BASE}/api/logout`, opts).catch(() => {});
    } finally {
        localStorage.removeItem('token');
        sessionStorage.removeItem('token');
        location.href = 'index.html';
    }
}

// -----------------------------
// 🟢 إرسال الإيميل
// -----------------------------
async function sendAvatarEmailHandler() {
    const token = localStorage.getItem('token');
    const opts = token ? makeFetchOptions('POST', token, null, false) : { method: 'POST', credentials: 'include' };
    
    try {
        const res = await fetch(`${API_BASE}/api/user/send-avatar-email`, opts);
        if (res.ok) showToast('Email sent successfully! 📧', '#10b981');
        else showToast('Failed to send email.', '#ef4444');
    } catch (e) {
        showToast('Connection error.', '#ef4444');
    }
}

// -----------------------------
// 🟢 تهيئة عند تحميل الصفحة
// -----------------------------
document.addEventListener('DOMContentLoaded', () => {
    checkAuth();

    // ربط زر القائمة
    const menuBtn = document.getElementById('menuBtn') || document.getElementById('menuToggle');
    if (menuBtn) {
        menuBtn.addEventListener('click', (e) => {
            e.preventDefault();
            toggleSidebar();
        });
    }

    // إعداد الحالة الافتراضية للجوال
    if (window.innerWidth <= 1024) {
        const sidebar = document.getElementById('sidebar');
        if (sidebar) sidebar.classList.add('collapsed');
    }
});

// تصدير الدوال للاستخدام العالمي
window.showToast = showToast;
window.toggleSidebar = toggleSidebar;
window.API_BASE = API_BASE;
