// js/shared.js - V33.7 (Dropdown: avatar/name, guest auth hidden; credits + X-User-Id)

/** قاعدة الـ API بدون سلاش زائد — يمنع // في المسارات ويُحسّن توافق الروابط */
const API_BASE = String(window.APP_CONFIG?.API_BASE || 'https://api.glotix.ai')
    .replace(/\/$/, '')
    .replace(/([^:]\/)\/+/g, '$1');

window.API_BASE = API_BASE;

/** فك base64url لجزء الـ JWT كـ UTF-8 (atob وحده لا يكفي لمحتوى JSON فيه أحرف غير ASCII) */
function jwtPayloadJsonFromPart(b64) {
    let b64norm = b64.replace(/-/g, '+').replace(/_/g, '/');
    while (b64norm.length % 4) b64norm += '=';
    const binary = atob(b64norm);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    if (typeof TextDecoder !== 'undefined') {
        return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
    }
    return binary;
}

/** استخراج `sub` من JWT (Supabase) — لاستخدامه في هيدر X-User-Id */
window.parseJwtSub = function parseJwtSub(token) {
    if (!token || typeof token !== 'string') return null;
    try {
        const parts = token.split('.');
        if (parts.length < 2) return null;
        const payload = JSON.parse(jwtPayloadJsonFromPart(parts[1]));
        return payload.sub ? String(payload.sub) : null;
    } catch (e) {
        return null;
    }
};

/** هيدرات مطلوبة لمسارات الـ API المحمية (مثل /api/upload-url) */
window.getApiAuthHeaders = function getApiAuthHeaders() {
    const token = localStorage.getItem('token');
    if (!token) return null;
    const userId = window.parseJwtSub(token);
    if (!userId) return null;
    return {
        'Authorization': 'Bearer ' + token,
        'X-User-Id': userId
    };
};

window.clearSessionAndGuestUI = function clearSessionAndGuestUI(message) {
    localStorage.removeItem('token');
    window.updateDropdownUI(null);
    if (message) window.showToast?.(message, 'error');
};

let _isFetchingCredits = false;
let supabaseClient = null;

function requireSupabaseConfig() {
    const url = window.APP_CONFIG && window.APP_CONFIG.SUPABASE_URL;
    const key = window.APP_CONFIG && window.APP_CONFIG.SUPABASE_KEY;
    if (!url || !key) {
        const err = new Error('[shared] APP_CONFIG must define SUPABASE_URL and SUPABASE_KEY');
        console.error(err.message);
        throw err;
    }
    return { url: String(url), key: String(key) };
}

/** عميل Supabase — معرّف على window من أول السطر حتى لا يفشل onclick للقائمة قبل اكتمال التحميل */
window.getSupabase = function getSupabase() {
    if (supabaseClient) return supabaseClient;
    if (typeof window.supabase !== 'undefined' && window.supabase && typeof window.supabase.createClient === 'function') {
        const { url, key } = requireSupabaseConfig();
        supabaseClient = window.supabase.createClient(url, key, {
            auth: { flowType: 'implicit' }
        });
    }
    return supabaseClient;
};

/** مهلة 15 ثانية مع تنظيف المؤقت في المتصفحات التي لا تدعم AbortSignal.timeout */
function creditsFetchSignal(ms) {
    if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
        return { signal: AbortSignal.timeout(ms), dispose: function () {} };
    }
    const c = new AbortController();
    const t = setTimeout(function () { c.abort(); }, ms);
    return {
        signal: c.signal,
        dispose: function () { clearTimeout(t); }
    };
}

const DEFAULT_MENU_AVATAR = 'https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y';

