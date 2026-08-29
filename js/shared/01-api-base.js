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
//  جلب_كتالوج_الأصوات       → fetchSharedPremiumVoices
//  جلب_عينات_المستخدم       → fetchSharedUserVoiceClones
//  حفظ_الصوت_المختار        → persistSharedStudioVoice
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

  const PREMIUM_VOICES_CACHE_KEY = 'glotix.voices.premium.v1';
  const PREMIUM_VOICES_TTL_MS = 6 * 60 * 60 * 1000;
  const USER_CLONES_CACHE_PREFIX = 'glotix.voices.clones.v1.';
  const USER_CLONES_TTL_MS = 10 * 60 * 1000;
  const SHARED_VOICE_KEY = 'glotix.selected_voice.v1';

  // # FN readSharedPremiumVoicesCache
  // # AR Read the public voice catalog from sessionStorage (same for Dubbing and TTS).
  // # KW صوت,استنساخ,voice,clone,sample
  function readSharedPremiumVoicesCache() {
    try {
      const raw = sessionStorage.getItem(PREMIUM_VOICES_CACHE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.voices) || !parsed.voices.length) return null;
      if (Date.now() - Number(parsed.saved_at || 0) > PREMIUM_VOICES_TTL_MS) return null;
      return parsed.voices;
    } catch (_) {
      return null;
    }
  }

  // # FN writeSharedPremiumVoicesCache
  // # KW صوت,استنساخ,voice,clone,sample
  function writeSharedPremiumVoicesCache(voices) {
    try {
      sessionStorage.setItem(
        PREMIUM_VOICES_CACHE_KEY,
        JSON.stringify({ saved_at: Date.now(), voices: voices || [] }),
      );
    } catch (_) {
      /* quota / private mode */
    }
  }

  /** جلب_كتالوج_الأصوات — GET /api/voices/premium with session cache shared by both studios */
  // # FN fetchSharedPremiumVoices
  // # AR Shared public sample catalog for Dubbing Studio and Text to Speech.
  // # KW صوت,استنساخ,voice,clone,sample
  async function fetchSharedPremiumVoices(apiBase) {
    const cached = readSharedPremiumVoicesCache();
    if (cached) {
      global.SHARED_PREMIUM_VOICES = cached;
      return cached;
    }
    const base = String(apiBase || normalizeApiBaseUrl() || '').replace(/\/$/, '');
    if (!base) return [];
    try {
      const res = await fetch(base + '/api/voices/premium');
      const json = await res.json().catch(() => ({}));
      const voices = res.ok && Array.isArray(json.voices) ? json.voices : [];
      if (voices.length) writeSharedPremiumVoicesCache(voices);
      global.SHARED_PREMIUM_VOICES = voices;
      return voices;
    } catch (_) {
      return [];
    }
  }

  // # FN sharedUserVoiceClonesCacheKey
  // # KW صوت,استنساخ,voice,clone,sample
  function sharedUserVoiceClonesCacheKey(userId) {
    return USER_CLONES_CACHE_PREFIX + String(userId || 'guest');
  }

  /** إلغاء_كاش_عينات_المستخدم — بعد حفظ أو حذف عيّنة */
  // # FN invalidateSharedUserVoiceClones
  // # KW صوت,استنساخ,voice,clone,sample
  function invalidateSharedUserVoiceClones(userId) {
    try {
      sessionStorage.removeItem(sharedUserVoiceClonesCacheKey(userId));
    } catch (_) {
      /* ignore */
    }
    global.SHARED_USER_VOICE_CLONES = null;
  }

  /** جلب_عينات_المستخدم — GET /api/user/voice-clones, shared by Dubbing and TTS */
  // # FN fetchSharedUserVoiceClones
  // # AR User library samples used by both studio menus.
  // # KW صوت,استنساخ,voice,clone,sample
  async function fetchSharedUserVoiceClones(apiBase, headers) {
    if (!headers) return [];
    const userId = headers['X-User-Id'] || 'guest';
    try {
      const raw = sessionStorage.getItem(sharedUserVoiceClonesCacheKey(userId));
      if (raw) {
        const parsed = JSON.parse(raw);
        if (
          parsed &&
          Array.isArray(parsed.clones) &&
          Date.now() - Number(parsed.saved_at || 0) < USER_CLONES_TTL_MS
        ) {
          global.SHARED_USER_VOICE_CLONES = parsed.clones;
          return parsed.clones;
        }
      }
    } catch (_) {
      /* ignore */
    }
    const base = String(apiBase || normalizeApiBaseUrl() || '').replace(/\/$/, '');
    if (!base) return [];
    try {
      const res = await fetch(base + '/api/user/voice-clones', { headers });
      const data = await res.json().catch(() => ({}));
      const clones = res.ok && Array.isArray(data.clones) ? data.clones : [];
      try {
        sessionStorage.setItem(
          sharedUserVoiceClonesCacheKey(userId),
          JSON.stringify({ saved_at: Date.now(), clones }),
        );
      } catch (_) {
        /* quota / private mode */
      }
      global.SHARED_USER_VOICE_CLONES = clones;
      return clones;
    } catch (_) {
      return [];
    }
  }

  /** حفظ_الصوت_المختار — last sample shared between Dubbing and TTS menus */
  // # FN persistSharedStudioVoice
  // # KW صوت,استنساخ,voice,clone,sample
  function persistSharedStudioVoice(payload) {
    if (!payload || typeof payload !== 'object') return;
    try {
      localStorage.setItem(SHARED_VOICE_KEY, JSON.stringify(payload));
    } catch (_) {
      /* quota / private mode */
    }
  }

  // # FN readSharedStudioVoice
  // # KW صوت,استنساخ,voice,clone,sample
  function readSharedStudioVoice() {
    try {
      const raw = localStorage.getItem(SHARED_VOICE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return null;
      return parsed;
    } catch (_) {
      return null;
    }
  }

  const apiBase = normalizeApiBaseUrl();
  global.API_BASE = apiBase;
  SL.apiBase = apiBase;

  global.fetchSharedPremiumVoices = fetchSharedPremiumVoices;
  global.fetchSharedUserVoiceClones = fetchSharedUserVoiceClones;
  global.invalidateSharedUserVoiceClones = invalidateSharedUserVoiceClones;
  global.persistSharedStudioVoice = persistSharedStudioVoice;
  global.readSharedStudioVoice = readSharedStudioVoice;

  SL.config = {
    normalizeApiBaseUrl,
    requireSupabaseConfig,
    isAllowedCheckoutRedirectUrl,
    isAllowedPlaybackUrl,
    fetchSharedPremiumVoices,
    fetchSharedUserVoiceClones,
    invalidateSharedUserVoiceClones,
    persistSharedStudioVoice,
    readSharedStudioVoice,
    DEFAULT_MENU_AVATAR:
      'https://ui-avatars.com/api/?name=User&size=128&background=334155&color=fff',
  };
})(window);
