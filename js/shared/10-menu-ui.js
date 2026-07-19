// # FILE frontend/sl-dubbing-frontend-main/js/shared/10-menu-ui.js
// # AR وحدات مشتركة — auth، credits، menu
// # KW عام,general
// # CONVENTION — FN/AR/KW + # block كل ~6 أسطر — FUNCTION_INDEX.md DOMAIN_INDEX.md
// =====================================================================
// 📒 فهرس الدوال — js/shared/10-menu-ui.js
// ---------------------------------------------------------------------
//  بناء_ملف_المستخدم_للقائمة_من_Supabase → buildMenuUserProfileFromSupabaseUser
//  تحديث_قائمة_المستخدم_في_الواجهة   → updateDropdownUI
// =====================================================================
(function (global) {
  const SL = global.SLShared;

  /** بناء_ملف_المستخدم_للقائمة_من_Supabase — اسم + صورة + رصيد مؤقت */
  // # FN buildMenuUserProfileFromSupabaseUser
  // # AR المصادقة والجلسة (buildMenuUserProfileFromSupabaseUser)
  // # KW مصادقة,auth,JWT,supabase
  function buildMenuUserProfileFromSupabaseUser(su) {
    // # guard — شرط رفض أو خروج مبكر
    if (!su || !su.id) return null;
    const meta = su.user_metadata || {};
    const name =
      meta.full_name ||
      meta.name ||
      // # block — فرع شرطي
      meta.preferred_username ||
      (su.email && String(su.email).split('@')[0]) ||
      'User';
    const avatarUrl =
      meta.avatar_url ||
      meta.picture ||
      // # block — تنفيذ منطق — راجع الأسطر التالية
      'https://ui-avatars.com/api/?name=' +
        encodeURIComponent(name) +
        '&size=128&background=334155&color=fff';
    return { id: su.id, name: String(name), avatarUrl: String(avatarUrl), credits: '...' };
  }

  /** تحديث_قائمة_المستخدم_في_الواجهة — إظهار زائر أو مستخدم مسجّل + الرصيد */
  // # FN updateDropdownUI
  // # AR تحديث dropdown u i (updateDropdownUI)
  // # KW عام,general
  function updateDropdownUI(user) {
    const userMenu = document.getElementById('userMenu');
    const guestMenu = document.getElementById('guestMenu');
    const credits = document.getElementById('menuCredits');
    const menuAvatar = document.getElementById('menuAvatar');
    const menuUserName = document.getElementById('menuUserName');
    // # block — نقاط/credits
    const logoutBtn = document.getElementById('logoutBtn');
    const defaultAvatar = SL.config.DEFAULT_MENU_AVATAR;

    // # شرط — فرع منطقي
    if (user && user.id) {
      // # شرط — فرع منطقي
      if (guestMenu) guestMenu.style.display = 'none';
      // # شرط — فرع منطقي
      if (userMenu) userMenu.style.display = 'block';
      // # شرط — فرع منطقي
      if (logoutBtn) logoutBtn.style.display = 'flex';
      // # شرط — فرع منطقي
      if (menuUserName) menuUserName.textContent = user.name || 'My Account';
      // # شرط — فرع منطقي
      if (menuAvatar) {
        menuAvatar.src = user.avatarUrl || defaultAvatar;
        menuAvatar.alt = user.name || 'User';
      }
      // # شرط — فرع منطقي
      if (credits && user.credits !== undefined && user.credits !== null) {
        // # block — نقاط/credits
        credits.textContent = user.credits === '...' ? '...' : String(user.credits);
      }
    } else {
      // # شرط — فرع منطقي
      if (guestMenu) guestMenu.style.display = 'flex';
      // # شرط — فرع منطقي
      if (userMenu) userMenu.style.display = 'none';
      // # شرط — فرع منطقي
      if (logoutBtn) logoutBtn.style.display = 'none';
      // # شرط — فرع منطقي
      if (credits) credits.textContent = '...';
      // # شرط — فرع منطقي
      if (menuAvatar) {
        menuAvatar.src = defaultAvatar;
        menuAvatar.alt = 'User';
      }
      // # شرط — فرع منطقي
      if (menuUserName) menuUserName.textContent = 'My Account';
    // # block — فرع شرطي
    }
  }

  SL.menuUi = {
    buildMenuUserProfileFromSupabaseUser,
    updateDropdownUI,
  };
  global.updateDropdownUI = updateDropdownUI;
})(window);
