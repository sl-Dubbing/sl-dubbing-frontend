const API_BASE = window.API_BASE || 'https://web-production-14a1.up.railway.app'; 
const SUPABASE_URL = 'https://ckjkkxrlgisjdolwddfg.supabase.co';
const SUPABASE_KEY = 'sb_publishable_vS3koY6oKGMH16u1DdtLrg_PC83FaHW';
const USER_CACHE_KEY = 'sl_user_cache';

window.API_BASE = API_BASE;

let supabaseClient = null;
async function getSupabase() {
    if (supabaseClient) return supabaseClient;
    if (!window.supabase) {
        await new Promise((resolve, reject) => {
            const s = document.createElement('script');
            s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
            s.onload = resolve; s.onerror = reject;
            document.head.appendChild(s);
        });
    }
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    return supabaseClient;
}

async function checkAuth() {
    const cached = JSON.parse(localStorage.getItem(USER_CACHE_KEY) || 'null');
    if (cached && typeof window.updateDropdownUI === 'function') {
        window.updateDropdownUI(cached);
    }

    try {
        const supa = await getSupabase();
        const { data: { session } } = await supa.auth.getSession();

        if (!session) {
            localStorage.removeItem('token');
            localStorage.removeItem(USER_CACHE_KEY);
            if (typeof window.updateDropdownUI === 'function') window.updateDropdownUI(null);
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
                credits: d.success ? d.credits : (d.credits !== undefined ? d.credits : '...')
            };
            
            localStorage.setItem(USER_CACHE_KEY, JSON.stringify(userData));
            
            if (typeof window.updateDropdownUI === 'function') {
                window.updateDropdownUI(userData);
            }
        }
    } catch (e) {
        console.warn('Auth Sync Failed:', e);
    }
}

async function logout() {
    const supa = await getSupabase();
    await supa.auth.signOut();
    localStorage.clear();
    location.replace('/'); 
}

function escapeHtml(u) { 
    return String(u||'').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#039;"}[m])); 
}

function showToast(msg, type) {
    const t = document.getElementById('toasts');
    if (!t) { alert(msg); return; }
    const box = document.createElement('div');
    box.className = 'toast ' + (type === 'error' ? 'error' : 'success');
    box.textContent = msg;
    t.appendChild(box);
    setTimeout(() => box.remove(), 4000);
}

document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    getSupabase().then(supa => {
        supa.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
                checkAuth(); 
            } else if (event === 'SIGNED_OUT') {
                localStorage.removeItem('token');
                localStorage.removeItem(USER_CACHE_KEY);
                if (typeof window.updateDropdownUI === 'function') window.updateDropdownUI(null);
            }
        });
    });
});

window.checkAuth = checkAuth;
window.logout = logout;
window.escapeHtml = escapeHtml;
window.showToast = showToast;
