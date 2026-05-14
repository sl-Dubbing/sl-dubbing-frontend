// js/shared.js - V33 (Final: Safe Credits + Unified Menu Toggle + Fixed Auth Header)

const API_BASE     = window.APP_CONFIG?.API_BASE     || 'https://api.glotix.ai';
const SUPABASE_URL = window.APP_CONFIG?.SUPABASE_URL || 'https://ckjkkxrlgisjdolwddfg.supabase.co';
const SUPABASE_KEY = window.APP_CONFIG?.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNramtreHJsZ2lzamRvbHdkZGZnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0NjU0OTUsImV4cCI6MjA5MzA0MTQ5NX0.F-4TbmO6_7plPm8NBr_6djCv6gtEPpWFw9J7m8vTs6M';

window.API_BASE = API_BASE;

let _domReady = false;
let _pendingAuth = false;
let _isFetchingCredits = false;

let supabaseClient = null;
let _previewUrl    = null;

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

// ═══════════════════════════════════════════════════════════════
// 1. Update Dropdown UI
// ═══════════════════════════════════════════════════════════════
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

// ═══════════════════════════════════════════════════════════════
// 2. Check Server Status
// ═══════════════════════════════════════════════════════════════
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

// ═══════════════════════════════════════════════════════════════
// 3. Full Auth Sync (Safe Fetch)
// ═══════════════════════════════════════════════════════════════
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

        let userCredits = cachedUser ? cachedUser.credits : '...';

        // --- 🛡️ Safe Fetching Block 🛡️ ---
        if (!_isFetchingCredits) {
            _isFetchingCredits = true;
            try {
                const cleanApiBase = API_BASE.endsWith('/') ? API_BASE.slice(0, -1) : API_BASE;

                // التعديل الرئيسي هنا (إضافة X-User-Id لتجنب الخطأ 401)
                const res = await fetch(`${cleanApiBase}/api/user/credits`, {
                    method: 'GET',
                    headers: { 
                        'Authorization': `Bearer ${session.access_token}`,
                        'X-User-Id': session.user.id
                    },
                    signal: AbortSignal.timeout(5000)
                });

                if (res.ok) {
                    const d = await res.json();
                    if (d.success) {
                        userCredits = d.credits;
                    }
                }
            } catch(e) {
                console.warn('Credits fetch skipped to prevent loop:', e.message);
            } finally {
                setTimeout(() => { _isFetchingCredits = false; }, 10000);
            }
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

// ═══════════════════════════════════════════════════════════════
// 4. Supabase Auth Listener
// ═══════════════════════════════════════════════════════════════
window._supabaseClient = getSupabase();

if (window._supabaseClient) {
    window._supabaseClient.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
            if (session) {
                window.history.replaceState(null, '', window.location.pathname);
                if (_domReady) window.checkAuth();
                else _pendingAuth = true;
            }
        } else if (event === 'SIGNED_OUT') {
            localStorage.removeItem('token');
            localStorage.removeItem('sl_user_cache');
            if (_domReady) window.updateDropdownUI(null);
        }
    });
}

