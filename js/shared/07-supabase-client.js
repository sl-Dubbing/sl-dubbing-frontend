// # FILE frontend/sl-dubbing-frontend-main/js/shared/07-supabase-client.js
// # AR وحدات مشتركة — auth، credits، menu
// # KW مصادقة,auth
// # CONVENTION — FN/AR/KW + # block كل ~6 أسطر — FUNCTION_INDEX.md DOMAIN_INDEX.md
// =====================================================================
// 📒 فهرس الدوال — js/shared/07-supabase-client.js
// ---------------------------------------------------------------------
//  الحصول_على_عميل_Supabase   → getSupabase
// =====================================================================
(function (global) {
  const SL = global.SLShared;
  SL.state = SL.state || { supabaseClient: null, isFetchingCredits: false };

  /** الحصول_على_عميل_Supabase — إنشاء عميل واحد (PKCE + persist) */
  // # FN getSupabase
  // # AR جلب supabase (getSupabase)
  // # KW مصادقة,auth,JWT,supabase
  function getSupabase() {
    // # guard — شرط رفض أو خروج مبكر
    if (SL.state.supabaseClient) return SL.state.supabaseClient;
    // # شرط — فرع منطقي
    if (
      typeof global.supabase !== 'undefined' &&
      global.supabase &&
      typeof global.supabase.createClient === 'function'
    // # block — فرع شرطي
    ) {
      const { url, key } = SL.config.requireSupabaseConfig();
      SL.state.supabaseClient = global.supabase.createClient(url, key, {
        auth: {
          flowType: 'pkce',
          detectSessionInUrl: true,
          // # block — قاعدة بيانات
          persistSession: true,
        },
      });
    }
    // # return — إرجاع النتيجة
    return SL.state.supabaseClient;
  }

  SL.supabase = { getSupabase };
  global.getSupabase = getSupabase;
})(window);
