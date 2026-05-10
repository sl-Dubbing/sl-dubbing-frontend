// js/shared.js - V25 (The True Fix - No URL Wipe)

const API_BASE     = window.APP_CONFIG?.API_BASE     || 'https://api.glotix.ai';
const SUPABASE_URL = window.APP_CONFIG?.SUPABASE_URL || 'https://ckjkkxrlgisjdolwddfg.supabase.co';
const SUPABASE_KEY = window.APP_CONFIG?.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNramtreHJsZ2lzamRvbHdkZGZnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0NjU0OTUsImV4cCI6MjA5MzA0MTQ5NX0.F-4TbmO6_7plPm8NBr_6djCv6gtEPpWFw9J7m8vTs6M';

window.API_BASE = API_BASE;

let supabaseClient = null;
function getSupabase() {
    if (supabaseClient) return supabaseClient;
    if (window.supabase) {
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
            auth: { flowType: 'implicit' }
        });
    }
    return supabaseClient;
}

// ── 1. Update Dropdown UI ──
window.updateDropdownUI = function(user) {
    const guestMenu = document.getElementById('guestMenu');
    const userMenu  = document.getElementById('userMenu');
    const logoutBtn = document.getElementById('logoutBtn');
    const userName  = document.getElementById('menuUserName');
    const credits   = document.getElementById('menuCredits');
    const avatar    = document.getElementById('menuAvatar');

    if (user && user.id) {
        if (guestMenu) guestMenu.style.display = 'none';
        if (userMenu)  userMenu.style.display  = 'block';
        if (logoutBtn) logoutBtn.style.display = 'flex';
        if (userName)  userName.textContent    = user.name || 'My Account';
        if (credits)   credits.textContent     = user.credits !== undefined ? user.credits : '...';
        if (avatar && user.avatar) avatar.src  = user.avatar;
    } else {
        if (guestMenu) guestMenu.style.display = 'flex';
        if (userMenu)  userMenu.style.display  = 'none';
        if (logoutBtn) logoutBtn.style.display = 'none';
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
            badge.className = 'srv-badge on';
            txt.textContent = 'Connected to Cloud';
        } else {
            badge.className = 'srv-badge';
            txt.textContent = 'System Offline';
        }
    } catch (e) {
        if (badge) badge.className = 'srv-badge';
        if (txt)   txt.textContent = 'Connection Error';
    }
};

// ── 3. Full Auth Sync ──
window.checkAuth = async function() {
    const cachedUser = JSON.parse(localStorage.getItem('sl_user_cache') || 'null');
    if (cachedUser) window.updateDropdownUI(cachedUser);

    try {
        const supa = getSupabase();
        if (!supa) return;

        const { data: { session }, error } = await supa.auth.getSession();

        if (!session || error) {
            window.updateDropdownUI(null);
            return;
        }

        localStorage.setItem('token', session.access_token);

        let userCredits = '...';
        try {
            const res = await fetch(`${API_BASE}/api/user/credits`, {
                headers: { 'Authorization': `Bearer ${session.access_token}` }
            });
            if (res.ok) {
                const d = await res.json();
                if (d.success) userCredits = d.credits;
            }
        } catch(e) {
            console.warn("Credits fetch failed, ignoring.");
        }

        const userData = {
            id:      session.user.id,
            email:   session.user.email,
            name:    session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'User',
            avatar:  session.user.user_metadata?.avatar_url || session.user.user_metadata?.picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(session.user.email?.split('@')[0] || 'U')}&background=0f0f10&color=fff&size=64`,
            credits: userCredits
        };
        localStorage.setItem('sl_user_cache', JSON.stringify(userData));
        window.updateDropdownUI(userData);

    } catch(e) {
        console.error('Auth sync error:', e);
    }
};

// ── 4. Global Event Listeners ──
document.addEventListener('DOMContentLoaded', () => {

    const supa = getSupabase();

    if (supa) {
        // نترك Supabase يقرأ الرابط براحته أولاً!
        supa.auth.onAuthStateChange((event, session) => {
            console.log("Supabase Auth Event:", event); // ✅ رسالة ستظهر لك في الكونسول لتأكيد الدخول
            
            if (event === 'SIGNED_IN') {
                // بمجرد أن يؤكد Supabase الدخول، نقوم بتنظيف الرابط
                window.history.replaceState(null, '', window.location.pathname);
                window.checkAuth();
            } else if (event === 'SIGNED_OUT') {
                localStorage.clear();
                window.updateDropdownUI(null);
            }
        });
    }

    // جلب البيانات عند التحميل العادي
    window.checkAuth();

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
        if (supa) await supa.auth.signOut();
        localStorage.clear();
        window.location.reload();
    });

    // Start Server Check
    window.checkServer();
    setInterval(window.checkServer, 300000);
});

window._supabaseClient = getSupabase();
