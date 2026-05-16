// js/shared.js - V33.9 (401 / fetch errors: guest reset + resilient menu links)

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

/** مسح بيانات المصادقة محلياً + واجهة زائر؛ لا يرمي أخطاء */
window.clearSessionAndGuestUI = function clearSessionAndGuestUI(message) {
    try {
        localStorage.removeItem('token');
        localStorage.removeItem('sl_user_cache');
    } catch (_) {}
    try {
        for (let i = sessionStorage.length - 1; i >= 0; i--) {
            const k = sessionStorage.key(i);
            if (k && k.indexOf('sl_user_inited_') === 0) sessionStorage.removeItem(k);
        }
    } catch (_) {}
    void (async function () {
        try {
            if (typeof window.getSupabase !== 'function') return;
            let supa = null;
            try {
                supa = window.getSupabase();
            } catch (_) {}
            if (supa && supa.auth && typeof supa.auth.signOut === 'function') {
                await supa.auth.signOut();
            }
        } catch (_) {}
    })();
    try {
        if (typeof window.ensureGuestMenuAuthLinks === 'function') window.ensureGuestMenuAuthLinks();
    } catch (_) {}
    try {
        window.updateDropdownUI(null);
    } catch (_) {}
    if (message) window.showToast?.(message, 'error');
};

