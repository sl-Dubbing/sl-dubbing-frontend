// # FILE frontend/sl-dubbing-frontend-main/js/shared/11-menu-actions.js
// # AR وحدات مشتركة — auth، credits، menu
// # KW عام,general
// # CONVENTION — FN/AR/KW + # block كل ~6 أسطر — FUNCTION_INDEX.md DOMAIN_INDEX.md
// =====================================================================
// 📒 فهرس الدوال — js/shared/11-menu-actions.js
// ---------------------------------------------------------------------
//  إغلاق_كل_القوائم_المنسدلة         → closeAllSiteDropdowns
//  ربط_زر_تسجيل_الخروج              → bindLogoutButtonHandler
//  تهيئة_قائمة_الهامبرغر_المنسدلة   → initMainMenuDropdownToggle
// =====================================================================
(function (global) {
  const SL = (global.SLShared = global.SLShared || {});

  /** إغلاق_كل_القوائم_المنسدلة — قائمة واحدة مفتوحة في كل الموقع */
  // # FN closeAllSiteDropdowns
  // # AR close every shared / studio dropdown panel
  // # KW واجهة,UI,dropdown
  function closeAllSiteDropdowns() {
    // # block — تحديث واجهة/DOM
    document.getElementById('mainMenuDropdown')?.classList.remove('active');
    document.getElementById('srcLangTrigger')?.classList.remove('active');
    document.getElementById('langTrigger')?.classList.remove('active');
    document.getElementById('voiceSelectBtn')?.classList.remove('active');
    document.getElementById('voiceSelectBtn')?.setAttribute('aria-expanded', 'false');
    // # block — معالجة صوت/استنساخ
    document.getElementById('voicePanel')?.classList.remove('open', 'active');
    document.getElementById('langDropdown')?.classList.remove('open');
    const voiceArrow = document.getElementById('voiceSelectArrow');
    // # شرط
    if (voiceArrow) voiceArrow.style.transform = '';
    document.querySelectorAll('.voice-dropdown-panel.open').forEach((el) => {
      el.classList.remove('open');
    // # block — معالجة صوت/استنساخ
    });
    document.querySelectorAll('.lang-btn.active').forEach((el) => {
      el.classList.remove('active');
    });
  }
  global.closeAllSiteDropdowns = closeAllSiteDropdowns;

  /** ربط_زر_تسجيل_الخروج — Supabase signOut + مسح التخزين + login.html */
  // # FN bindLogoutButtonHandler
  // # KW عام,general
  function bindLogoutButtonHandler() {
    const btn = document.getElementById('logoutBtn');
    // # guard — شرط رفض أو خروج مبكر
    if (!btn || btn.dataset.slLogoutBound === '1') return;
    btn.dataset.slLogoutBound = '1';
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      // # block — تحديث واجهة/DOM
      e.stopPropagation();
      void (async function () {
        let supa = null;
        // # try — معالجة عملية قد تفشل
        try {
          supa = typeof global.getSupabase === 'function' ? global.getSupabase() : null;
        } catch (_) { /* ignore */ }
        // # try — معالجة عملية قد تفشل
        try {
          // # شرط — فرع منطقي
          if (supa?.auth?.signOut) await supa.auth.signOut();
        } catch (_) { /* ignore */ }
        // # try — معالجة عملية قد تفشل
        try {
          // # localStorage — تخزين محلي
          localStorage.removeItem('token');
          for (let i = sessionStorage.length - 1; i >= 0; i--) {
            // # block — تحديث واجهة/DOM
            const k = sessionStorage.key(i);
            // # شرط — فرع منطقي
            if (k && k.indexOf('sl_user_inited_') === 0) sessionStorage.removeItem(k);
          }
        } catch (_) { /* ignore */ }
        global.updateDropdownUI?.(null);
        // # try — معالجة عملية قد تفشل
        try {
          // # block — معالجة أخطاء
          global.location.href = new URL('login.html', global.location.href).href;
        } catch (_) {
          global.location.reload();
        }
      })();
    });
  }

  /** تهيئة_قائمة_الهامبرغر_المنسدلة — فتح/إغلاق #mainMenuDropdown */
  // # FN initMainMenuDropdownToggle
  // # AR init main menu dropdown toggle (initMainMenuDropdownToggle)
  // # KW عام,general
  function initMainMenuDropdownToggle() {
    const menuBtn = document.getElementById('menuBtn');
    const menuDropdown = document.getElementById('mainMenuDropdown');
    // # guard — شرط رفض أو خروج مبكر
    if (!menuBtn || !menuDropdown) return;

    menuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      // # block — تحديث واجهة/DOM
      const opening = !menuDropdown.classList.contains('active');
      closeAllSiteDropdowns();
      // # شرط
      if (opening) menuDropdown.classList.add('active');
    });

    document.addEventListener('click', (e) => {
      // # شرط — فرع منطقي
      if (!menuDropdown.contains(e.target) && !menuBtn.contains(e.target)) {
        // # block — فرع شرطي
        menuDropdown.classList.remove('active');
      }
    // # block — فرع شرطي
    });
  }

  SL.menuActions = {
    closeAllSiteDropdowns,
    bindLogoutButtonHandler,
    initMainMenuDropdownToggle,
  };
})(window);
