// # FILE frontend/sl-dubbing-frontend-main/js/shared/02-toast.js
// # AR وحدات مشتركة — auth، credits، menu
// # KW عام,general
// # CONVENTION — FN/AR/KW + # block كل ~6 أسطر — FUNCTION_INDEX.md DOMAIN_INDEX.md
// =====================================================================
// 📒 فهرس الدوال — js/shared/02-toast.js
// ---------------------------------------------------------------------
//  عرض_رسالة_تنبيه          → showToast
//  حارس_أخطاء_التشغيل       → installRuntimeErrorGuard
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

  // # FN installRuntimeErrorGuard
  // # AR Catch uncaught errors so the studio never fails silently for the user.
  // # KW عام,general,security
  function installRuntimeErrorGuard() {
    if (global.__glotixRuntimeGuard) return;
    global.__glotixRuntimeGuard = true;
    const seen = {};
    function report(raw) {
      const key = String(raw || 'error').slice(0, 120);
      if (seen[key] || Object.keys(seen).length >= 6) return;
      seen[key] = true;
      showToast('Something went wrong — try again', 'error');
    }
    global.addEventListener('error', function (event) {
      const msg = String((event && event.message) || '');
      if (!msg || msg.indexOf('ResizeObserver') !== -1 || msg.indexOf('Script error') === 0) return;
      report(msg);
    });
    global.addEventListener('unhandledrejection', function (event) {
      const reason = event && event.reason;
      const msg = reason && reason.message ? String(reason.message) : String(reason || '');
      if (!msg || msg.indexOf('AbortError') !== -1) return;
      report(msg);
    });
  }
  installRuntimeErrorGuard();
})(window);
