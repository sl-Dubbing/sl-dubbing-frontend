// # FILE frontend/sl-dubbing-frontend-main/js/shared/03-jwt.js
// # AR وحدات مشتركة — auth، credits، menu
// # KW مصادقة,auth
// # CONVENTION — FN/AR/KW + # block كل ~6 أسطر — FUNCTION_INDEX.md DOMAIN_INDEX.md
// =====================================================================
// 📒 فهرس الدوال — js/shared/03-jwt.js
// ---------------------------------------------------------------------
//  فك_جزء_JWT_ك_JSON        → decodeJwtPayloadPartToUtf8
//  استخراج_معرف_المستخدم_من_التوكن → parseJwtSub
//  قراءة_توكن_الجلسة         → readGlotixToken
//  حفظ_توكن_الجلسة          → writeGlotixToken
//  مسح_توكن_الجلسة          → clearGlotixToken
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

  /** قراءة_توكن_الجلسة — sessionStorage أولاً ثم ترحيل بقايا localStorage */
  // # FN readGlotixToken
  // # AR المصادقة والجلسة (readGlotixToken)
  // # KW مصادقة,auth,JWT,supabase,security
  function readGlotixToken() {
    try {
      let token = sessionStorage.getItem('token') || '';
      if (!token) {
        token = localStorage.getItem('token') || '';
        if (token) {
          sessionStorage.setItem('token', token);
          localStorage.removeItem('token');
        }
      }
      return String(token || '').trim();
    } catch (_) {
      return '';
    }
  }

  /** حفظ_توكن_الجلسة — لا تُبقِ JWT في localStorage بعد XSS دائم */
  // # FN writeGlotixToken
  // # AR المصادقة والجلسة (writeGlotixToken)
  // # KW مصادقة,auth,JWT,supabase,security
  function writeGlotixToken(token) {
    try {
      const value = String(token || '').trim();
      if (!value) {
        sessionStorage.removeItem('token');
        localStorage.removeItem('token');
        return;
      }
      sessionStorage.setItem('token', value);
      localStorage.removeItem('token');
    } catch (_) { /* ignore */ }
  }

  /** مسح_توكن_الجلسة */
  // # FN clearGlotixToken
  // # AR المصادقة والجلسة (clearGlotixToken)
  // # KW مصادقة,auth,JWT,supabase,security
  function clearGlotixToken() {
    writeGlotixToken('');
  }

  SL.jwt = { decodeJwtPayloadPartToUtf8, parseJwtSub, readGlotixToken, writeGlotixToken, clearGlotixToken };
  global.parseJwtSub = parseJwtSub;
  global.readGlotixToken = readGlotixToken;
  global.writeGlotixToken = writeGlotixToken;
  global.clearGlotixToken = clearGlotixToken;
})(window);
