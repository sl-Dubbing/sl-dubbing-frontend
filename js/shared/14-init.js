// # FILE frontend/sl-dubbing-frontend-main/js/shared/14-init.js
// # AR وحدات مشتركة — auth، credits، menu
// # KW عام,general
// # CONVENTION — FN/AR/KW + # block كل ~6 أسطر — FUNCTION_INDEX.md DOMAIN_INDEX.md
// =====================================================================
// 📒 فهرس الدوال — js/shared/14-init.js
// ---------------------------------------------------------------------
//  تشغيل_الوحدات_المشتركة_عند_تحميل_الصفحة → bootstrapSharedModulesOnDomReady
// =====================================================================
(function (global) {
  const SL = global.SLShared;

  /** تشغيل_الوحدات_المشتركة_عند_تحميل_الصفحة */
  // # FN bootstrapSharedModulesOnDomReady
  // # AR bootstrap shared modules on dom ready (bootstrapSharedModulesOnDomReady)
  // # KW عام,general
  function bootstrapSharedModulesOnDomReady() {
    SL.menuActions.initMainMenuDropdownToggle();
    SL.menuActions.bindLogoutButtonHandler();
    // # try — معالجة عملية قد تفشل
    try {
      global.ensureGuestMenuAuthLinks();
    } catch (_) { /* ignore */ }

    // # block — معالجة أخطاء
    void global.checkConnection();
    void global.checkAuth();
  }

  document.addEventListener('DOMContentLoaded', bootstrapSharedModulesOnDomReady);
})(window);
