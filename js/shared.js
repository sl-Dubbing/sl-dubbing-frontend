// shared.js — Supabase Auth + Cache (مصحح)
const API_BASE = 'https://web-production-14a1.up.railway.app';
const SUPABASE_URL = 'https://ckjkkxrlgisjdolwddfg.supabase.co';

// 🚀 قراءة المفتاح من ملف config.js
const SUPABASE_KEY = window.APP_CONFIG?.SUPABASE_KEY || '';
const USER_CACHE_KEY = 'sl_user_cache';

window.API_BASE = API_BASE;

// =================================
// 🔌 Supabase loader
// =================================
let supabaseClient = null;
async function getSupabase() {
    if (supabaseClient) return supabaseClient;
    if (!SUPABASE_KEY) {
        console.error('Supabase key missing. Set window.APP_CONFIG.SUPABASE_KEY before loading.');
        throw new Error('Supabase key not configured');
    }
    if (!window.supabase) {
        await new Promise((resolve, reject) => {
            const s = document.createElement('script');
            s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
            s.onload = resolve;
            s.onerror = () => reject(new Error('Failed to load Supabase SDK'));
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
        const parsed = JSON.parse(raw);
        // صلاحية الكاش 24 ساعة
        if (Date.now() - (parsed.timestamp || 0) > 24 * 60 * 60 * 1000) {
            localStorage.removeItem(USER_CACHE_KEY);
            return null;
        }
        return parsed?.user || null;
    } catch (e) { return null; }
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

    const name = user.name || user.email?.split('@')[0] || 'مستخدم';
    const credits = Number(user.credits ?? 0);

    if (authSection) {
        const avatar = user.avatar
            ? `<img src="${escapeHtml(user.avatar)}" style="width:48px;height:48px;border-radius:50%;margin-bottom:8px;object-fit:cover;">`
            : `<i class="fas fa-user-circle" style="font-size:2.5rem;color:#86868b;margin-bottom:8px;display:block;"></i>`;

        authSection.innerHTML = `
            <div class="user-info-card">
                ${avatar}
                <div class="user-name">${escapeHtml(name)}</div>
                <div class="user-points"><i class="fas fa-coins"></i> ${credits} نقطة</div>
                <button id="logoutBtn" style="margin-top:10px;background:none;border:none;color:#ff3b30;cursor:pointer;font-size:0.82rem;font-weight:600;">تسجيل الخروج</button>
            </div>`;
        document.getElementById('logoutBtn')?.addEventListener('click', logout);
    }
    if (topBadge) {
        topBadge.innerHTML = `<i class="fas fa-user-circle" style="color:#007aff"></i> ${escapeHtml(name)}`;
    }
}

// =================================
// 🚀 المصادقة الذكية
// =================================
async function checkAuth() {
    // 1️⃣ عرض الـ cache فوراً
    const cached = getUserCache();
    if (cached) renderAuthUI(cached);

    // 2️⃣ تحقّق من Supabase
    try {
        const supa = await getSupabase();
        const { data: { session } } = await supa.auth.getSession();

        if (!session?.user) {
            clearUserCache();
            localStorage.removeItem('token');
            renderAuthUI(null);
            return;
        }

        // الجلسة سارية
        localStorage.setItem('token', session.access_token);

        const u = session.user;

       // جلب النقاط من السيرفر
       let credits = cached?.credits ?? 0;
       try {
           const res = await fetch(`${API_BASE}/api/user/credits`, {
               headers: { 'Authorization': `Bearer ${session.access_token}` }
           });
           if (res.ok) {
               const data = await res.json();
               // 🛠️ الإصلاح هنا: الكود الآن يقرأ من مسار السيرفر الصحيح (data.user.credits)
               credits = data?.user?.credits ?? data?.credits ?? credits;
               
               // تحديث واجهة المستخدم فوراً (بما في ذلك صفحة الدبلجة)
               document.querySelectorAll('.points-count, #user-credits').forEach(el => {
                   el.textContent = credits;
               });
           }
       } catch (e) {
           console.warn('Failed to fetch credits:', e);
       }

        const user = {
            id: u.id,
            email: u.email,
            name: u.user_metadata?.full_name || u.user_metadata?.name || u.email?.split('@')[0],
            avatar: u.user_metadata?.avatar_url,
            credits: credits
        };

        saveUserCache(user);
        renderAuthUI(user);

    } catch (e) {
        console.warn('Auth check failed:', e);
        if (!cached) renderAuthUI(null);
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
    } catch (e) { console.warn('signOut failed:', e); }

    localStorage.removeItem('token');
    sessionStorage.removeItem('token');
    clearUserCache();
    location.href = 'index.html';
}

// =================================
// 🔄 مزامنة بين tabs
// =================================
window.addEventListener('storage', (e) => {
    if (e.key === 'token' || e.key === USER_CACHE_KEY) checkAuth();
});

// =================================
// 🔔 الاستماع لتغيّرات Supabase Auth
// =================================
(async function listenToAuth() {
    try {
        const supa = await getSupabase();
        supa.auth.onAuthStateChange((event, session) => {
            console.log('Auth event:', event);
            if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
                checkAuth();
            } else if (event === 'SIGNED_OUT') {
                clearUserCache();
                localStorage.removeItem('token');
                renderAuthUI(null);
            }
        });
    } catch (e) { console.warn('Auth listener failed:', e); }
})();

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