/** استخراج الاسم وصورة العرض من مستخدم Supabase للقائمة */
function menuProfileFromSupabaseUser(su) {
    if (!su || !su.id) return null;
    const meta = su.user_metadata || {};
    const name = meta.full_name || meta.name || meta.preferred_username
        || (su.email && String(su.email).split('@')[0])
        || 'User';
    const avatarUrl = meta.avatar_url || meta.picture
        || ('https://ui-avatars.com/api/?name=' + encodeURIComponent(name) + '&size=128&background=334155&color=fff');
    return { id: su.id, name: String(name), avatarUrl: String(avatarUrl), credits: '...' };
}

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
    const userMenu     = document.getElementById('userMenu');
    const guestMenu    = document.getElementById('guestMenu');
    const credits      = document.getElementById('menuCredits');
    const menuAvatar   = document.getElementById('menuAvatar');
    const menuUserName = document.getElementById('menuUserName');

    if (user && user.id) {
        if (guestMenu) guestMenu.style.display = 'none';
        if (userMenu)  userMenu.style.display  = 'block';
        if (menuUserName) menuUserName.textContent = user.name || 'My Account';
        if (menuAvatar) {
            menuAvatar.src = user.avatarUrl || DEFAULT_MENU_AVATAR;
            menuAvatar.alt = user.name || 'User';
        }
        if (credits && user.credits !== undefined && user.credits !== null) {
            credits.textContent = user.credits === '...' ? '...' : String(user.credits);
        }
    } else {
        if (guestMenu) guestMenu.style.display = 'flex';
        if (userMenu)  userMenu.style.display  = 'none';
        if (credits) credits.textContent = '...';
        if (menuAvatar) {
            menuAvatar.src = DEFAULT_MENU_AVATAR;
            menuAvatar.alt = 'User';
        }
        if (menuUserName) menuUserName.textContent = 'My Account';
    }
};

// 4. مزامنة المصادقة والرصيد
window.checkAuth = async function() {
    try {
        const supa = window.getSupabase();
        if (!supa) return;

        const { data: { session } } = await supa.auth.getSession();
        if (!session) return window.updateDropdownUI(null);

        localStorage.setItem('token', session.access_token);

        const baseUser = menuProfileFromSupabaseUser(session.user);
        if (baseUser) window.updateDropdownUI(baseUser);

        if (!_isFetchingCredits) {
            _isFetchingCredits = true;
            try {
                const cts = creditsFetchSignal(15000);
                try {
                    const userId = String(session.user.id);
                    const authHeaders = {
                        'Authorization': `Bearer ${session.access_token}`,
                        'X-User-Id': userId
                    };
                    const initKey = 'sl_user_inited_' + userId;
                    if (!sessionStorage.getItem(initKey)) {
                        const initRes = await fetch(`${API_BASE}/api/user/init`, {
                            method: 'POST',
                            headers: authHeaders,
                            signal: cts.signal
                        });
                        if (initRes.status === 401) {
                            window.clearSessionAndGuestUI('Session expired — please sign in again');
                            return;
                        }
                        if (initRes.ok) sessionStorage.setItem(initKey, '1');
                    }
                    const res = await fetch(`${API_BASE}/api/user/credits`, {
                        headers: authHeaders,
                        signal: cts.signal
                    });
                    if (res.status === 401) {
                        window.clearSessionAndGuestUI('Session expired — please sign in again');
                        return;
                    }
                    const d = await res.json();
                    if (d.success && baseUser) {
                        window.updateDropdownUI(Object.assign({}, baseUser, { credits: d.credits }));
                    }
                } finally {
                    cts.dispose();
                }
            } catch (e) {
                if (e && e.name === 'AbortError') console.warn('Credits fetch timeout or aborted');
                else console.warn('Credits fetch error', e);
            } finally {
                _isFetchingCredits = false;
            }
        }
    } catch(e) { console.error('Auth Sync Error:', e); }
};

// 5. التشغيل عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', () => {
    // تشغيل القائمة أولاً لضمان عدم تعطلها
    initMenuDropdown();

    // ثم فحص المصادقة
    window.checkAuth();
});
