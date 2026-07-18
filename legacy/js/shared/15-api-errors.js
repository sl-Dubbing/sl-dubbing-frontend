// # FILE frontend/sl-dubbing-frontend-main/js/shared/15-api-errors.js
// # AR وحدات مشتركة — auth، credits، menu
// # KW عام,general
// # CONVENTION — FN/AR/KW + # block كل ~6 أسطر — FUNCTION_INDEX.md DOMAIN_INDEX.md
// =====================================================================
// 📒 فهرس الدوال — js/shared/15-api-errors.js
// ---------------------------------------------------------------------
//  رسالة_خطأ_مفهومة_من_رد_API  → humanizeApiErrorMessage
//  تسجيل_فشل_طلب_API           → logApiRequestFailure
// =====================================================================
(function (global) {
  const SL = global.SLShared;

  /** رسالة_خطأ_مفهومة_من_رد_API — للعرض في toast */
  // # FN humanizeApiErrorMessage
  // # KW عام,general
  function humanizeApiErrorMessage(res, data, fallback) {
    const status = res && res.status;
    const err = (data && (data.error || data.message)) || '';
    const errLower = String(err).toLowerCase();

    // # guard — شرط رفض أو خروج مبكر
    if (status === 401) {
      // # guard — شرط رفض أو خروج مبكر
      if (errLower.includes('mismatch')) {
        // # block — فرع شرطي
        return 'Session mismatch — please sign out and sign in again';
      }
      // # guard — شرط رفض أو خروج مبكر
      if (errLower.includes('unauthorized') || errLower.includes('invalid') || errLower.includes('expired')) {
        // # return — إرجاع النتيجة
        return 'Session expired — please sign in again';
      }
      // # return — إرجاع النتيجة
      return err || 'Unauthorized — please sign in again';
    // # block — فرع شرطي
    }
    // # guard — شرط رفض أو خروج مبكر
    if (status === 403) {
      // # guard — شرط رفض أو خروج مبكر
      if (errLower.includes('email_not_verified') || errLower.includes('confirm your email')) {
        return 'Please confirm your email — check your inbox for the verification link.';
      }
      // # return — إرجاع النتيجة
      return err || 'Access denied';
    // # block — فرع شرطي
    }
    // # شرط — فرع منطقي
    if (status === 402 || errLower === 'insufficient_credits') {
      const req = data && data.required;
      const bal = data && (data.balance ?? data.credits);
      // # guard — شرط رفض أو خروج مبكر
      if (req != null && bal != null) {
        return `Not enough credits — you need ${req}, but your balance is ${bal}. Please add credits to continue.`;
      // # block — نقاط/credits
      }
      return 'Not enough credits. Please add credits to your account to continue.';
    }
    // # guard — شرط رفض أو خروج مبكر
    if (errLower === 'insufficient_credits_for_voice_clone') {
      // # return — إرجاع النتيجة
      return (
        (data && data.message) ||
        // # block — معالجة صوت/استنساخ
        'Voice cloning is available for this job. Saved samples use normal dubbing rates.',
      );
    }
    // # guard — شرط رفض أو خروج مبكر
    if (status === 429) return 'Too many requests — wait a moment and try again';
    // # guard — شرط رفض أو خروج مبكر
    if (status === 503) {
      // # guard — شرط رفض أو خروج مبكر
      if (errLower.includes('queue') || errLower.includes('redis')) {
        // # block — معالجة أخطاء
        return 'Server queue unavailable — check Redis on Railway (web + worker-dubbing)';
      }
      // # guard — شرط رفض أو خروج مبكر
      if (errLower.includes('database')) return 'Database unavailable — try again later';
      // # return — إرجاع النتيجة
      return err || 'Service temporarily unavailable';
    }
    // # guard — شرط رفض أو خروج مبكر
    if (status === 422) return err || 'Invalid request data';
    // # guard — شرط رفض أو خروج مبكر
    if (status === 400) return err || 'Bad request';
    // # guard — شرط رفض أو خروج مبكر
    if (status >= 500) return err || 'Server error — try again';
    // # return — إرجاع النتيجة
    return err || fallback || 'Request failed';
  }

  /** تسجيل_فشل_طلب_API — للتشخيص في Console */
  // # FN logApiRequestFailure
  // # AR log API —  request failure (logApiRequestFailure)
  // # KW عام,general
  function logApiRequestFailure(context, url, res, data) {
    console.warn('[API]', context, {
      url,
      status: res && res.status,
      error: data && data.error,
      body: data,
    // # block — تنفيذ منطق — راجع الأسطر التالية
    });
  }

  SL.apiErrors = { humanizeApiErrorMessage, logApiRequestFailure };
  global.humanizeApiErrorMessage = humanizeApiErrorMessage;
})(window);
