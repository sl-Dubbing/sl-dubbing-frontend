// # FILE frontend/sl-dubbing-frontend-main/js/shared/02-toast.js
// # AR وحدات مشتركة — auth، credits، menu
// # KW عام,general
// # CONVENTION — FN/AR/KW + # block كل ~6 أسطر — FUNCTION_INDEX.md DOMAIN_INDEX.md
// =====================================================================
// 📒 فهرس الدوال — js/shared/02-toast.js
// ---------------------------------------------------------------------
//  عرض_رسالة_تنبيه          → showToast
// =====================================================================
(function (global) {
  const SL = global.SLShared;

  /** عرض_رسالة_تنبيه — إشعار نجاح/خطأ/معلومة في #toasts أو #toast */
  // # FN showToast
  // # AR عرض toast (showToast)
  // # KW عام,general
  function showToast(msg, type = 'info') {
    // # guard — شرط رفض أو خروج مبكر
    if (!msg) return;
    const stack = document.getElementById('toasts');
    const legacy = document.getElementById('toast');
    // # شرط — فرع منطقي
    if (stack) {
      const el = document.createElement('div');
      // # block — تحديث واجهة/DOM
      el.className =
        'toast' + (type === 'error' ? ' error' : type === 'success' ? ' success' : '');
      el.textContent = msg;
      stack.appendChild(el);
      requestAnimationFrame(() => el.classList.add('show'));
      setTimeout(() => {
        // # block — تنفيذ منطق — راجع الأسطر التالية
        el.classList.remove('show');
        setTimeout(() => el.remove(), 320);
      }, 4200);
      // # return — إرجاع النتيجة
      return;
    }
    // # شرط — فرع منطقي
    if (legacy) {
      // # block — فرع شرطي
      legacy.textContent = msg;
      legacy.className =
        'toast show' + (type === 'error' ? ' error' : type === 'success' ? ' success' : '');
      setTimeout(() => legacy.classList.remove('show'), 4200);
      // # return — إرجاع النتيجة
      return;
    }
    // # block — تنفيذ منطق — راجع الأسطر التالية
    console.warn('[toast]', type, msg);
  }

  SL.toast = { showToast };
  global.showToast = showToast;
})(window);
