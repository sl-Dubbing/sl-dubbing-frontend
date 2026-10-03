// # FILE frontend/sl-dubbing-frontend-main/js/shared/06-guest-menu.js
// # AR وحدات مشتركة — auth، credits، menu
// # KW عام,general
// # CONVENTION — FN/AR/KW + # block كل ~6 أسطر — FUNCTION_INDEX.md DOMAIN_INDEX.md
// =====================================================================
// 📒 فهرس الدوال — js/shared/06-guest-menu.js
// ---------------------------------------------------------------------
//  ضبط_روابط_تسجيل_الدخول_للزائر → ensureGuestMenuAuthLinks
// =====================================================================
(function (global) {
  const SL = global.SLShared;

  /** ضبط_روابط_تسجيل_الدخول_للزائر — Login / Sign up → login.html */
  // # FN ensureGuestMenuAuthLinks
  // # AR ensure guest menu auth links (ensureGuestMenuAuthLinks)
  // # KW مصادقة,auth,JWT,supabase
  function ensureGuestMenuAuthLinks() {
    let loginHref = 'login.html';
    // # try — معالجة عملية قد تفشل
    try {
      loginHref = new URL('login.html', global.location.href).href;
    } catch (_) { /* ignore */ }
    const guest = document.getElementById('guestMenu');
    // # guard — شرط رفض أو خروج مبكر
    if (!guest) return;
    const loginA = guest.querySelector('a.btn-login');
    const signupA = guest.querySelector('a.btn-signup');
    // # شرط — فرع منطقي
    if (loginA) loginA.setAttribute('href', loginHref);
    // # شرط — فرع منطقي
    if (signupA) signupA.setAttribute('href', loginHref);
  }

  SL.guestMenu = { ensureGuestMenuAuthLinks };
  global.ensureGuestMenuAuthLinks = ensureGuestMenuAuthLinks;
})(window);
