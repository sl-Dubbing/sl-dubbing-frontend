// # FILE frontend/sl-dubbing-frontend-main/js/shared/12-auth-sync.js
// # AR وحدات مشتركة — auth، credits، menu
// # KW مصادقة,auth
// # CONVENTION — FN/AR/KW + # block كل ~6 أسطر — FUNCTION_INDEX.md DOMAIN_INDEX.md
// =====================================================================
// 📒 فهرس الدوال — js/shared/12-auth-sync.js
// ---------------------------------------------------------------------
//  انتظار_جلسة_OAuth_من_الرابط       → waitForOAuthSessionFromUrlHash
//  مزامنة_المصادقة_والرصيد_مع_الواجهة → syncAuthSessionAndCreditsToUi
// =====================================================================
(function (global) {
  const SL = global.SLShared;
  const H = SL.creditsHelpers;

  /** انتظار_جلسة_OAuth_من_الرابط — قراءة access_token من hash قبل getSession */
  // # FN waitForOAuthSessionFromUrlHash
  // # AR المصادقة والجلسة (waitForOAuthSessionFromUrlHash)
  // # KW مصادقة,auth,JWT,supabase
  function waitForOAuthSessionFromUrlHash(supa, timeoutMs) {
    const hasOAuthHash =
      global.location.hash && global.location.hash.indexOf('access_token') !== -1;
    // # guard — شرط رفض أو خروج مبكر
    if (!hasOAuthHash) return Promise.resolve(null);
    // # return — إرجاع النتيجة
    return new Promise(function (resolve) {
      let done = false;
      // # FN finish
      // # KW مصادقة,auth,JWT,supabase
      function finish(session) {
        // # guard — شرط رفض أو خروج مبكر
        if (done) return;
        done = true;
        // # try — معالجة عملية قد تفشل
        try {
          sub.unsubscribe();
        } catch (_) { /* ignore */ }
        // # block — معالجة أخطاء
        clearTimeout(timer);
        resolve(session || null);
      }
      const {
        data: { subscription: sub },
      } = supa.auth.onAuthStateChange(function (event, session) {
        // # شرط — فرع منطقي
        if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session) finish(session);
      });
      supa.auth
        .getSession()
        .then(function (r) {
          // # شرط — فرع منطقي
          if (r.data?.session) finish(r.data.session);
        // # block — فرع شرطي
        })
        .catch(function () {});
      const timer = setTimeout(function () {
        finish(null);
      }, timeoutMs || 5000);
    });
  }

  /** مزامنة_المصادقة_والرصيد_مع_الواجهة — الجلسة + init/credits API */
  // # FN syncAuthSessionAndCreditsToUi
  // # AR sync auth session and credits to ui (syncAuthSessionAndCreditsToUi)
  // # KW نقاط,credits,billing,خصم,مصادقة,auth,JWT,supabase
  async function syncAuthSessionAndCreditsToUi() {
    // # try — معالجة عملية قد تفشل
    try {
      const supa = global.getSupabase();
      // # شرط — فرع منطقي
      if (!supa) {
        // # try — معالجة عملية قد تفشل
        try {
          global.ensureGuestMenuAuthLinks();
        // # block — معالجة أخطاء
        } catch (_) { /* ignore */ }
        // # return — إرجاع النتيجة
        return;
      }

      await waitForOAuthSessionFromUrlHash(supa, 5000);

      let {
        data: { session },
      // # block — تنفيذ منطق — راجع الأسطر التالية
      } = await supa.auth.getSession();

      // # شرط — فرع منطقي
      if (!session) {
        // # localStorage — تخزين محلي
        const cachedToken = localStorage.getItem('token');
        const cachedSub =
          cachedToken && typeof global.parseJwtSub === 'function'
            ? global.parseJwtSub(cachedToken)
            // # block — تحديث واجهة/DOM
            : null;
        // # شرط — فرع منطقي
        if (cachedSub) {
          session = {
            access_token: cachedToken,
            user: { id: cachedSub, user_metadata: {}, email: '' },
          };
        // # block — فرع شرطي
        }
      }

      // # شرط — فرع منطقي
      if (!session) {
        global.updateDropdownUI(null);
        // # try — معالجة عملية قد تفشل
        try {
          global.ensureGuestMenuAuthLinks();
        // # block — معالجة أخطاء
        } catch (_) { /* ignore */ }
        // # return — إرجاع النتيجة
        return;
      }

      // # شرط — فرع منطقي
      if (global.location.hash && global.location.hash.indexOf('access_token') !== -1) {
        // # try — معالجة عملية قد تفشل
        try {
          history.replaceState(null, '', global.location.pathname + global.location.search);
        // # block — معالجة أخطاء
        } catch (_) { /* ignore */ }
      }

      // # localStorage — تخزين محلي
      localStorage.setItem('token', session.access_token);
      // # try — معالجة عملية قد تفشل
      try {
        // # localStorage — تخزين محلي
        localStorage.setItem(
          'sl_user_cache',
          // # تسلسل JSON للطلب
          JSON.stringify({
            id: String(session.user.id),
            email: session.user.email || '',
          }),
        );
      } catch (_) { /* ignore */ }

      // # block — معالجة أخطاء
      const baseUser = SL.menuUi.buildMenuUserProfileFromSupabaseUser(session.user);
      // # شرط — فرع منطقي
      if (baseUser) global.updateDropdownUI(baseUser);

      // # شرط — فرع منطقي
      if (!SL.state.isFetchingCredits) {
        SL.state.isFetchingCredits = true;
        const cts = H.createCreditsFetchAbortSignal(15000);
        // # try — معالجة عملية قد تفشل
        try {
          // # block — نقاط/credits
          const authHeaders = {
            Authorization: `Bearer ${session.access_token}`,
            'X-User-Id': String(session.user.id),
          };
          // # try — معالجة عملية قد تفشل
          try {
            await SL.creditsFetch.fetchUserInitAndCreditsFromApi(
              // # block — نقاط/credits
              session,
              baseUser,
              authHeaders,
              cts.signal,
            );
          } catch (e) {
            // # block — معالجة أخطاء
            const isTimeout = e && (e.name === 'AbortError' || e.name === 'TimeoutError');
            // # شرط — فرع منطقي
            if (isTimeout) {
              H.logCreditsFetchWarning('credits fetch timeout', e);
              H.applyMenuCreditsPlaceholder(baseUser, '...');
            } else {
              H.logCreditsFetchWarning('credits fetch error', e);
              // # block — نقاط/credits
              H.applyMenuCreditsPlaceholder(baseUser, 'Error');
            }
          }
        } finally {
          // # try — معالجة عملية قد تفشل
          try {
            cts.dispose();
          // # block — معالجة أخطاء
          } catch (_) { /* ignore */ }
          SL.state.isFetchingCredits = false;
        }
      }
    } catch (e) {
      console.error('Auth Sync Error:', e);
      // # try — معالجة عملية قد تفشل
      try {
        global.ensureGuestMenuAuthLinks();
      } catch (_) { /* ignore */ }
    }
  }

  SL.authSync = {
    waitForOAuthSessionFromUrlHash,
    syncAuthSessionAndCreditsToUi,
  };
  global.checkAuth = syncAuthSessionAndCreditsToUi;
})(window);
