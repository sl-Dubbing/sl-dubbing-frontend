// js/shared.js - V23 (Failsafe Auth Sync)

const API_BASE     = window.APP_CONFIG?.API_BASE     || 'https://api.glotix.ai';
const SUPABASE_URL = window.APP_CONFIG?.SUPABASE_URL || 'https://ckjkkxrlgisjdolwddfg.supabase.co';
const SUPABASE_KEY = window.APP_CONFIG?.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNramtreHJsZ2lzamRvbHdkZGZnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0NjU0OTUsImV4cCI6MjA5MzA0MTQ5NX0.F-4TbmO6_7plPm8NBr_6djCv6gtEPpWFw9J7m8vTs6M';

window.API_BASE = API_BASE;

let supabaseClient = null;
function getSupabase() {
    if (supabaseClient) return supabaseClient;
    if (window.supabase) {
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { flowType: 'implicit' } });
    }
    return supabaseClient;
}

// ── 1. تحديث واجهة القائمة ──
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

// ── 2. فحص حالة السيرفر ──
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

// ── 3. مزامنة بيانات المستخدم (تم تحسينها لتتجاهل أخطاء الرصيد) ──
window.checkAuth = async function() {
    const cachedUser = JSON.parse(localStorage.getItem('sl_user_cache') || 'null');
    if (cachedUser) window.updateDropdownUI(cachedUser);

    try {
        const supa = getSupabase();
        if (!supa) return;

        const { data: { session }, error } = await supa.auth.getSession();

        if (!session || error) {
            localStorage.removeItem('token');
            localStorage.removeItem('sl_user_cache');
            window.updateDropdownUI(null);
            return;
        }

        localStorage.setItem('token', session.access_token);

        let currentCredits = '...';
        // محاولة جلب الرصيد، لكن إذا فشلت، لا توقف عرض بيانات المستخدم!
        try {
            const res = await fetch(`${API_BASE}/api/user/credits`, {
                headers: { 'Authorization': `Bearer ${session.access_token}` }
            });
            if (res.ok) {
                const d = await res.json();
                if (d.success) currentCredits = d.credits;
            }
        } catch (apiErr) {
            console.warn('Credits API skipped or failed, using fallback.');
        }

        // تحديث الواجهة بصورة المستخدم واسمه دائماً
        const meta = session.user.user_metadata || {};
        const userData = {
            id:      session.user.id,
            email:   session.user.email,
            name:    meta.full_name || session.user.email?.split('@')[0] || 'User',
            avatar:  meta.avatar_url || meta.picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(session.user.email?.split('@')[0] || 'U')}&background=0f0f10&color=fff&size=64`,
            credits: currentCredits
        };
        
        localStorage.setItem('sl_user_cache', JSON.stringify(userData));
        window.updateDropdownUI(userData);

    } catch(e) {
        console.error('Auth sync error:', e);
    }
};

// ── 4. مشغلات الأحداث عند تحميل الصفحة ──
document.addEventListener('DOMContentLoaded', () => {

    const supa = getSupabase();

    // معالجة الرابط (تنظيفه وتحديث الجلسة)
    const hash = window.location.hash;
    const search = window.location.search;
    
    if (hash.includes('access_token') || search.includes('code=')) {
        // إعطاء مهلة قصيرة لمكتبة Supabase لمعالجة الرابط داخلياً ثم تنظيفه
        setTimeout(() => {
            window.history.replaceState(null, '', window.location.pathname);
            window.checkAuth();
        }, 500);
    } else {
        // تحميل عادي
        window.checkAuth();
    }

    // مراقبة تسجيل الخروج أو الدخول بشكل عام
    if (supa) {
        supa.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_OUT') {
                localStorage.removeItem('token');
                localStorage.removeItem('sl_user_cache');
                window.updateDropdownUI(null);
            } else if (event === 'SIGNED_IN') {
                window.checkAuth();
            }
        });
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

    // زر تسجيل الخروج
    document.getElementById('logoutBtn')?.addEventListener('click', async () => {
        if (supa) await supa.auth.signOut();
        localStorage.clear();
        window.location.reload();
    });

    window.checkServer();
    setInterval(window.checkServer, 300000); // فحص كل 5 دقائق

    // ── 6. معالجة رفع ومعاينة الوسائط ──
    const mediaFile     = document.getElementById('mediaFile');
    const previewArea   = document.getElementById('previewArea');
    const videoPreview  = document.getElementById('videoPreview');
    const audioLabel    = document.getElementById('audioPreviewLabel');
    const audioFileName = document.getElementById('audioFileName');
    const dropZone      = document.getElementById('dropZone');
    const dubBtn        = document.getElementById('dubBtn');

    if (mediaFile) {
        mediaFile.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (!file) return;

            const url = URL.createObjectURL(file);

            if (previewArea) previewArea.style.display = 'block';   // إظهار منطقة المعاينة
            if (dropZone)    dropZone.style.display    = 'none';    // إخفاء منطقة الرفع

            if (file.type.startsWith('video/')) {
                if (videoPreview) videoPreview.style.display = 'block';
                if (audioLabel)   audioLabel.style.display   = 'none';
                if (videoPreview) videoPreview.src           = url;
            } else if (file.type.startsWith('audio/')) {
                if (videoPreview) videoPreview.style.display = 'none';
                if (audioLabel)   audioLabel.style.display   = 'block';
                if (audioFileName) audioFileName.textContent = file.name;
            }

            if (dubBtn) dubBtn.style.display = 'block';
        });
    }

    // ── 7. معالجة Drag & Drop ──
    if (dropZone) {
        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.style.borderColor = 'var(--accent-blue)';
        });

        dropZone.addEventListener('dragleave', () => {
            dropZone.style.borderColor = 'var(--border-color)';
        });

        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.style.borderColor = 'var(--border-color)';
            const file = e.dataTransfer.files[0];
            if (!file) return;

            // إعادة استخدام نفس منطق الـ change event
            const dt = new DataTransfer();
            dt.items.add(file);
            if (mediaFile) {
                mediaFile.files = dt.files;
                mediaFile.dispatchEvent(new Event('change'));
            }
        });
    }
});

// ── 5. أدوات عامة ──
window.showToast = function(msg, type) {
    const t = document.getElementById('toasts');
    if (!t) return;
    const box       = document.createElement('div');
    box.className   = 'toast ' + (type === 'error' ? 'error' : 'success');
    box.textContent = msg;
    t.appendChild(box);
    setTimeout(() => box.remove(), 4000);
};

window._supabaseClient = getSupabase();
