// # FILE frontend/sl-dubbing-frontend-main/js/shared/05-session.js
// # AR وحدات مشتركة — auth، credits، menu
// # KW مصادقة,auth
// # CONVENTION — FN/AR/KW + # block كل ~6 أسطر — FUNCTION_INDEX.md DOMAIN_INDEX.md
// =====================================================================
// 📒 فهرس الدوال — js/shared/05-session.js
// ---------------------------------------------------------------------
//  مسح_الجلسة_وواجهة_الزائر        → clearSessionAndGuestUI
// =====================================================================
(function (global) {
  const SL = global.SLShared;

  /** مسح_الجلسة_وواجهة_الزائر — حذف token والكاش + Supabase signOut + قائمة زائر */
  // # FN clearSessionAndGuestUI
  // # AR مسح session and guest u i (clearSessionAndGuestUI)
  // # KW مصادقة,auth,JWT,supabase
  function clearSessionAndGuestUI(message) {
    // # try — معالجة عملية قد تفشل
    try {
      // # localStorage — تخزين محلي
      localStorage.removeItem('token');
      // # localStorage — تخزين محلي
      localStorage.removeItem('sl_user_cache');
    } catch (_) { /* ignore */ }
    // # try — معالجة عملية قد تفشل
    try {
      // # block — تحديث واجهة/DOM
      for (let i = sessionStorage.length - 1; i >= 0; i--) {
        const k = sessionStorage.key(i);
        // # شرط — فرع منطقي
        if (k && k.indexOf('sl_user_inited_') === 0) sessionStorage.removeItem(k);
      }
    } catch (_) { /* ignore */ }
    void (async function () {
      // # try — معالجة عملية قد تفشل
      try {
        // # guard — شرط رفض أو خروج مبكر
        if (typeof global.getSupabase !== 'function') return;
        let supa = null;
        // # try — معالجة عملية قد تفشل
        try {
          supa = global.getSupabase();
        } catch (_) { /* ignore */ }
        // # شرط — فرع منطقي
        if (supa?.auth?.signOut) await supa.auth.signOut();
      } catch (_) { /* ignore */ }
    })();
    // # try — معالجة عملية قد تفشل
    try {
      global.ensureGuestMenuAuthLinks?.();
    } catch (_) { /* ignore */ }
    // # try — معالجة عملية قد تفشل
    try {
      global.updateDropdownUI(null);
    } catch (_) { /* ignore */ }
    // # شرط — فرع منطقي
    if (message) global.showToast?.(message, 'error');
  }

  SL.session = { clearSessionAndGuestUI };
  global.clearSessionAndGuestUI = clearSessionAndGuestUI;
})(window);
