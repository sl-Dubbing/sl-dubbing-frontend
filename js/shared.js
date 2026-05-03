// shared.js — موحّد + Supabase Auth + Cache
const API_BASE = 'https://web-production-14a1.up.railway.app';
const SUPABASE_URL = 'https://ckjkkxrlgisjdolwddfg.supabase.co';
const SUPABASE_KEY = 'sb_publishable_vS3koY6oKGMH16u1DdtLrg_PC83FaHW';
const USER_CACHE_KEY = 'sl_user_cache';
const USER_CACHE_TTL = 5 * 60 * 1000;

window.API_BASE = API_BASE;

// =================================
// 🔌 تحميل Supabase ديناميكياً
// =================================
let supabaseClient = null;
async function getSupabase() {
    if (supabaseClient) return supabaseClient;
    if (!window.supabase) {
        await new Promise((resolve, reject) => {
            const s = document.createElement('script');
            s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
            s.onload = resolve;
            s.onerror = reject;
            document.head.appendChild(s);
        });
    }
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    return supabaseClient;
}

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
// 💾 Cache
// =================================
function saveUserCache(user) {
    try {
        localStorage.setItem(USER_CACHE_KEY, JSON.stringify({ user, timestamp: Date.now() }));
    } catch (e) {}
}

function getUserCache() {
    try {
        const raw = localStorage.getItem(USER_CACHE_KEY);
        if (!raw) return null;
        return JSON.parse(raw)?.user || null;
    } catch (e) { return null; }
}

function isCacheFresh() {
    try {
        const raw = localStorage.getItem(USER_CACHE_KEY);
        if (!raw) return false;
        const c = JSON.parse(raw);
        return c && (Date.now() - c.timestamp < USER_CACHE_TTL);
    } catch (e) { return false; }
}

function clearUserCache() {
    localStorage.removeItem(USER_CACHE_KEY);
}

// =================================
// 🎨 رسم الواجهة
// =================================
function renderAuthUI(user) {
    const authSection = document.getElementById('authSection');
    const topBadge = document.getElementById('topAccountBadge');

    if (!user) {
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

    const credits = Number(user.credits ?? 0);
    const name = user.name || user.email?.split('@')[0] || 'مستخدم';

    if (authSection) {
        authSection.innerHTML = `
            <div class="user-info-card">
                <div class="user-name"><i class="fas fa-user-circle"></i> ${escapeHtml(name)}</div>
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
// 🚀 المصادقة الذكية
// 1. cache → عرض فوري
// 2. Supabase getSession → تحقّق من صلاحية الجلسة
// 3. Railway /api/user → جلب الرصيد (إن أمكن)
// =================================
async function checkAuth() {
    // 1️⃣ عرض الـ cache فوراً (لا انتظار)
    const cachedUser = getUserCache();
    if (cachedUser) {
        renderAuthUI(cachedUser);
    }

    // 2️⃣ تحقّق من Supabase session
    try {
        const supa = await getSupabase();
        const { data: { session } } = await supa.auth.getSession();

        if (!session) {
            // لا توجد جلسة → غير مسجّل
            localStorage.removeItem('token');
            clearUserCache();
            renderAuthUI(null);
            return;
        }

        // الجلسة سارية — حدّث التوكن إن لزم
        localStorage.setItem('token', session.access_token);

        // إذا الـ cache طازج، توقّف هنا (تجنّب طلب Railway)
        if (isCacheFresh()) return;

        // 3️⃣ حاول جلب الرصيد من Railway (اختياري — لا يفشل التحقق إن لم ينجح)
        const supaUser = session.user || {};
        const baseUser = {
            id: supaUser.id,
            email: supaUser.email,
            name: supaUser.user_metadata?.full_name || supaUser.user_metadata?.name || supaUser.email?.split('@')[0],
            avatar: supaUser.user_metadata?.avatar_url,
            credits: cachedUser?.credits ?? 0
        };

        try {
            const res = await fetch(`${API_BASE}/api/user`, {
                headers: { 'Authorization': `Bearer ${session.access_token}` }
            });
            if (res.ok) {
                const d = await res.json();
                if (d?.user) {
                    // دمج بيانات Supabase مع رصيد Railway
                    const merged = { ...baseUser, ...d.user };
                    saveUserCache(merged);
                    renderAuthUI(merged);
                    return;
                }
            }
        } catch (e) {
            // Railway غير متاح، نستخدم بيانات Supabase فقط
            console.warn('Railway /api/user failed, using Supabase data:', e);
        }

        // ⛑️ Railway لم يستجب — استخدم بيانات Supabase
        saveUserCache(baseUser);
        renderAuthUI(baseUser);

    } catch (e) {
        console.warn('Auth check error:', e);
        // في حالة فشل كامل، أبقِ ما هو معروض من cache
        if (!cachedUser) renderAuthUI(null);
    }
}

const updateSidebarAuth = checkAuth;

// =================================
// 🚪 تسجيل الخروج
// =================================
async function logout() {
    try {
        const supa = await getSupabase();
        await supa.auth.signOut();
    } catch (e) { console.warn('Supabase signOut failed:', e); }

    localStorage.removeItem('token');
    sessionStorage.removeItem('token');
    clearUserCache();
    location.href = 'index.html';
}

// =================================
// 🔄 مزامنة بين tabs
// =================================
window.addEventListener('storage', (e) => {
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
window.getSupabase = getSupabase;