// ═══════════════════════════════════════════════════════════════
// 5. Global Event Listeners (DOMContentLoaded)
// ═══════════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
    _domReady = true;

    if (_pendingAuth) {
        _pendingAuth = false;
        window.checkAuth();
    } else {
        window.checkAuth();
    }

    // ─── Logout ───
    document.getElementById('logoutBtn')?.addEventListener('click', async () => {
        const supa = getSupabase();
        if (supa) await supa.auth.signOut();
        localStorage.clear();
        window.location.replace('/');
    });

    // ─── Server Status ───
    window.checkServer();
    setInterval(window.checkServer, 300000);

    // ═══════════════════════════════════════════════════════════════
    // 6. Menu Dropdown Toggle (موحّد لكل الصفحات)
    // ═══════════════════════════════════════════════════════════════
    (function initMenuDropdown() {
        const menuBtn = document.getElementById('menuBtn');
        const menuDropdown = document.getElementById('mainMenuDropdown');
        if (!menuBtn || !menuDropdown) return;

        // فتح/إغلاق عند الضغط على زر القائمة
        menuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            menuDropdown.classList.toggle('active');
        });

        // إغلاق عند الضغط خارج القائمة
        document.addEventListener('click', (e) => {
            if (!menuDropdown.contains(e.target) && !menuBtn.contains(e.target)) {
                menuDropdown.classList.remove('active');
            }
        });

        // إغلاق عند الضغط على Escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') menuDropdown.classList.remove('active');
        });
    })();

    // ═══════════════════════════════════════════════════════════════
    // 7. Media Preview (للدبلجة والـ STT)
    // ═══════════════════════════════════════════════════════════════
    (function initMediaPreview() {
        const mediaFile     = document.getElementById('mediaFile');
        const previewArea   = document.getElementById('previewArea');
        const videoPreview  = document.getElementById('videoPreview');
        const audioLabel    = document.getElementById('audioPreviewLabel');
        const audioFileName = document.getElementById('audioFileName');
        const dropZone      = document.getElementById('dropZone');
        const dubBtn        = document.getElementById('dubBtn'); // للدبلجة
        const sttBtn        = document.getElementById('sttBtn'); // للـ STT

        if (!mediaFile) return;

        if (dropZone) {
            dropZone.setAttribute('tabindex', '0');
            dropZone.setAttribute('role', 'button');
            dropZone.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); mediaFile.click(); }
            });
        }

        mediaFile.addEventListener('change', (e) => {
            const file = e.target.files?.[0];
            if (!file) return;

            if (_previewUrl) { URL.revokeObjectURL(_previewUrl); _previewUrl = null; }
            _previewUrl = URL.createObjectURL(file);

            if (previewArea) previewArea.style.display = 'block';
            if (dropZone)    dropZone.style.display    = 'none';

            if (file.type.startsWith('video/') && videoPreview) {
                videoPreview.src = _previewUrl;
                videoPreview.style.display = 'block';
                if (audioLabel) audioLabel.style.display = 'none';
                videoPreview.onloadedmetadata = () => {
                    if (_previewUrl) { URL.revokeObjectURL(_previewUrl); _previewUrl = null; }
                };
            } else if (file.type.startsWith('audio/')) {
                if (videoPreview) videoPreview.style.display = 'none';
                if (audioLabel)   audioLabel.style.display   = 'block';
                if (audioFileName) audioFileName.textContent = file.name;
            }

            if (dubBtn) dubBtn.style.display = 'block';
            if (sttBtn) sttBtn.disabled = false;
        });

        window.resetMediaPreview = function() {
            if (_previewUrl) { URL.revokeObjectURL(_previewUrl); _previewUrl = null; }
            if (previewArea)  previewArea.style.display  = 'none';
            if (dropZone)     dropZone.style.display     = 'block';
            if (dubBtn)       dubBtn.style.display       = 'none';
            if (videoPreview) { videoPreview.src = ''; videoPreview.style.display = 'none'; }
            if (audioLabel)   audioLabel.style.display   = 'none';
            mediaFile.value = '';
            if (sttBtn) sttBtn.disabled = true;
        };

        if (dropZone) {
            ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
                dropZone.addEventListener(eventName, (e) => { e.preventDefault(); e.stopPropagation(); }, false);
            });
            dropZone.addEventListener('dragenter', () => { dropZone.style.borderColor = 'var(--accent-blue)'; });
            dropZone.addEventListener('dragleave', () => { dropZone.style.borderColor = 'var(--border-color)'; });
            dropZone.addEventListener('drop', (e) => {
                dropZone.style.borderColor = 'var(--border-color)';
                const file = e.dataTransfer.files[0];
                if (!file) return;
                const dt = new DataTransfer();
                dt.items.add(file);
                mediaFile.files = dt.files;
                mediaFile.dispatchEvent(new Event('change'));
            });
        }
    })();
});

// ═══════════════════════════════════════════════════════════════
// 8. Utils
// ═══════════════════════════════════════════════════════════════
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
