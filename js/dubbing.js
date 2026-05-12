// js/shared.js - V28

const API_BASE     = window.APP_CONFIG?.API_BASE     || 'https://api.glotix.ai';
const SUPABASE_URL = window.APP_CONFIG?.SUPABASE_URL || 'https://ckjkkxrlgisjdolwddfg.supabase.co';
const SUPABASE_KEY = window.APP_CONFIG?.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNramtreHJsZ2lzamRvbHdkZGZnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0NjU0OTUsImV4cCI6MjA5MzA0MTQ5NX0.F-4TbmO6_7plPm8NBr_6djCv6gtEPpWFw9J7m8vTs6M';

window.API_BASE = API_BASE;

let _domReady = false;
let _pendingAuth = false;

let supabaseClient = null;
let _previewUrl    = null;  // لتتبع blob URL وإلغائه لتفادي تسريب الذاكرة

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
            localStorage.removeItem('token');
            localStorage.removeItem('sl_user_cache');
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
            console.warn('Credits fetch failed, ignoring.');
        }

        const userData = {
            id:      session.user.id,
            email:   session.user.email,
            name:    session.user.user_metadata?.full_name ||
                     session.user.user_metadata?.name ||
                     session.user.email?.split('@')[0] || 'User',
            avatar:  session.user.user_metadata?.avatar_url ||
                     session.user.user_metadata?.picture ||
                     `https://ui-avatars.com/api/?name=${encodeURIComponent(
                         session.user.email?.split('@')[0] || 'U'
                     )}&background=0f0f10&color=fff&size=64`,
            credits: userCredits
        };
        localStorage.setItem('sl_user_cache', JSON.stringify(userData));
        window.updateDropdownUI(userData);

    } catch(e) {
        console.error('Auth sync error:', e);
    }
};

// ── 4. سجّل onAuthStateChange فوراً ──
window._supabaseClient = getSupabase();

if (window._supabaseClient) {
    window._supabaseClient.auth.onAuthStateChange((event, session) => {
        console.log('Supabase Auth Event:', event);

        // SIGNED_IN = Google OAuth أو Email login
        // INITIAL_SESSION = عودة من Google OAuth مع token في الـ hash
        if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
            if (session) {
                window.history.replaceState(null, '', window.location.pathname);
                if (_domReady) {
                    window.checkAuth();
                } else {
                    _pendingAuth = true;
                }
            }
        } else if (event === 'SIGNED_OUT') {
            localStorage.removeItem('token');
            localStorage.removeItem('sl_user_cache');
            if (_domReady) window.updateDropdownUI(null);
        }
    });
}

// ── 5. Global Event Listeners ──
document.addEventListener('DOMContentLoaded', () => {
    _domReady = true;

    if (_pendingAuth) {
        _pendingAuth = false;
        window.checkAuth();
        // لا نوقف التنفيذ — نكمل لتسجيل الأحداث
    } else {
        window.checkAuth();
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

    // Server Status
    window.checkServer();
    setInterval(window.checkServer, 300000);
});

// ── 6. Utils ──
window.showToast = function(msg, type) {
    const t = document.getElementById('toasts');
    if (!t) return;
    const box       = document.createElement('div');
    box.className   = 'toast ' + (type === 'error' ? 'error' : 'success');
    box.textContent = msg;
    t.appendChild(box);
    setTimeout(() => box.remove(), 4000);
};

window.escapeHtml = function(u) {
    return String(u || '').replace(/[&<>"']/g, m => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
    }[m]));
};

// ═══════════════════════════════════════════════════════════════
// ── 7. Media Preview (معاينة الوسائط) ──
//    يتضمن إصلاح تسريب الذاكرة + فحوصات وقائية + دعم لوحة المفاتيح
// ═══════════════════════════════════════════════════════════════

(function initMediaPreview() {
    // ── جلب العناصر بشكل آمن ──
    const mediaFile    = document.getElementById('mediaFile');
    const previewArea  = document.getElementById('previewArea');
    const videoPreview = document.getElementById('videoPreview');
    const audioLabel   = document.getElementById('audioLabel');
    const audioFileName= document.getElementById('audioFileName');
    const dropZone     = document.getElementById('dropZone');
    const dubBtn       = document.getElementById('dubBtn');

    // ── دعم لوحة المفاتيح لمنطقة الإفلات (Keyboard Accessibility) ──
    if (dropZone) {
        dropZone.setAttribute('tabindex', '0');
        dropZone.setAttribute('role', 'button');
        dropZone.setAttribute('aria-label', 'Upload media file');
        dropZone.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                if (mediaFile) mediaFile.click();
            }
        });
    }

    // ── معالج اختيار الملف — مع إلغاء الـ URL القديم لتفادي تسريب الذاكرة ──
    if (mediaFile) {
        mediaFile.addEventListener('change', (e) => {
            const file = e.target.files?.[0];
            if (!file) return;

            // 1) إلغاء الـ URL القديم إن وجد
            if (_previewUrl) {
                URL.revokeObjectURL(_previewUrl);
                _previewUrl = null;
            }

            // 2) إنشاء blob URL جديد
            _previewUrl = URL.createObjectURL(file);

            const isVideo = file.type.startsWith('video/');
            const isAudio = file.type.startsWith('audio/');

            if (isVideo && videoPreview && previewArea && dropZone && dubBtn) {
                videoPreview.src = _previewUrl;
                videoPreview.style.display = 'block';
                previewArea.style.display  = 'block';
                dropZone.style.display     = 'none';
                dubBtn.style.display       = 'inline-flex';

                // إبطال الـ URL بعد تحميل الميتاداتا (المتصفح يحتفظ بالبيانات)
                videoPreview.onloadedmetadata = () => {
                    if (_previewUrl) {
                        URL.revokeObjectURL(_previewUrl);
                        _previewUrl = null;
                    }
                };
            }

            if (isAudio && audioLabel && audioFileName && previewArea && dropZone && dubBtn) {
                audioFileName.textContent = file.name;
                audioLabel.style.display  = 'block';
                previewArea.style.display = 'block';
                dropZone.style.display    = 'none';
                dubBtn.style.display      = 'inline-flex';
            }
        });
    }

    // ── دالة إعادة تعيين المعاينة (يمكن استدعاؤها من أي مكان) ──
    window.resetMediaPreview = function() {
        if (_previewUrl) {
            URL.revokeObjectURL(_previewUrl);
            _previewUrl = null;
        }
        if (previewArea)   previewArea.style.display   = 'none';
        if (dropZone)      dropZone.style.display      = 'block';
        if (dubBtn)        dubBtn.style.display        = 'none';
        if (videoPreview)  { videoPreview.src = ''; videoPreview.style.display = 'none'; }
        if (audioLabel)    audioLabel.style.display    = 'none';
        if (mediaFile)     mediaFile.value = '';
    };
})();
