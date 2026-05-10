// js/shared.js - V14 (Centralized Dropdown & Auth)

const API_BASE = window.APP_CONFIG?.API_BASE || 'https://web-production-14a1.up.railway.app';
const SUPABASE_URL = window.APP_CONFIG?.SUPABASE_URL || 'https://ckjkkxrlgisjdolwddfg.supabase.co';
const SUPABASE_KEY = window.APP_CONFIG?.SUPABASE_KEY || 'sb_publishable_vS3koY6oKGMH16u1DdtLrg_PC83FaHW';

window.API_BASE = API_BASE;

let supabaseClient = null;
function getSupabase() {
    if (supabaseClient) return supabaseClient;
    if (window.supabase) {
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    }
    return supabaseClient;
}

// ── 1. Update Dropdown UI ──
window.updateDropdownUI = function(user) {
    const guestMenu = document.getElementById('guestMenu');
    const userMenu = document.getElementById('userMenu');
    const logoutBtn = document.getElementById('logoutBtn');
    const menuUserName = document.getElementById('menuUserName');
    const menuCredits = document.getElementById('menuCredits');
    const menuAvatar = document.getElementById('menuAvatar');

    if (user && user.id) {
        if(guestMenu) guestMenu.style.display = 'none';
        if(userMenu) userMenu.style.display = 'block';
        if(logoutBtn) logoutBtn.style.display = 'flex';
        if(menuUserName) menuUserName.textContent = user.name || 'My Account';
        if(menuCredits) menuCredits.textContent = user.credits !== undefined ? user.credits : '...';
        if(menuAvatar && user.avatar) menuAvatar.src = user.avatar;
    } else {
        if(guestMenu) guestMenu.style.display = 'flex';
        if(userMenu) userMenu.style.display = 'none';
        if(logoutBtn) logoutBtn.style.display = 'none'; 
    }
};

// ── 2. Check Server Status ──
window.checkServer = async function() {
    const badge = document.getElementById('srv');
    const txt = document.getElementById('srvTxt');
    if (!badge || !txt) return;

    try {
        const r = await fetch(API_BASE + '/api/status');
        const data = await r.json();
        if (data.is_online) {
            badge.className = 'srv-badge on';
            txt.textContent = 'Connected to Cloud';
        } else {
            badge.className = 'srv-badge';
            txt.textContent = 'System Offline';
        }
    } catch (e) {
        badge.className = 'srv-badge';
        txt.textContent = 'Connection Error';
    }
};

// ── 3. Sync Auth & Credits ──
window.checkAuth = async function() {
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
                id: session.user.id,
                email: session.user.email,
                name: session.user.user_metadata?.full_name || session.user.email?.split('@')[0],
                avatar: session.user.user_metadata?.avatar_url || 'https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y',
                credits: d.success ? d.credits : '...'
            };
            localStorage.setItem('sl_user_cache', JSON.stringify(userData));
            window.updateDropdownUI(userData);
        }
    } catch(e) {
        console.error("Auth sync error:", e);
    }
};

// ── 4. Setup Event Listeners ──
document.addEventListener('DOMContentLoaded', () => {
    // Dropdown Toggle Logic
    const menuBtn = document.getElementById('menuBtn');
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

    // Logout Logic
    document.getElementById('logoutBtn')?.addEventListener('click', async () => {
        const supa = getSupabase();
        if (supa) await supa.auth.signOut();
        localStorage.clear();
        window.location.replace('/');
    });

    // Start Processes
    window.checkAuth();
    window.checkServer();
    setInterval(window.checkServer, 30000);

    // Monitor Session Changes
    setTimeout(() => {
        const supa = getSupabase();
        if (supa) {
            supa.auth.onAuthStateChange((event, session) => {
                if (session) {
                    setTimeout(() => {
                        const cached = JSON.parse(localStorage.getItem('sl_user_cache') || 'null');
                        if (cached) window.updateDropdownUI(cached);
                    }, 800);
                } else {
                    window.updateDropdownUI(null);
                }
            });
        }
    }, 500); // تأخير بسيط لضمان تحميل Supabase
});

// Utils
window.showToast = function(msg, type) {
    const t = document.getElementById('toasts');
    if (!t) return;
    const box = document.createElement('div');
    box.className = 'toast ' + (type === 'error' ? 'error' : 'success');
    box.textContent = msg;
    t.appendChild(box);
    setTimeout(() => box.remove(), 4000);
};

window.escapeHtml = function(u) { 
    return String(u||'').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#039;"}[m])); 
};
