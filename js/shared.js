// shared.js — V13.0 (New Light Theme & Railway Backend)

// 1. توجيه الـ API إلى Railway لتخطي مشكلة CORS وجلب الرصيد
const API_BASE = window.API_BASE || 'https://web-production-14a1.up.railway.app'; 
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
// 🚀 2. جلب البيانات والمزامنة (Auth Sync)
// =================================
async function checkAuth() {
    // 1. تحديث الواجهة فوراً من الكاش لتجربة مستخدم سريعة
    const cached = JSON.parse(localStorage.getItem(USER_CACHE_KEY) || 'null');
    if (cached && typeof window.updateDropdownUI === 'function') {
        window.updateDropdownUI(cached);
    }

    try {
        const supa = await getSupabase();
        const { data: { session } } = await supa.auth.getSession();

        // إذا لم يكن مسجلاً للدخول
        if (!session) {
            localStorage.removeItem('token');
            localStorage.removeItem(USER_CACHE_KEY);
            if (typeof window.updateDropdownUI === 'function') window.updateDropdownUI(null);
            return;
        }

        localStorage.setItem('token', session.access_token);

        // جلب الرصيد من السيرفر
        const res = await fetch(`${API_BASE}/api/user/credits`, {
            headers: { 'Authorization': `Bearer ${session.access_token}` }
        });

        if (res.ok) {
            const d = await res.json();
            // تحديث الكاش بالبيانات الجديدة (الرصيد الحي)
            const userData = {
                id: session.user.id,
                email: session.user.email,
                name: session.user.user_metadata?.full_name || session.user.email?.split('@')[0],
                avatar: session.user.user_metadata?.avatar_url || 'https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y',
                credits: d.success ? d.credits : (d.credits !== undefined ? d.credits : '...')
            };
            
            localStorage.setItem(USER_CACHE_KEY, JSON.stringify(userData));
            
            // إرسال البيانات للقائمة المنسدلة الجديدة
            if (typeof window.updateDropdownUI === 'function') {
                window.updateDropdownUI(userData);
            }
        }
    } catch (e) {
        console.warn('Auth Sync Failed:', e);
    }
}

// =================================
// 🚪 3. تسجيل الخروج
// =================================
async function logout() {
    const supa = await getSupabase();
    await supa.auth.signOut();
    localStorage.clear();
    location.replace('/'); // توجيه نظيف للرئيسية
}

// =================================
// 🛠️ 4. أدوات مساعدة (Utils)
// =================================
function escapeHtml(u) { 
    return String(u||'').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#039;"}[m])); 
}

function showToast(msg, type) {
    const t = document.getElementById('toasts');
    if (!t) { alert(msg); return; }
    const box = document.createElement('div');
    
    // استخدام كلاسات الـ CSS الجديدة (success أو error)
    box.className = 'toast ' + (type === 'error' ? 'error' : 'success');
    box.textContent = msg;
    t.appendChild(box);
    
    setTimeout(() => box.remove(), 4000);
}

// =================================
// ⚡ 5. بدء التشغيل
// =================================
document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    
    // مراقبة أي تغيير في الجلسة بالخلفية
    getSupabase().then(supa => {
        supa.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
                checkAuth(); // إعادة جلب الرصيد عند تجديد الدخول
            } else if (event === 'SIGNED_OUT') {
                localStorage.removeItem('token');
                localStorage.removeItem(USER_CACHE_KEY);
                if (typeof window.updateDropdownUI === 'function') window.updateDropdownUI(null);
            }
        });
    });
});

// تصدير الدوال للاستخدام في باقي الملفات
window.checkAuth = checkAuth;
window.logout = logout;
window.escapeHtml = escapeHtml;
window.showToast = showToast;
