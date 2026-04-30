// shared.js — موحّد لكل الصفحات
const API_BASE = 'https://web-production-14a1.up.railway.app';
window.API_BASE = API_BASE;

// =================================
// Toasts
// =================================
function showToast(msg, color) {
    const t = document.getElementById('toasts');
    if (!t) { alert(msg); return; }
    const box = document.createElement('div');
    box.className = 'toast';
    box.textContent = msg;
    if (color === '#ef4444' || color === 'error') box.style.background = '#ef4444';
    else if (color === '#10b981' || color === 'success') box.style.background = '#10b981';
    else if (color === '#f59e0b' || color === 'warning') box.style.background = '#f59e0b';
    t.appendChild(box);
    setTimeout(() => box.remove(), 4000);
}

function escapeHtml(unsafe) {
    return String(unsafe || '').replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;");
}

// =================================
// Sidebar (موحّد - يستخدم .active)
// =================================
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;
    if (sidebar.classList.contains('active')) closeSidebar();
    else openSidebar();
}

function openSidebar() {
    document.getElementById('sidebar')?.classList.add('active');
    document.getElementById('overlay')?.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeSidebar() {
    document.getElementById('sidebar')?.classList.remove('active');
    document.getElementById('overlay')?.classList.remove('active');
    document.body.style.overflow = '';
}

// =================================
// المصادقة
// =================================
async function checkAuth() {
    const authSection = document.getElementById('authSection');
    const topBadge = document.getElementById('topAccountBadge');
    const token = localStorage.getItem('token');

    const renderUnauth = () => {
        if (authSection) authSection.innerHTML = `<div style="text-align:center;padding:8px;"><a href="login.html" class="btn-login-sidebar">تسجيل الدخول</a></div>`;
        if (topBadge) topBadge.innerHTML = `<a href="login.html" style="color:inherit;text-decoration:none;"><i class="fas fa-sign-in-alt"></i> دخول</a>`;
    };

    if (!token) { renderUnauth(); return; }

    try {
        const res = await fetch(`${API_BASE}/api/user`, { headers: { 'Authorization': `Bearer ${token}` } });
        if (!res.ok) {
            if (res.status === 401 || res.status === 403) localStorage.removeItem('token');
            renderUnauth(); return;
        }
        const d = await res.json();
        if (d && (d.success || d.user)) {
            const user = d.user || {};
            const credits = Number(user.credits || 0);
            if (authSection) {
                authSection.innerHTML = `
                    <div class="user-info-card">
                        <div class="user-name"><i class="fas fa-user-circle"></i> ${escapeHtml(user.name || 'مستخدم')}</div>
                        <div class="user-points"><i class="fas fa-coins"></i> ${credits} نقطة</div>
                        <button id="logoutBtn" style="margin-top:10px;background:none;border:none;color:#ef4444;cursor:pointer;font-size:0.82rem;font-weight:600;">تسجيل الخروج</button>
                    </div>`;
                document.getElementById('logoutBtn')?.addEventListener('click', logout);
            }
            if (topBadge) {
                topBadge.innerHTML = `<i class="fas fa-coins" style="color:#f59e0b"></i> ${credits} نقطة`;
            }
        } else {
            renderUnauth();
        }
    } catch (e) {
        console.warn('Auth check failed:', e);
        renderUnauth();
    }
}

const updateSidebarAuth = checkAuth;

function logout() {
    localStorage.removeItem('token');
    sessionStorage.removeItem('token');
    location.reload();
}

// =================================
// تهيئة
// =================================
document.addEventListener('DOMContentLoaded', () => {
    checkAuth();

    const menuBtn = document.getElementById('menuBtn') || document.getElementById('menuToggle');
    if (menuBtn) menuBtn.addEventListener('click', (e) => { e.preventDefault(); toggleSidebar(); });

    document.getElementById('overlay')?.addEventListener('click', closeSidebar);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSidebar(); });
});

// Exports
window.showToast = showToast;
window.escapeHtml = escapeHtml;
window.toggleSidebar = toggleSidebar;
window.openSidebar = openSidebar;
window.closeSidebar = closeSidebar;
window.checkAuth = checkAuth;
window.updateSidebarAuth = updateSidebarAuth;
window.logout = logout;
