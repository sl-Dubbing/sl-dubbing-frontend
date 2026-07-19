// # FILE frontend/sl-dubbing-frontend-main/js/shared/03-jwt.js
// # AR وحدات مشتركة — auth، credits، menu
// # KW مصادقة,auth
// # CONVENTION — FN/AR/KW + # block كل ~6 أسطر — FUNCTION_INDEX.md DOMAIN_INDEX.md
// =====================================================================
// 📒 فهرس الدوال — js/shared/03-jwt.js
// ---------------------------------------------------------------------
//  فك_جزء_JWT_ك_JSON        → decodeJwtPayloadPartToUtf8
//  استخراج_معرف_المستخدم_من_التوكن → parseJwtSub
// =====================================================================
(function (global) {
  const SL = global.SLShared;

  /** فك_جزء_JWT_ك_JSON — فك base64url لحمولة JWT مع دعم UTF-8 */
  // # FN decodeJwtPayloadPartToUtf8
  // # AR المصادقة والجلسة (decodeJwtPayloadPartToUtf8)
  // # KW مصادقة,auth,JWT,supabase
  function decodeJwtPayloadPartToUtf8(b64) {
    let b64norm = b64.replace(/-/g, '+').replace(/_/g, '/');
    while (b64norm.length % 4) b64norm += '=';
    const binary = atob(b64norm);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    // # guard — شرط رفض أو خروج مبكر
    if (typeof TextDecoder !== 'undefined') {
      return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
    }
    // # return — إرجاع النتيجة
    return binary;
  }

  /** استخراج_معرف_المستخدم_من_التوكن — حقل sub من JWT لـ X-User-Id */
  // # FN parseJwtSub
  // # AR parse jwt sub (parseJwtSub)
  // # KW مصادقة,auth,JWT,supabase
  function parseJwtSub(token) {
    // # guard — شرط رفض أو خروج مبكر
    if (!token || typeof token !== 'string') return null;
    // # try — معالجة عملية قد تفشل
    try {
      const parts = token.split('.');
      // # guard — شرط رفض أو خروج مبكر
      if (parts.length < 2) return null;
      const payload = JSON.parse(decodeJwtPayloadPartToUtf8(parts[1]));
      // # return — إرجاع النتيجة
      return payload.sub ? String(payload.sub) : null;
    } catch (e) {
      // # return — إرجاع النتيجة
      return null;
    }
  }

  SL.jwt = { decodeJwtPayloadPartToUtf8, parseJwtSub };
  global.parseJwtSub = parseJwtSub;
})(window);
