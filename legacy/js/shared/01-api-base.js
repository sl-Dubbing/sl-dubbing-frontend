// # FILE frontend/sl-dubbing-frontend-main/js/shared/01-api-base.js
// # AR وحدات مشتركة — auth، credits، menu
// # KW عام,general
// # CONVENTION — FN/AR/KW + # block كل ~6 أسطر — FUNCTION_INDEX.md DOMAIN_INDEX.md
// =====================================================================
// 📒 فهرس الدوال — js/shared/01-api-base.js
// ---------------------------------------------------------------------
//  تطبيع_رابط_قاعدة_API     → normalizeApiBaseUrl
//  التحقق_من_إعداد_Supabase → requireSupabaseConfig
// =====================================================================
(function (global) {
  const SL = (global.SLShared = global.SLShared || {});

  /** تطبيع_رابط_قاعدة_API — إزالة السلاش الزائد وتجنّب // في المسارات */
  // # FN normalizeApiBaseUrl
  // # AR دالة normalizeApiBaseUrl (normalizeApiBaseUrl)
  // # KW عام,general
  function normalizeApiBaseUrl() {
    const cfg = global.APP_CONFIG || {};
    const raw = cfg.API_BASE;
    // # guard — شرط رفض أو خروج مبكر
    if (raw === '' || cfg.USE_GO_GATEWAY === true) {
      return String(global.location?.origin || '').replace(/\/$/, '');
    }
    // # return — إرجاع النتيجة
    return String(raw || 'https://api.glotix.ai')
      .replace(/\/$/, '')
      .replace(/([^:]\/)\/+/g, '$1');
  }

  /** التحقق_من_إعداد_Supabase — يتأكد أن SUPABASE_URL و SUPABASE_KEY موجودان */
  // # FN requireSupabaseConfig
  // # AR require supabase config (requireSupabaseConfig)
  // # KW مصادقة,auth,JWT,supabase
  function requireSupabaseConfig() {
    const url = global.APP_CONFIG && global.APP_CONFIG.SUPABASE_URL;
    const key = global.APP_CONFIG && global.APP_CONFIG.SUPABASE_KEY;
    // # guard — شرط رفض أو خروج مبكر
    if (!url || !key) {
      const err = new Error('[shared] APP_CONFIG must define SUPABASE_URL and SUPABASE_KEY');
      console.error(err.message);
      // # block — معالجة أخطاء
      throw err;
    }
    // # return — إرجاع النتيجة
    return { url: String(url), key: String(key) };
  }

  const apiBase = normalizeApiBaseUrl();
  global.API_BASE = apiBase;
  SL.apiBase = apiBase;

  SL.config = {
    normalizeApiBaseUrl,
    requireSupabaseConfig,
    DEFAULT_MENU_AVATAR:
      'https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y',
  };
})(window);
