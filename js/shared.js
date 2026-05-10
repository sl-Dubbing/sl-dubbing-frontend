// shared.js — V12.0 (تم الربط بالدومين الرسمي 🚀)
// نعتمد على الدومين الموجود في config.js
const API_BASE = window.API_BASE || 'https://api.glotix.ai'; 
const SUPABASE_URL = 'https://ckjkkxrlgisjdolwddfg.supabase.co';
const SUPABASE_KEY = 'sb_publishable_vS3koY6oKGMH16u1DdtLrg_PC83FaHW';
const USER_CACHE_KEY = 'sl_user_cache';

window.API_BASE = API_BASE;

// =================================
// 🔌 1. تهيئة Supabase
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
// 🎨 2. رسم واجهة المستخدم
// =================================
function renderAuthUI(user) {
    const authSection = document.getElementById('authSection');
    const topBadge = document.getElementById('topAccountBadge');

    if (!user) {
        if (authSection) authSection.innerHTML = `<div style="text-align:center;padding:8px;"><a href="/login" class="btn-login-sidebar">تسجيل الدخول</a></div>`;
        if (topBadge) topBadge.innerHTML = `<a href="/login" style="color:inherit;text-decoration:none;"><i class="fas fa-sign-in-alt"></i> دخول</a>`;
        return;
    }

    const credits = (user.credits !== undefined) ? user.credits : "...";
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
// 🚀 3. جلب البيانات من السيرفر
// =================================
async function checkAuth() {
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

        const res = await fetch(`${API_BASE}/api/user/credits`, {
            headers: { 'Authorization': `Bearer ${session.access_token}` }
        });

        if (res.ok) {
            const d = await res.json();
            if (d?.success) {
                const userData = {
                    id: session.user.id,
                    email: session.user.email,
                    name: session.user.user_metadata?.full_name || session.user.email?.split('@')[0],
                    credits: d.credits
                };
                localStorage.setItem(USER_CACHE_KEY, JSON.stringify(userData));
                renderAuthUI(userData);
            }
        }
    } catch (e) {
        console.warn('Auth Sync Failed:', e);
    }
}

// =================================
// 📱 4. منطق القائمة الجانبية
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
// 🚪 5. تسجيل الخروج
// =================================
async function logout() {
    const supa = await getSupabase();
    await supa.auth.signOut();
    localStorage.clear();
    location.href = '/'; // 👈 تم إزالة index.html ليكون الرابط نظيفاً
}

// =================================
// 🛠️ 6. الربط والتشغيل
// =================================
document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    const menuBtn = document.getElementById('menuBtn') || document.getElementById('menuToggle') || document.querySelector('.menu-icon');
    if (menuBtn) menuBtn.addEventListener('click', (e) => { e.preventDefault(); toggleSidebar(); });
    const overlay = document.getElementById('overlay');
    if (overlay) overlay.addEventListener('click', closeSidebar);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSidebar(); });
});

function escapeHtml(u) { return String(u||'').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#039;"}[m])); }
function showToast(msg, color) {
    const t = document.getElementById('toasts');
    if (!t) { alert(msg); return; }
    const box = document.createElement('div');
    box.className = 'toast';
    box.textContent = msg;
    box.style.background = (color === 'error') ? '#ff3b30' : '#34c759';
    t.appendChild(box);
    setTimeout(() => box.remove(), 4000);
}

window.toggleSidebar = toggleSidebar;
window.closeSidebar = closeSidebar;
window.checkAuth = checkAuth;
window.logout = logout;