/** روابط Login / Sign up → login.html (مسار صحيح من أي صفحة) حتى لو فشل الـ API */
window.ensureGuestMenuAuthLinks = function ensureGuestMenuAuthLinks() {
    let loginHref = 'login.html';
    try {
        loginHref = new URL('login.html', window.location.href).href;
    } catch (_) {}
    const guest = document.getElementById('guestMenu');
    if (!guest) return;
    const loginA = guest.querySelector('a.btn-login');
    const signupA = guest.querySelector('a.btn-signup');
    if (loginA) loginA.setAttribute('href', loginHref);
    if (signupA) signupA.setAttribute('href', loginHref);
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
            auth: {
                flowType: 'implicit',
                detectSessionInUrl: true,
                persistSession: true
            }
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

/** يخفي شارة «Checking connection» (#srv / .srv-badge / #srvTxt) بعد نجاح الـ API */
function dismissConnectionCheckingUi() {
    const srv = document.getElementById('srv');
    if (srv) {
        srv.style.display = 'none';
        return;
    }
    const txt = document.getElementById('srvTxt');
    if (txt) {
        const wrap = txt.closest('.srv-badge') || txt.parentElement;
        if (wrap) wrap.style.display = 'none';
        else txt.style.display = 'none';
        return;
    }
    document.querySelectorAll('.srv-badge').forEach(function (el) {
        el.style.display = 'none';
    });
}

/** قراءة الرصيد من أشكال JSON شائعة للـ API (تجنب Object.assign مع credits: undefined) */
function creditsFromApiPayload(d) {
    if (!d || typeof d !== 'object') return null;
    const nested = d.data && typeof d.data === 'object' ? d.data : null;
    const v = d.credits !== undefined && d.credits !== null ? d.credits
        : d.balance !== undefined && d.balance !== null ? d.balance
            : d.credit_balance !== undefined && d.credit_balance !== null ? d.credit_balance
                : nested && nested.credits !== undefined && nested.credits !== null ? nested.credits
                    : nested && nested.balance !== undefined && nested.balance !== null ? nested.balance
                        : null;
    if (v === undefined || v === null) return null;
    return v;
}

function apiPayloadLooksSuccessful(data) {
    return !!(data && (data.success === true || data.success === 'true' || data.ok === true));
}

/** قراءة JSON من استجابة fetch دون أن يتعطل السكربت */
async function fetchResponseJsonSafe(res) {
    try {
        return await res.json();
    } catch (_) {
        return {};
    }
}

/**
 * طلبات /api/user/init ثم /api/user/credits — 401 يُعالج داخلياً دون رمي.
 * أخطاء الشبكة تُرسل للمتصل بـ catch.
 */
async function fetchUserInitAndCredits(session, baseUser, authHeaders, signal) {
    const userId = String(session.user.id);
    const initKey = 'sl_user_inited_' + userId;
    if (!sessionStorage.getItem(initKey)) {
        const initRes = await fetch(`${API_BASE}/api/user/init`, {
            method: 'POST',
            headers: authHeaders,
            signal: signal
        });
        if (initRes.status === 401) {
            window.clearSessionAndGuestUI('Session expired — please sign in again');
            return;
        }
        if (initRes.ok) sessionStorage.setItem(initKey, '1');
    }
    const res = await fetch(`${API_BASE}/api/user/credits`, {
        headers: authHeaders,
        signal: signal
    });
    if (res.status === 401) {
        window.clearSessionAndGuestUI('Session expired — please sign in again');
        return;
    }
    const d = await fetchResponseJsonSafe(res);
    const cred = creditsFromApiPayload(d);
    const okPayload = apiPayloadLooksSuccessful(d) || (res.ok && cred !== null);
    if (baseUser && okPayload) {
        const merged = Object.assign({}, baseUser);
        if (cred !== null) merged.credits = cred;
        window.updateDropdownUI(merged);
        dismissConnectionCheckingUi();
    }
}

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

function initLogoutButton() {
    const btn = document.getElementById('logoutBtn');
    if (!btn || btn.dataset.slLogoutBound === '1') return;
    btn.dataset.slLogoutBound = '1';
    btn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        void (async function () {
            let supa = null;
            try {
                supa = typeof window.getSupabase === 'function' ? window.getSupabase() : null;
            } catch (_) {}
            try {
                if (supa && supa.auth && typeof supa.auth.signOut === 'function') {
                    await supa.auth.signOut();
                }
            } catch (_) {}
            try {
                localStorage.removeItem('token');
                for (let i = sessionStorage.length - 1; i >= 0; i--) {
                    const k = sessionStorage.key(i);
                    if (k && k.indexOf('sl_user_inited_') === 0) sessionStorage.removeItem(k);
                }
            } catch (_) {}
            if (typeof window.updateDropdownUI === 'function') window.updateDropdownUI(null);
            try {
                window.location.href = new URL('login.html', window.location.href).href;
            } catch (_) {
                window.location.reload();
            }
        })();
    });
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
    const logoutBtn    = document.getElementById('logoutBtn');

    if (user && user.id) {
        if (guestMenu) guestMenu.style.display = 'none';
        if (userMenu)  userMenu.style.display  = 'block';
        if (logoutBtn) logoutBtn.style.display = 'flex';
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
        if (logoutBtn) logoutBtn.style.display = 'none';
        if (credits) credits.textContent = '...';
        if (menuAvatar) {
            menuAvatar.src = DEFAULT_MENU_AVATAR;
            menuAvatar.alt = 'User';
        }
        if (menuUserName) menuUserName.textContent = 'My Account';
    }
};

/** انتظار قراءة Supabase لجلسة OAuth في الـ hash (implicit) قبل getSession */
function waitForSupabaseSessionFromUrl(supa, timeoutMs) {
    const hasOAuthHash = window.location.hash && window.location.hash.indexOf('access_token') !== -1;
    if (!hasOAuthHash) return Promise.resolve(null);
    return new Promise(function (resolve) {
        let done = false;
        function finish(session) {
            if (done) return;
            done = true;
            try { sub.unsubscribe(); } catch (_) {}
            clearTimeout(timer);
            resolve(session || null);
        }
        const { data: { subscription: sub } } = supa.auth.onAuthStateChange(function (event, session) {
            if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session) finish(session);
        });
        supa.auth.getSession().then(function (r) {
            if (r.data && r.data.session) finish(r.data.session);
        }).catch(function () {});
        const timer = setTimeout(function () { finish(null); }, timeoutMs || 5000);
    });
}

