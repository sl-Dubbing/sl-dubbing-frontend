// # FILE frontend/sl-dubbing-frontend-main/js/shared/01-api-base.js
// # AR وحدات مشتركة — auth، credits، menu
// # KW عام,general
// # CONVENTION — FN/AR/KW + # block كل ~6 أسطر — FUNCTION_INDEX.md DOMAIN_INDEX.md
// =====================================================================
// 📒 فهرس الدوال — js/shared/01-api-base.js
// ---------------------------------------------------------------------
//  تطبيع_رابط_قاعدة_API     → normalizeApiBaseUrl
//  التحقق_من_إعداد_Supabase → requireSupabaseConfig
//  رابط_دفع_سترايب_مسموح    → isAllowedCheckoutRedirectUrl
//  رابط_تشغيل_وسائط_مسموح   → isAllowedPlaybackUrl
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

  // # FN isAllowedCheckoutRedirectUrl
  // # AR Only Stripe Checkout hosts may receive a browser navigation after /api/payments/checkout.
  // # KW نقاط,credits,billing,خصم,security
  function isAllowedCheckoutRedirectUrl(url) {
    try {
      const parsed = new URL(String(url || ''));
      if (parsed.protocol !== 'https:') return false;
      const host = parsed.hostname.toLowerCase();
      return host === 'checkout.stripe.com' || host === 'billing.stripe.com';
    } catch (_) {
      return false;
    }
  }

  // # FN isAllowedPlaybackUrl
  // # AR Restrict player src/href to Glotix CDN, API, R2, same-origin /api, or blob.
  // # KW رفع,upload,R2,storage,security
  function isAllowedPlaybackUrl(url) {
    const value = String(url || '').trim();
    if (!value || value.toLowerCase().startsWith('javascript:')) return false;
    if (value.startsWith('blob:')) return true;
    if (value.startsWith('/api/')) return true;
    try {
      const parsed = new URL(value);
      if (parsed.protocol !== 'https:') return false;
      const host = parsed.hostname.toLowerCase();
      if (host === 'cdn.glotix.ai') return true;
      if (host === 'glotix.ai' || host === 'www.glotix.ai') return true;
      if (host.endsWith('.modal.run') && host.includes('sl-dubbing')) return true;
      if (host.endsWith('.r2.cloudflarestorage.com')) return true;
      return false;
    } catch (_) {
      return false;
    }
  }

  const apiBase = normalizeApiBaseUrl();
  global.API_BASE = apiBase;
  SL.apiBase = apiBase;

  SL.config = {
    normalizeApiBaseUrl,
    requireSupabaseConfig,
    isAllowedCheckoutRedirectUrl,
    isAllowedPlaybackUrl,
    DEFAULT_MENU_AVATAR:
      'https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y',
  };
})(window);
