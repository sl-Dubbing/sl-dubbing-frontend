// shared.js — موحّد + Auth Cache
const API_BASE = 'https://web-production-14a1.up.railway.app';
window.API_BASE = API_BASE;

const USER_CACHE_KEY = 'sl_user_cache';
const USER_CACHE_TTL = 5 * 60 * 1000; // 5 دقائق

// =================================
// Toasts
// =================================
function showToast(msg, color) {
    const t = document.getElementById('toasts');
    if (!t) { alert(msg); return; }
    const box = document.createElement('div');
    box.className = 'toast';
    box.textContent = msg;
    if (color === '#ef4444' || color === 'error') box.style.background = '#ff3b30';
    else if (color === '#10b981' || color === 'success') box.style.background = '#34c759';
    else if (color === '#f59e0b' || color === 'warning') box.style.background = '#ff9500';
    t.appendChild(box);
    setTimeout(() => box.remove(), 4000);
}

function escapeHtml(unsafe) {
    return String(unsafe || '').replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;");
}

// =================================
// Sidebar
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
// 💾 إدارة Cache المستخدم
// =================================
function saveUserCache(user) {
    try {
        const cache = {
            user: user,
            timestamp: Date.now()
        };
        localStorage.setItem(USER_CACHE_KEY, JSON.stringify(cache));
    } catch (e) { console.warn('saveUserCache failed:', e); }
}

function getUserCache() {
    try {
        const raw = localStorage.getItem(USER_CACHE_KEY);
        if (!raw) return null;
        const cache = JSON.parse(raw);
        // الكاش صالح حتى لو منتهي (نستخدمه فوراً ثم نحدّث في الخلفية)
        return cache?.user || null;
    } catch (e) { return null; }
}

function isCacheFresh() {
    try {
        const raw = localStorage.getItem(USER_CACHE_KEY);
        if (!raw) return false;
        const cache = JSON.parse(raw);
        return cache && (Date.now() - cache.timestamp < USER_CACHE_TTL);
    } catch (e) { return false; }
}

function clearUserCache() {
    localStorage.removeItem(USER_CACHE_KEY);
}

// =================================
// 🎨 رسم واجهة المستخدم
// =================================
function renderAuthUI(user) {
    const authSection = document.getElementById('authSection');
    const topBadge = document.getElementById('topAccountBadge');

    if (!user) {
        // غير مسجّل
        if (authSection) {
            authSection.innerHTML = `
                <div style="text-align:center;padding:8px;">
                    <a href="login.html" class="btn-login-sidebar">تسجيل الدخول</a>
                </div>`;
        }
        if (topBadge) {
            topBadge.innerHTML = `<a href="login.html" style="color:inherit;text-decoration:none;"><i class="fas fa-sign-in-alt"></i> دخول</a>`;
        }
        return;
    }

    // مسجّل
    const credits = Number(user.credits || 0);
    if (authSection) {
        authSection.innerHTML = `
            <div class="user-info-card">
                <div class="user-name"><i class="fas fa-user-circle"></i> ${escapeHtml(user.name || 'مستخدم')}</div>
                <div class="user-points"><i class="fas fa-coins"></i> ${credits} نقطة</div>
                <button id="logoutBtn" style="margin-top:10px;background:none;border:none;color:#ff3b30;cursor:pointer;font-size:0.82rem;font-weight:600;">تسجيل الخروج</button>
            </div>`;
        document.getElementById('logoutBtn')?.addEventListener('click', logout);
    }
    if (topBadge) {
        topBadge.innerHTML = `<i class="fas fa-coins" style="color:#ff9500"></i> ${credits} نقطة`;
    }
}

// =================================
// 🚀 المصادقة الذكية (cache-first)
// =================================
async function checkAuth() {
    const token = localStorage.getItem('token');

    // إذا لا يوجد token → غير مسجّل
    if (!token) {
        clearUserCache();
        renderAuthUI(null);
        return;
    }

    // 1️⃣ اعرض الـ cache فوراً (لا انتظار)
    const cachedUser = getUserCache();
    if (cachedUser) {
        renderAuthUI(cachedUser);
    }

    // 2️⃣ إذا الـ cache طازج، لا تتعب الخادم
    if (isCacheFresh()) {
        return;
    }

    // 3️⃣ تحديث في الخلفية
    try {
        const res = await fetch(`${API_BASE}/api/user`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!res.ok) {
            if (res.status === 401 || res.status === 403) {
                // التوكن منتهي
                localStorage.removeItem('token');
                clearUserCache();
                renderAuthUI(null);
            }
            return;
        }

        const d = await res.json();
        if (d && (d.success || d.user)) {
            const user = d.user || {};
            saveUserCache(user);
            renderAuthUI(user);
        } else {
            clearUserCache();
            renderAuthUI(null);
        }
    } catch (e) {
        console.warn('Auth check failed (offline?):', e);
        // في حالة فشل الشبكة، نُبقي الـ cache (تجربة مستخدم أفضل)
    }
}

const updateSidebarAuth = checkAuth;

function logout() {
    localStorage.removeItem('token');
    sessionStorage.removeItem('token');
    clearUserCache();
    location.href = 'index.html';
}

// =================================
// 🔄 مزامنة بين tabs (نفس المتصفح)
// =================================
window.addEventListener('storage', (e) => {
    // إذا تم تسجيل الدخول/الخروج في tab آخر، حدّث هذا الـ tab
    if (e.key === 'token' || e.key === USER_CACHE_KEY) {
        checkAuth();
    }
});

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
window.saveUserCache = saveUserCache;
window.getUserCache = getUserCache;
window.clearUserCache = clearUserCache;
