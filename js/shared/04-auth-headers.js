// # FILE frontend/sl-dubbing-frontend-main/js/shared/04-auth-headers.js
// # AR وحدات مشتركة — auth، credits، menu
// # KW مصادقة,auth
// # CONVENTION — FN/AR/KW + # block كل ~6 أسطر — FUNCTION_INDEX.md DOMAIN_INDEX.md
// =====================================================================
// 📒 فهرس الدوال — js/shared/04-auth-headers.js
// ---------------------------------------------------------------------
//  بناء_ترويسات_مصادقة_API  → getApiAuthHeaders
// =====================================================================
(function (global) {
  const SL = global.SLShared;

  /** بناء_ترويسات_مصادقة_API — sub من JWT يجب أن يطابق X-User-Id (مطلوب للباكند) */
  // # FN getApiAuthHeaders
  // # AR المصادقة والجلسة (getApiAuthHeaders)
  // # KW مصادقة,auth,JWT,supabase
  function getApiAuthHeaders() {
    // # localStorage — تخزين محلي
    const token = (localStorage.getItem('token') || '').trim();
    // # guard — شرط رفض أو خروج مبكر
    if (!token) return null;
    const userId =
      typeof global.parseJwtSub === 'function' ? global.parseJwtSub(token) : null;
    // # guard — شرط رفض أو خروج مبكر
    if (!userId) return null;
    // # return — إرجاع النتيجة
    return {
      Authorization: 'Bearer ' + token,
      'X-User-Id': userId,
    };
  }

  /** تجديد_ترويسات_المصادقة_من_Supabase — قبل طلبات الدبلجة الحرجة */
  // # FN refreshApiAuthHeadersFromSupabase
  // # AR refresh API —  auth headers from supabase (refreshApiAuthHeadersFromSupabase)
  // # KW مصادقة,auth,JWT,supabase
  async function refreshApiAuthHeadersFromSupabase() {
    const supa = typeof global.getSupabase === 'function' ? global.getSupabase() : null;
    // # guard — شرط رفض أو خروج مبكر
    if (!supa?.auth?.getSession) return getApiAuthHeaders();
    // # try — معالجة عملية قد تفشل
    try {
      const {
        data: { session },
      // # block — معالجة أخطاء
      } = await supa.auth.getSession();
      // # guard — شرط رفض أو خروج مبكر
      if (!session?.access_token || !session?.user?.id) return getApiAuthHeaders();
      // # localStorage — تخزين محلي
      localStorage.setItem('token', session.access_token);
      // # localStorage — تخزين محلي
      localStorage.setItem(
        'sl_user_cache',
        // # تسلسل JSON للطلب
        JSON.stringify({
          // # block — تحديث واجهة/DOM
          id: String(session.user.id),
          email: session.user.email || '',
        }),
      );
      // # return — إرجاع النتيجة
      return {
        Authorization: 'Bearer ' + session.access_token,
        // # block — إرجاع نتيجة
        'X-User-Id': String(session.user.id),
      };
    } catch (_) {
      // # return — إرجاع النتيجة
      return getApiAuthHeaders();
    }
  }

  SL.authHeaders = { getApiAuthHeaders, refreshApiAuthHeadersFromSupabase };
  global.getApiAuthHeaders = getApiAuthHeaders;
  global.refreshApiAuthHeadersFromSupabase = refreshApiAuthHeadersFromSupabase;
})(window);
