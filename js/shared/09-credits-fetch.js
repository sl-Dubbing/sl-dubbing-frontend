// # FILE frontend/sl-dubbing-frontend-main/js/shared/09-credits-fetch.js
// # AR وحدات مشتركة — auth، credits، menu
// # KW نقاط,credits
// # CONVENTION — FN/AR/KW + # block كل ~6 أسطر — FUNCTION_INDEX.md DOMAIN_INDEX.md
// =====================================================================
// 📒 فهرس الدوال — js/shared/09-credits-fetch.js
// ---------------------------------------------------------------------
//  تجديد_ترويسات_المصادقة_من_Supabase → refreshAuthHeadersFromSupabaseSession
//  جلب_تهيئة_المستخدم_والرصيد_من_API  → fetchUserInitAndCreditsFromApi
// =====================================================================
(function (global) {
  const SL = global.SLShared;
  const H = SL.creditsHelpers;

  /** تجديد_ترويسات_المصادقة_من_Supabase — بعد انتهاء الجلسة محاولة refresh */
  // # FN refreshAuthHeadersFromSupabaseSession
  // # KW نقاط,credits,billing,خصم,مصادقة,auth,JWT,supabase
  async function refreshAuthHeadersFromSupabaseSession(supa, session) {
    // # guard — شرط رفض أو خروج مبكر
    if (!supa?.auth?.getSession) return null;
    // # try — معالجة عملية قد تفشل
    try {
      const {
        data: { session: fresh },
      } = await supa.auth.getSession();
      // # block — معالجة أخطاء
      const s = fresh || session;
      // # guard — شرط رفض أو خروج مبكر
      if (!s?.access_token || !s?.user?.id) return null;
      // # localStorage — تخزين محلي
      localStorage.setItem('token', s.access_token);
      // # return — إرجاع النتيجة
      return {
        Authorization: 'Bearer ' + s.access_token,
        'X-User-Id': String(s.user.id),
      // # block — تحديث واجهة/DOM
      };
    } catch (_) {
      // # return — إرجاع النتيجة
      return null;
    }
  }

  /** جلب_تهيئة_المستخدم_والرصيد_من_API — /api/user/init ثم /api/user/credits */
  // # FN fetchUserInitAndCreditsFromApi
  // # AR النقاط والفوترة (fetchUserInitAndCreditsFromApi)
  // # KW نقاط,credits,billing,خصم
  async function fetchUserInitAndCreditsFromApi(session, baseUser, authHeaders, signal) {
    const supa = typeof global.getSupabase === 'function' ? global.getSupabase() : null;
    const userId = String(session.user.id);
    const initKey = 'sl_user_inited_' + userId;
    const apiBase = SL.apiBase;

    // # FN handle401Unauthorized
    // # KW نقاط,credits,billing,خصم,مصادقة,auth,JWT,supabase
    async function handle401Unauthorized() {
      // # block — قاعدة بيانات
      const refreshed = await refreshAuthHeadersFromSupabaseSession(supa, session);
      // # guard — شرط رفض أو خروج مبكر
      if (refreshed) return refreshed;
      global.clearSessionAndGuestUI('Session expired — please sign in again');
      // # return — إرجاع النتيجة
      return null;
    }

    // # شرط — فرع منطقي
    if (!sessionStorage.getItem(initKey)) {
      // # HTTP — طلب إلى API
      let initRes = await fetch(`${apiBase}/api/user/init`, {
        method: 'POST',
        headers: authHeaders,
        signal: signal,
      });
      // # guard — شرط رفض أو خروج مبكر
      if (initRes.status === 401) {
        // # block — فرع شرطي
        const refreshed = await handle401Unauthorized();
        // # guard — شرط رفض أو خروج مبكر
        if (!refreshed) return;
        authHeaders = refreshed;
        // # HTTP — طلب إلى API
        initRes = await fetch(`${apiBase}/api/user/init`, {
          method: 'POST',
          headers: authHeaders,
          // # block — طلب HTTP/API
          signal: signal,
        });
      }
      // # guard — شرط رفض أو خروج مبكر
      if (initRes.status === 401) {
        global.clearSessionAndGuestUI('Session expired — please sign in again');
        // # return — إرجاع النتيجة
        return;
      // # block — فرع شرطي
      }
      // # شرط — فرع منطقي
      if (H.isTransientServerHttpStatus(initRes.status)) {
        H.logCreditsFetchWarning('/api/user/init HTTP', initRes.status);
      } else if (initRes.ok) {
        sessionStorage.setItem(initKey, '1');
      }
    // # block — نقاط/credits
    }

    // # HTTP — طلب إلى API
    let res = await fetch(`${apiBase}/api/user/credits`, {
      headers: authHeaders,
      signal: signal,
    });
    // # guard — شرط رفض أو خروج مبكر
    if (res.status === 401) {
      // # block — طلب HTTP/API
      const refreshed = await handle401Unauthorized();
      // # guard — شرط رفض أو خروج مبكر
      if (!refreshed) return;
      authHeaders = refreshed;
      // # HTTP — طلب إلى API
      res = await fetch(`${apiBase}/api/user/credits`, {
        headers: authHeaders,
        signal: signal,
      // # block — طلب HTTP/API
      });
    }
    // # guard — شرط رفض أو خروج مبكر
    if (res.status === 401) {
      global.clearSessionAndGuestUI('Session expired — please sign in again');
      // # return — إرجاع النتيجة
      return;
    }
    // # guard — شرط رفض أو خروج مبكر
    if (H.isTransientServerHttpStatus(res.status)) {
      H.logCreditsFetchWarning('/api/user/credits HTTP', res.status);
      H.applyMenuCreditsPlaceholder(baseUser, 'Error');
      // # return — إرجاع النتيجة
      return;
    }
    const d = await H.parseFetchResponseJsonSafe(res);
    // # block — نقاط/credits
    const cred = H.extractCreditsFromApiPayload(d);
    const okPayload = H.apiResponseIndicatesSuccess(d) || (res.ok && cred !== null);
    // # شرط — فرع منطقي
    if (baseUser && okPayload) {
      const merged = Object.assign({}, baseUser);
      // # شرط — فرع منطقي
      if (cred !== null) {
        merged.credits = cred;
        // # block — نقاط/credits
        global.__glotixUserCredits = cred;
      }
      global.updateDropdownUI(merged);
      H.dismissConnectionCheckingUi();
      // # return — إرجاع النتيجة
      return;
    }
    // # شرط — فرع منطقي
    if (baseUser && !res.ok) {
      H.logCreditsFetchWarning('/api/user/credits HTTP', res.status);
      H.applyMenuCreditsPlaceholder(baseUser, 'Error');
    }
  }

  /** تحديث_رصيد_القائمة_فوراً — بعد نجاح دبلجة/TTS (مع إعادة محاولة لانتظار خصم الـ webhook) */
  // # FN refreshUserCreditsInMenu
  // # AR refresh user credits in menu (refreshUserCreditsInMenu)
  // # KW نقاط,credits,billing,خصم
  async function refreshUserCreditsInMenu(options) {
    options = options || {};
    const retryDelays = Array.isArray(options.retryDelays) ? options.retryDelays : [0];

    const supa = typeof global.getSupabase === 'function' ? global.getSupabase() : null;
    let session = null;
    // # شرط — فرع منطقي
    if (supa?.auth?.getSession) {
      // # try — معالجة عملية قد تفشل
      try {
        const { data } = await supa.auth.getSession();
        session = data?.session || null;
      } catch (_) { /* ignore */ }
    }

    // # شرط — فرع منطقي
    if (!session?.access_token) {
      // # localStorage — تخزين محلي
      const token = localStorage.getItem('token');
      const sub =
        token && typeof global.parseJwtSub === 'function' ? global.parseJwtSub(token) : null;
      // # guard — شرط رفض أو خروج مبكر
      if (!token || !sub) return null;
      let meta = {};
      // # try — معالجة عملية قد تفشل
      try {
        // # localStorage — تخزين محلي
        const cached = JSON.parse(localStorage.getItem('sl_user_cache') || '{}');
        meta = {
          full_name: cached.name,
          name: cached.name,
          avatar_url: cached.avatar,
          picture: cached.avatar,
        // # block — تنفيذ منطق — راجع الأسطر التالية
        };
      } catch (_) { /* ignore */ }
      session = {
        access_token: token,
        user: { id: sub, email: '', user_metadata: meta },
      };
    // # block — معالجة أخطاء
    }

    let baseUser = SL.menuUi.buildMenuUserProfileFromSupabaseUser(session.user);
    // # try — معالجة عملية قد تفشل
    try {
      // # localStorage — تخزين محلي
      const cached = JSON.parse(localStorage.getItem('sl_user_cache') || '{}');
      // # شرط — فرع منطقي
      if (cached.name) baseUser.name = cached.name;
      // # شرط — فرع منطقي
      if (cached.avatar) baseUser.avatarUrl = cached.avatar;
    // # block — تحديث واجهة/DOM
    } catch (_) { /* ignore */ }

    const authHeaders = {
      Authorization: 'Bearer ' + session.access_token,
      'X-User-Id': String(session.user.id),
    };

    let lastCredits = null;
    // # block — نقاط/credits
    for (let i = 0; i < retryDelays.length; i++) {
      const delay = retryDelays[i];
      // # شرط — فرع منطقي
      if (delay > 0) await new Promise((r) => setTimeout(r, delay));
      // # try — معالجة عملية قد تفشل
      try {
        // # HTTP — طلب إلى API
        const res = await fetch(`${SL.apiBase}/api/user/credits`, { headers: authHeaders });
        // # شرط — فرع منطقي
        if (res.status === 401) {
          // # block — طلب HTTP/API
          const refreshed = await refreshAuthHeadersFromSupabaseSession(supa, session);
          // # شرط — فرع منطقي
          if (!refreshed) break;
          Object.assign(authHeaders, refreshed);
          continue;
        }
        const d = await H.parseFetchResponseJsonSafe(res);
        // # block — نقاط/credits
        const cred = H.extractCreditsFromApiPayload(d);
        // # شرط — فرع منطقي
        if (cred === null) continue;
        lastCredits = cred;
        const merged = Object.assign({}, baseUser, { credits: cred });
        global.updateDropdownUI(merged);
        // # try — معالجة عملية قد تفشل
        try {
          // # localStorage — تخزين محلي
          const cached = JSON.parse(localStorage.getItem('sl_user_cache') || '{}');
          cached.credits = cred;
          // # شرط — فرع منطقي
          if (!cached.id) cached.id = String(session.user.id);
          // # localStorage — تخزين محلي
          localStorage.setItem('sl_user_cache', JSON.stringify(cached));
        } catch (_) { /* ignore */ }
        // # شرط — فرع منطقي
        if (options.stopAfterFirstSuccess !== false) break;
      // # block — نقاط/credits
      } catch (e) {
        H.logCreditsFetchWarning('refreshUserCredits', e);
      }
    }
    // # return — إرجاع النتيجة
    return lastCredits;
  }

  SL.creditsFetch = {
    refreshAuthHeadersFromSupabaseSession,
    fetchUserInitAndCreditsFromApi,
    refreshUserCreditsInMenu,
  };
  global.refreshUserCredits = refreshUserCreditsInMenu;
})(window);
