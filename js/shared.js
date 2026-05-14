// js/shared.js - V33.5 (Unified Menu Fix + Supabase Defined)

const API_BASE     = window.APP_CONFIG?.API_BASE     || 'https://api.glotix.ai';
const SUPABASE_URL = window.APP_CONFIG?.SUPABASE_URL || 'https://ckjkkxrlgisjdolwddfg.supabase.co';
const SUPABASE_KEY = window.APP_CONFIG?.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNramtreHJsZ2lzamRvbHdkZGZnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0NjU0OTUsImV4cCI6MjA5MzA0MTQ5NX0.F-4TbmO6_7plPm8NBr_6djCv6gtEPpWFw9J7m8vTs6M';

window.API_BASE = API_BASE;
let _domReady = false;
let _isFetchingCredits = false;
let supabaseClient = null;

// 1. تعريف الدالة الأساسية (يجب أن تكون في الأعلى)
function getSupabase() {
    if (supabaseClient) return supabaseClient;
    if (window.supabase) {
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
            auth: { flowType: 'implicit' }
        });
    }
    return supabaseClient;
}
window.getSupabase = getSupabase;

// 2. كود تشغيل القائمة (Menu) - معزول لضمان عدم تعطل الزر
function initMenuDropdown() {
    const menuBtn = document.getElementById('menuBtn');
    const menuDropdown = document.getElementById('mainMenuDropdown');
    if (!menuBtn || !menuDropdown) return;

    menuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        menuDropdown.classList.toggle('active');
    });

    document.addEventListener('click', (e) => {
        if (!menuDropdown.contains(e.target) && !menuBtn.contains(e.target)) {
            menuDropdown.classList.remove('active');
        }
    });
}

// 3. تحديث واجهة المستخدم
window.updateDropdownUI = function(user) {
    const userMenu  = document.getElementById('userMenu');
    const guestMenu = document.getElementById('guestMenu');
    const credits   = document.getElementById('menuCredits');
    
    if (user && user.id) {
        if (guestMenu) guestMenu.style.display = 'none';
        if (userMenu)  userMenu.style.display  = 'block';
        if (credits)   credits.textContent     = user.credits || '...';
    } else {
        if (guestMenu) guestMenu.style.display = 'flex';
        if (userMenu)  userMenu.style.display  = 'none';
    }
};

// 4. مزامنة المصادقة والرصيد
window.checkAuth = async function() {
    try {
        const supa = getSupabase(); // استدعاء آمن الآن
        if (!supa) return;

        const { data: { session } } = await supa.auth.getSession();
        if (!session) return window.updateDropdownUI(null);

        localStorage.setItem('token', session.access_token);
        
        if (!_isFetchingCredits) {
            _isFetchingCredits = true;
            try {
                const res = await fetch(`${API_BASE}/api/user/credits`, {
                    headers: { 
                        'Authorization': `Bearer ${session.access_token}`,
                        'X-User-Id': session.user.id 
                    },
                    signal: AbortSignal.timeout(15000)
                });
                const d = await res.json();
                if (d.success) {
                    const userData = { id: session.user.id, name: 'User', credits: d.credits };
                    window.updateDropdownUI(userData);
                }
            } catch(e) { console.warn("Credits fetch timeout"); }
            finally { setTimeout(() => { _isFetchingCredits = false; }, 10000); }
        }
    } catch(e) { console.error('Auth Sync Error:', e); }
};

// 5. التشغيل عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', () => {
    _domReady = true;
    
    // تشغيل القائمة أولاً لضمان عدم تعطلها
    initMenuDropdown();
    
    // ثم فحص المصادقة
    window.checkAuth();
});
