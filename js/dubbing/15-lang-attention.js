// # FILE frontend/sl-dubbing-frontend-main/js/dubbing/15-lang-attention.js
// # AR واجهة الدبلجة — رفع، Start، polling، أصوات
// # KW لغة,language
// # CONVENTION — FN/AR/KW + # block كل ~6 أسطر — FUNCTION_INDEX.md DOMAIN_INDEX.md
// =====================================================================
// 📒 فهرس الدوال — js/dubbing/15-lang-attention.js
// ---------------------------------------------------------------------
//  إبراز_أزرار_اللغة_بعد_رفع_الملف  → highlightLangButtonsNeedsAttention
//  إزالة_الإبراز_عند_التفاعل        → clearLangButtonNeedsAttention
//  ربط_أحداث_التنبيه                → bindDubbingLangAttentionUi
// =====================================================================
(function (global) {
  const DubbingApp = global.DubbingApp;

  // # FN getSrcLangTrigger
  // # AR اللغات واللهجات (getSrcLangTrigger)
  // # KW لغة,language,dialect
  function getSrcLangTrigger() {
    // # return — إرجاع النتيجة
    return document.getElementById('srcLangTrigger');
  }

  // # FN getTargetLangTrigger
  // # AR اللغات واللهجات (getTargetLangTrigger)
  // # KW لغة,language,dialect
  function getTargetLangTrigger() {
    // # return — إرجاع النتيجة
    return document.getElementById('langTrigger');
  }

  /** إبراز_أزرار_اللغة_بعد_رفع_الملف — نبض أحمر */
  // # FN highlightLangButtonsNeedsAttention
  // # AR اللغات واللهجات (highlightLangButtonsNeedsAttention)
  // # KW لغة,language,dialect
  function highlightLangButtonsNeedsAttention() {
    getSrcLangTrigger()?.classList.add('needs-attention');
    getTargetLangTrigger()?.classList.add('needs-attention');
  }

  /** إزالة_الإبراز_من_زر_لغة */
  // # FN clearLangButtonNeedsAttention
  // # AR اللغات واللهجات (clearLangButtonNeedsAttention)
  // # KW لغة,language,dialect
  function clearLangButtonNeedsAttention(triggerEl) {
    triggerEl?.classList.remove('needs-attention');
  }

  /** ربط_أحداث_التنبيه — رفع ملف + نقر على الأزرار */
  // # FN bindDubbingLangAttentionUi
  // # AR bind dubbing lang attention ui (bindDubbingLangAttentionUi)
  // # KW لغة,language,dialect
  function bindDubbingLangAttentionUi() {
    const srcBtn = getSrcLangTrigger();
    const targetBtn = getTargetLangTrigger();

    // # شرط — فرع منطقي
    if (srcBtn && !srcBtn.dataset.attentionBound) {
      srcBtn.dataset.attentionBound = '1';
      srcBtn.addEventListener('click', () => clearLangButtonNeedsAttention(srcBtn));
    // # block — فرع شرطي
    }

    // # شرط — فرع منطقي
    if (targetBtn && !targetBtn.dataset.attentionBound) {
      targetBtn.dataset.attentionBound = '1';
      targetBtn.addEventListener('click', () => clearLangButtonNeedsAttention(targetBtn));
    }
  }

  DubbingApp.langAttention = {
    highlightLangButtonsNeedsAttention,
    clearLangButtonNeedsAttention,
    bindDubbingLangAttentionUi,
  };
})(window);
