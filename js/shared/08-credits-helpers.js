// # FILE frontend/sl-dubbing-frontend-main/js/shared/08-credits-helpers.js
// # AR وحدات مشتركة — auth، credits، menu
// # KW نقاط,credits
// # CONVENTION — FN/AR/KW + # block كل ~6 أسطر — FUNCTION_INDEX.md DOMAIN_INDEX.md
// =====================================================================
// 📒 فهرس الدوال — js/shared/08-credits-helpers.js
// ---------------------------------------------------------------------
//  إنشاء_إشارة_إلغاء_لمهلة_الرصيد     → createCreditsFetchAbortSignal
//  إخفاء_شارة_فحص_الاتصال            → dismissConnectionCheckingUi
//  استخراج_الرصيد_من_رد_API          → extractCreditsFromApiPayload
//  هل_الرد_API_ناجح                  → apiResponseIndicatesSuccess
//  قراءة_JSON_من_الاستجابة_بأمان     → parseFetchResponseJsonSafe
//  هل_خطأ_سيرفر_مؤقت                  → isTransientServerHttpStatus
//  عرض_رصيد_مؤقت_في_القائمة          → applyMenuCreditsPlaceholder
//  تسجيل_تحذير_جلب_الرصيد            → logCreditsFetchWarning
// =====================================================================
(function (global) {
  const SL = global.SLShared;

  /** إنشاء_إشارة_إلغاء_لمهلة_الرصيد — AbortSignal.timeout أو AbortController */
  // # FN createCreditsFetchAbortSignal
  // # KW نقاط,credits,billing,خصم
  function createCreditsFetchAbortSignal(ms) {
    // # guard — شرط رفض أو خروج مبكر
    if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
      return { signal: AbortSignal.timeout(ms), dispose: function () {} };
    }
    const c = new AbortController();
    const t = setTimeout(function () {
      // # block — فرع شرطي
      c.abort();
    }, ms);
    // # return — إرجاع النتيجة
    return {
      signal: c.signal,
      dispose: function () {
        clearTimeout(t);
      // # block — إرجاع نتيجة
      },
    };
  }

  /** إخفاء_شارة_فحص_الاتصال — إخفاء #srv + إيقاف نبض شعار الاتصال */
  // # FN dismissConnectionCheckingUi
  // # AR Hide legacy badge and clear api-unreachable pulse
  // # KW نقاط,credits,billing,خصم
  function dismissConnectionCheckingUi() {
    document.documentElement.classList.remove('api-unreachable');
    const srv = document.getElementById('srv');
    // # guard — شرط رفض أو خروج مبكر
    if (srv) {
      srv.style.display = 'none';
      // # return — إرجاع النتيجة
      return;
    // # block — تحديث واجهة/DOM
    }
    // # block — تحديث واجهة/DOM
    const txt = document.getElementById('srvTxt');
    // # شرط — فرع منطقي
    if (txt) {
      const wrap = txt.closest('.srv-badge') || txt.parentElement;
      // # guard — شرط رفض أو خروج مبكر
      if (wrap) wrap.style.display = 'none';
      else txt.style.display = 'none';
      // # return — إرجاع النتيجة
      return;
    // # block — تحديث واجهة/DOM
    }
    document.querySelectorAll('.srv-badge').forEach(function (el) {
      el.style.display = 'none';
    });
  }

  /** استخراج_الرصيد_من_رد_API — character_credits / credits / balance من JSON */
  // # FN extractCreditsFromApiPayload
  // # KW نقاط,credits,billing,خصم
  function extractCreditsFromApiPayload(d) {
    // # guard — شرط رفض أو خروج مبكر
    if (!d || typeof d !== 'object') return null;
    const nested = d.data && typeof d.data === 'object' ? d.data : null;
    const v =
      d.character_credits !== undefined && d.character_credits !== null
        ? d.character_credits
        // # block — نقاط/credits
        : d.credits !== undefined && d.credits !== null
          ? d.credits
          : d.balance !== undefined && d.balance !== null
            ? d.balance
            : d.credit_balance !== undefined && d.credit_balance !== null
              ? d.credit_balance
              // # block — نقاط/credits
              : nested && nested.character_credits !== undefined && nested.character_credits !== null
                ? nested.character_credits
                : nested && nested.credits !== undefined && nested.credits !== null
                  ? nested.credits
                  : nested && nested.balance !== undefined && nested.balance !== null
                    ? nested.balance
                    // # block — نقاط/credits
                    : null;
    // # guard — شرط رفض أو خروج مبكر
    if (v === undefined || v === null) return null;
    // # return — إرجاع النتيجة
    return v;
  }

  /** هل_الرد_API_ناجح — success أو ok في JSON */
  // # FN apiResponseIndicatesSuccess
  // # AR النقاط والفوترة (apiResponseIndicatesSuccess)
  // # KW نقاط,credits,billing,خصم
  function apiResponseIndicatesSuccess(data) {
    return !!(data && (data.success === true || data.success === 'true' || data.ok === true));
  }

  /** قراءة_JSON_من_الاستجابة_بأمان */
  // # FN parseFetchResponseJsonSafe
  // # AR النقاط والفوترة (parseFetchResponseJsonSafe)
  // # KW نقاط,credits,billing,خصم
  async function parseFetchResponseJsonSafe(res) {
    // # try — معالجة عملية قد تفشل
    try {
      // # return — إرجاع النتيجة
      return await res.json();
    } catch (_) {
      // # return — إرجاع النتيجة
      return {};
    }
  }

  /** هل_خطأ_سيرفر_مؤقت — 500 / 502 */
  // # FN isTransientServerHttpStatus
  // # KW نقاط,credits,billing,خصم,حالة,webhook,SSE,status
  function isTransientServerHttpStatus(status) {
    // # return — إرجاع النتيجة
    return status === 500 || status === 502;
  }

  /** عرض_رصيد_مؤقت_في_القائمة — ... أو Error دون تسجيل خروج */
  // # FN applyMenuCreditsPlaceholder
  // # AR النقاط والفوترة (applyMenuCreditsPlaceholder)
  // # KW نقاط,credits,billing,خصم
  function applyMenuCreditsPlaceholder(baseUser, placeholder) {
    // # guard — شرط رفض أو خروج مبكر
    if (!baseUser) return;
    global.updateDropdownUI(Object.assign({}, baseUser, { credits: placeholder }));
  }

  /** تسجيل_تحذير_جلب_الرصيد */
  // # FN logCreditsFetchWarning
  // # AR النقاط والفوترة (logCreditsFetchWarning)
  // # KW نقاط,credits,billing,خصم
  function logCreditsFetchWarning(label, detail) {
    console.warn('[shared]', label, detail !== undefined && detail !== null ? detail : '');
  }

  // # FN getVoiceCloneCreditCost
  // # AR الصوت والاستنساخ (getVoiceCloneCreditCost)
  // # KW صوت,استنساخ,voice,clone,sample,نقاط,credits,billing,خصم
  function getVoiceCloneCreditCost() {
    const cfg = global.APP_CONFIG || {};
    const n = Number(cfg.VOICE_CLONE_CREDIT_COST);
    // # return — إرجاع النتيجة
    return Number.isFinite(n) && n > 0 ? n : 100;
  }

  // # FN readCurrentUserCreditBalance
  // # AR read current user credit balance (readCurrentUserCreditBalance)
  // # KW نقاط,credits,billing,خصم
  function readCurrentUserCreditBalance() {
    const el = document.getElementById('menuCredits');
    // # guard — شرط رفض أو خروج مبكر
    if (el) {
      const parsed = Number(String(el.textContent || '').replace(/[^\d.-]/g, ''));
      // # guard — شرط رفض أو خروج مبكر
      if (Number.isFinite(parsed)) return parsed;
    }
    // # block — نقاط/credits
    const cached = global.__glotixUserCredits;
    const n = Number(cached);
    // # return — إرجاع النتيجة
    return Number.isFinite(n) ? n : null;
  }

  SL.creditsHelpers = {
    createCreditsFetchAbortSignal,
    dismissConnectionCheckingUi,
    extractCreditsFromApiPayload,
    apiResponseIndicatesSuccess,
    parseFetchResponseJsonSafe,
    isTransientServerHttpStatus,
    applyMenuCreditsPlaceholder,
    logCreditsFetchWarning,
    getVoiceCloneCreditCost,
    readCurrentUserCreditBalance,
  };
})(window);
