// js/shared.js - V16 (Final Clean Version)

const API_BASE = window.APP_CONFIG?.API_BASE || 'https://api.glotix.ai';
const SUPABASE_URL = window.APP_CONFIG?.SUPABASE_URL || 'https://ckjkkxrlgisjdolwddfg.supabase.co';
const SUPABASE_KEY = window.APP_CONFIG?.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNramtreHJsZ2lzamRvbHdkZGZnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0NjU0OTUsImV4cCI6MjA5MzA0MTQ5NX0.F-4TbmO6_7plPm8NBr_6djCv6gtEPpWFw9J7m8vTs6M';

window.API_BASE = API_BASE;

let supabaseClient = null;

function getSupabase() {
    if (supabaseClient) return supabaseClient;
    if (window.supabase) {
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    }
    return supabaseClient;
}

// ── 1. Update Dropdown UI (works on ALL pages) ──
window.updateDropdownUI = function(user) {
    const guestMenu  = document.getElementById('guestMenu');
    const userMenu   = document.getElementById('userMenu');
    const logoutBtn  = document.getElementById('logoutBtn');
    const userName   = document.getElementById('menuUserName');
    const credits    = document.getElementById('menuCredits');
    const avatar     = document.getElementById('menuAvatar');

    if (user && user.id) {
        if (guestMenu)  guestMenu.style.display  = 'none';
        if (userMenu)   userMenu.style.display   = 'block';
        if (logoutBtn)  logoutBtn.style.display  = 'flex';
        if (userName)   userName.textContent     = user.name || 'My Account';
        if (credits)    credits.textContent      = user.credits !== undefined ? user.credits : '...';
        if (avatar && user.avatar) avatar.src    = user.avatar;
    } else {
        if (guestMenu)  guestMenu.style.display  = 'flex';
        if (userMenu)   userMenu.style.display   = 'none';
        if (logoutBtn)  logoutBtn.style.display  = 'none';
    }
};

// ── 2. Check Server Status ──
window.checkServer = async function() {
    const badge = document.getElementById('srv');
    const txt   = document.getElementById('srvTxt');
    if (!badge || !txt) return;

    try {
        const r    = await fetch(API_BASE + '/api/status');
        const data = await r.json();
        if (data.is_online) {
            badge.className  = 'srv-badge on';
            txt.textContent  = 'Connected to Cloud';
        } else {
            badge.className  = 'srv-badge';
            txt.textContent  = 'System Offline';
        }
    } catch (e) {
        if (badge) badge.className = 'srv-badge';
        if (txt)   txt.textContent = 'Connection Error';
    }
};

// ── 3. Full Auth Sync ──
window.checkAuth = async function() {
    // عرض الكاش فوراً
    const cachedUser = JSON.parse(localStorage.getItem('sl_user_cache') || 'null');
    if (cachedUser) window.updateDropdownUI(cachedUser);

    try {
        const supa = getSupabase();
        if (!supa) return;

        const { data: { session } } = await supa.auth.getSession();

        if (!session) {
            localStorage.removeItem('token');
            localStorage.removeItem('sl_user_cache');
            window.updateDropdownUI(null);
            return;
        }

        localStorage.setItem('token', session.access_token);

        const res = await fetch(`${API_BASE}/api/user/credits`, {
            headers: { 'Authorization': `Bearer ${session.access_token}` }
        });

        if (res.ok) {
            const d = await res.json();
            const userData = {
                id:      session.user.id,
                email:   session.user.email,
                name:    session.user.user_metadata?.full_name ||
                         session.user.email?.split('@')[0] ||
                         'User',
                avatar:  session.user.user_metadata?.avatar_url ||
                         session.user.user_metadata?.picture ||
                         `https://ui-avatars.com/api/?name=${encodeURIComponent(
                             session.user.email?.split('@')[0] || 'U'
                         )}&background=0f0f10&color=fff&size=64`,
                credits: d.success ? d.credits : '...'
            };
            localStorage.setItem('sl_user_cache', JSON.stringify(userData));
            window.updateDropdownUI(userData);
        }
    } catch(e) {
        console.error('Auth sync error:', e);
    }
};

// ── 4. Global Event Listeners ──
document.addEventListener('DOMContentLoaded', () => {

    // اكتشاف العودة من Google OAuth وإعادة تحميل لاستيعاب الجلسة
    const hash = window.location.hash;
    if (hash.includes('access_token') || hash.includes('token_type')) {
        window.history.replaceState(null, '', window.location.pathname);
        window.location.reload();
        return;
    }
    if (hash) {
        window.history.replaceState(null, '', window.location.pathname);
    }

    // Dropdown Toggle
    const menuBtn      = document.getElementById('menuBtn');
    const dropdownMenu = document.getElementById('mainMenuDropdown');

    if (menuBtn && dropdownMenu) {
        menuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdownMenu.classList.toggle('active');
        });
        document.addEventListener('click', (e) => {
            if (!dropdownMenu.contains(e.target) && !menuBtn.contains(e.target)) {
                dropdownMenu.classList.remove('active');
            }
        });
    }

    // Logout
    document.getElementById('logoutBtn')?.addEventListener('click', async () => {
        const supa = getSupabase();
        if (supa) await supa.auth.signOut();
        localStorage.clear();
        window.location.replace('/');
    });

    // بدء العمليات
    window.checkAuth();
    window.checkServer();
    setInterval(window.checkServer, 30000);

    // مراقبة تغييرات الجلسة
    setTimeout(() => {
        const supa = getSupabase();
        if (!supa) return;
        supa.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_IN' && session) {
                window.checkAuth();
            } else if (event === 'SIGNED_OUT') {
                localStorage.removeItem('token');
                localStorage.removeItem('sl_user_cache');
                window.updateDropdownUI(null);
            }
        });
    }, 300);
});

// ── 5. Utils ──
window.showToast = function(msg, type) {
    const t = document.getElementById('toasts');
    if (!t) return;
    const box = document.createElement('div');
    box.className   = 'toast ' + (type === 'error' ? 'error' : 'success');
    box.textContent = msg;
    t.appendChild(box);
    setTimeout(() => box.remove(), 4000);
};

window.escapeHtml = function(u) {
    return String(u || '').replace(/[&<>"']/g, m => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
    }[m]));
    // في نهاية ملف shared.js
window._supabaseClient = getSupabase();
};