// 4. مزامنة المصادقة والرصيد
window.checkAuth = async function() {
    try {
        const supa = window.getSupabase();
        if (!supa) {
            try {
                window.ensureGuestMenuAuthLinks();
            } catch (_) {}
            return;
        }

        await waitForSupabaseSessionFromUrl(supa, 5000);

        let { data: { session } } = await supa.auth.getSession();

        // إن وُجد token يدوياً (login بالإيميل) لكن getSession تأخر — لا تعرض واجهة زائر
        if (!session) {
            const cachedToken = localStorage.getItem('token');
            const cachedSub = cachedToken && typeof window.parseJwtSub === 'function'
                ? window.parseJwtSub(cachedToken) : null;
            if (cachedSub) {
                session = {
                    access_token: cachedToken,
                    user: { id: cachedSub, user_metadata: {}, email: '' }
                };
            }
        }

        if (!session) {
            window.updateDropdownUI(null);
            try {
                window.ensureGuestMenuAuthLinks();
            } catch (_) {}
            return;
        }

        if (window.location.hash && window.location.hash.indexOf('access_token') !== -1) {
            try {
                history.replaceState(null, '', window.location.pathname + window.location.search);
            } catch (_) {}
        }

        localStorage.setItem('token', session.access_token);

        const baseUser = menuProfileFromSupabaseUser(session.user);
        if (baseUser) window.updateDropdownUI(baseUser);

        if (!_isFetchingCredits) {
            _isFetchingCredits = true;
            const cts = creditsFetchSignal(15000);
            try {
                const authHeaders = {
                    'Authorization': `Bearer ${session.access_token}`,
                    'X-User-Id': String(session.user.id)
                };
                try {
                    await fetchUserInitAndCredits(session, baseUser, authHeaders, cts.signal);
                } catch (e) {
                    if (e && e.name === 'AbortError') {
                        console.warn('Credits fetch timeout or aborted');
                    } else {
                        console.warn('Credits fetch error', e);
                        try {
                            window.clearSessionAndGuestUI(null);
                        } catch (_) {}
                    }
                }
            } finally {
                try {
                    cts.dispose();
                } catch (_) {}
                _isFetchingCredits = false;
            }
        }
    } catch (e) {
        console.error('Auth Sync Error:', e);
        try {
            window.ensureGuestMenuAuthLinks();
        } catch (_) {}
    }
};

/** فحص اتصال الـ API: طلب init بدون X-User-Id يعيد guest — نعرض Connected فوراً */
window.checkConnection = async function checkConnection() {
    const srv = document.getElementById('srv');
    const srvTxt = document.getElementById('srvTxt');
    function setConnected() {
        if (srvTxt) srvTxt.textContent = 'Connected';
        if (srv) srv.classList.add('on');
    }
    function setFailed(msg) {
        if (srvTxt) srvTxt.textContent = msg || 'Cannot reach API';
        if (srv) srv.classList.remove('on');
    }
    try {
        const res = await fetch(`${API_BASE}/api/user/init`, {
            method: 'POST',
            headers: { Accept: 'application/json' }
        });
        let data = {};
        try {
            data = await res.json();
        } catch (_) { /* empty body */ }
        if (res.ok && apiPayloadLooksSuccessful(data) && data.guest === true) {
            setConnected();
            dismissConnectionCheckingUi();
            return;
        }
        if (res.ok && apiPayloadLooksSuccessful(data)) {
            setConnected();
            dismissConnectionCheckingUi();
            return;
        }
        setFailed(res.status ? 'API error (' + res.status + ')' : 'Unexpected response');
    } catch (e) {
        setFailed('Cannot reach API');
    }
};

// 5. التشغيل عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', () => {
    // تشغيل القائمة أولاً لضمان عدم تعطلها
    initMenuDropdown();
    initLogoutButton();
    try {
        window.ensureGuestMenuAuthLinks();
    } catch (_) {}

    void window.checkConnection();
    void window.checkAuth();
});
