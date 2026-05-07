// shared.js — V11.0 (Fixed Cache Trap & API Paths)
const API_BASE = 'https://web-production-14a1.up.railway.app';
const SUPABASE_URL = 'https://ckjkkxrlgisjdolwddfg.supabase.co';
const SUPABASE_KEY = 'sb_publishable_vS3koY6oKGMH16u1DdtLrg_PC83FaHW';
const USER_CACHE_KEY = 'sl_user_cache';

window.API_BASE = API_BASE;

// =================================
// 🔌 تحميل Supabase
// =================================
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

// =================================
// 🎨 رسم الواجهة
// =================================
function renderAuthUI(user) {
    const authSection = document.getElementById('authSection');
    const topBadge = document.getElementById('topAccountBadge');

    if (!user) {
        if (authSection) authSection.innerHTML = `<div style="text-align:center;padding:8px;"><a href="login.html" class="btn-login-sidebar">تسجيل الدخول</a></div>`;
        if (topBadge) topBadge.innerHTML = `<a href="login.html" style="color:inherit;text-decoration:none;"><i class="fas fa-sign-in-alt"></i> دخول</a>`;
        return;
    }

    const credits = user.credits ?? "...";
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
// 🚀 المصادقة الذكية (المحسّنة)
// =================================
async function checkAuth() {
    // 1. عرض الـ Cache أولاً للسرعة
    const cached = JSON.parse(localStorage.getItem(USER_CACHE_KEY) || 'null');
    if (cached) renderAuthUI(cached);

    try {
        const supa = await getSupabase();
        const { data: { session } } = await supa.auth.getSession();

        if (!session) {
            localStorage.removeItem('token');
            localStorage.removeItem(USER_CACHE_KEY);
            renderAuthUI(null);
            return;
        }

        localStorage.setItem('token', session.access_token);

        // 2. جلب الرصيد الحقيقي من Railway دائماً (بدون حجز Cache)
        const res = await fetch(`${API_BASE}/api/user`, {
            headers: { 'Authorization': `Bearer ${session.access_token}` }
        });

        if (res.ok) {
            const d = await res.json();
            if (d?.user) {
                const userData = {
                    id: session.user.id,
                    email: session.user.email,
                    name: session.user.user_metadata?.full_name || session.user.email?.split('@')[0],
                    credits: d.user.credits // الرصيد القادم من داتابيز Railway
                };
                localStorage.setItem(USER_CACHE_KEY, JSON.stringify(userData));
                renderAuthUI(userData);
            }
        }
    } catch (e) {
        console.warn('Auth Sync Failed:', e);
    }
}

// بقية الدوال (Toast, Sidebar, Logout) تبقى كما هي...
function showToast(msg, color) {
    const t = document.getElementById('toasts');
    if (!t) { alert(msg); return; }
    const box = document.createElement('div');
    box.className = 'toast';
    box.textContent = msg;
    if (color === 'error') box.style.background = '#ff3b30';
    else if (color === 'success') box.style.background = '#34c759';
    t.appendChild(box);
    setTimeout(() => box.remove(), 4000);
}

function escapeHtml(u) { return String(u||'').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#039;"}[m])); }

function toggleSidebar() { 
    const s = document.getElementById('sidebar');
    if(s?.classList.contains('active')) closeSidebar(); else openSidebar();
}
function openSidebar() { document.getElementById('sidebar')?.classList.add('active'); document.getElementById('overlay')?.classList.add('active'); }
function closeSidebar() { document.getElementById('sidebar')?.classList.remove('active'); document.getElementById('overlay')?.classList.remove('active'); }

async function logout() {
    const supa = await getSupabase();
    await supa.auth.signOut();
    localStorage.clear();
    location.href = 'index.html';
}

document.addEventListener('DOMContentLoaded', checkAuth);
window.showToast = showToast; window.toggleSidebar = toggleSidebar; window.logout = logout; window.checkAuth = checkAuth;
