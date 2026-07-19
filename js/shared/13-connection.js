// # FILE frontend/sl-dubbing-frontend-main/js/shared/13-connection.js
// # AR وحدات مشتركة — auth، credits، menu
// # KW عام,general
// # CONVENTION — FN/AR/KW + # block كل ~6 أسطر — FUNCTION_INDEX.md DOMAIN_INDEX.md
// =====================================================================
// 📒 فهرس الدوال — js/shared/13-connection.js
// ---------------------------------------------------------------------
//  فحص_اتصال_API_وعرض_الحالة        → checkApiConnectionAndUpdateBadge
// =====================================================================
(function (global) {
  const SL = global.SLShared;
  const H = SL.creditsHelpers;

  /** فض_رسالة_حالة_الوسيط_من_/api/status */
  // # FN formatBrokerStatusLine
  // # KW حالة,webhook,SSE,status
  function formatBrokerStatusLine(statusData) {
    // # guard — شرط رفض أو خروج مبكر
    if (!statusData || typeof statusData !== 'object') return '';
    // # guard — شرط رفض أو خروج مبكر
    if (statusData.redis_ok === false) {
      // # return — إرجاع النتيجة
      return 'API up — Redis/broker down';
    }
    // # guard — شرط رفض أو خروج مبكر
    if (statusData.redis_ok === true) return 'API + queue OK';
    // # return — إرجاع النتيجة
    return '';
  }

  /** فحص_اتصال_API_وعرض_الحالة — init (ضيف) + status + تحقق JWT إن وُجد توكن */
  // # FN checkApiConnectionAndUpdateBadge
  // # AR Probe API; pulse logo i-tittle when unreachable (no text banner)
  // # KW عام,general
  async function checkApiConnectionAndUpdateBadge() {
    const srv = document.getElementById('srv');
    const srvTxt = document.getElementById('srvTxt');

    // # FN hideSrvBadge
    // # AR Always hide legacy connection banner
    // # KW عام,general
    function hideSrvBadge() {
      // # شرط — فرع منطقي
      if (srv) srv.style.display = 'none';
      // # شرط — فرع منطقي
      if (srvTxt) srvTxt.textContent = '';
      // # block — تحديث واجهة/DOM
      document.querySelectorAll('.srv-badge').forEach(function (el) {
        el.style.display = 'none';
      });
    }

    // # FN setApiUnreachableUi
    // # AR Toggle html.api-unreachable → animated logo i-tittle
    // # KW عام,general
    function setApiUnreachableUi(down) {
      const root = document.documentElement;
      // # شرط — فرع منطقي
      if (down) root.classList.add('api-unreachable');
      else root.classList.remove('api-unreachable');
      document.querySelectorAll('a.logo').forEach(function (el) {
        // # شرط — فرع منطقي
        if (down) {
          // # block — فرع شرطي
          el.setAttribute('title', 'Server unreachable');
          el.setAttribute('aria-description', 'API server is not reachable');
        // # block — فرع شرطي
        } else {
          el.removeAttribute('title');
          el.removeAttribute('aria-description');
        }
      // # block — تنفيذ منطق — راجع الأسطر التالية
      });
    }

    // # FN setConnected
    // # AR دالة setConnected (setConnected)
    // # KW عام,general
    function setConnected(extra) {
      hideSrvBadge();
      setApiUnreachableUi(false);
      // # شرط — فرع منطقي
      if (srvTxt) srvTxt.textContent = extra ? 'Connected (' + extra + ')' : 'Connected';
      // # شرط — فرع منطقي
      if (srv) srv.classList.add('on');
    // # block — تحديث واجهة/DOM
    }
    // # FN setFailed
    // # AR تعيين failed (setFailed); unreachable=true → pulse i-tittle
    // # KW عام,general
    function setFailed(msg, unreachable) {
      hideSrvBadge();
      setApiUnreachableUi(unreachable !== false);
      // # شرط — فرع منطقي
      if (srvTxt) srvTxt.textContent = msg || 'Cannot reach API';
      // # شرط — فرع منطقي
      if (srv) srv.classList.remove('on');
    }

    // # block — فرع شرطي
    hideSrvBadge();

    let brokerHint = '';

    // # try — معالجة عملية قد تفشل
    try {
      // # HTTP — طلب إلى API
      const statusRes = await fetch(`${SL.apiBase}/api/status`, {
        headers: { Accept: 'application/json' },
      });
      // # parse — قراءة JSON من الاستجابة
      const statusData = await statusRes.json().catch(() => ({}));
      // # شرط — فرع منطقي
      if (statusRes.ok) {
        // # block — طلب HTTP/API
        brokerHint = formatBrokerStatusLine(statusData);
        // # شرط — فرع منطقي
        if (statusData.redis_ok === false) {
          console.warn('[API] Redis broker unreachable on server:', statusData.redis_error);
        }
      // # block — فرع شرطي
      }
    } catch (_) { /* status optional */ }

    // # localStorage — تخزين محلي
    const token = localStorage.getItem('token');
    const authHeaders =
      token && typeof global.getApiAuthHeaders === 'function'
        ? global.getApiAuthHeaders()
        // # block — تحديث واجهة/DOM
        : null;

    // # شرط — فرع منطقي
    if (authHeaders) {
      // # try — معالجة عملية قد تفشل
      try {
        // # HTTP — طلب إلى API
        const authRes = await fetch(`${SL.apiBase}/api/user/init`, {
          method: 'POST',
          headers: { ...authHeaders, Accept: 'application/json' },
        // # block — طلب HTTP/API
        });
        // # parse — قراءة JSON من الاستجابة
        const authData = await authRes.json().catch(() => ({}));
        // # guard — شرط رفض أو خروج مبكر
        if (authRes.status === 401) {
          setFailed('Auth failed — sign in again', false);
          // # return — إرجاع النتيجة
          return;
        }
        // # guard — شرط رفض أو خروج مبكر
        if (authRes.ok && H.apiResponseIndicatesSuccess(authData)) {
          setConnected(brokerHint || 'signed in');
          // # block — فرع شرطي
          H.dismissConnectionCheckingUi();
          // # return — إرجاع النتيجة
          return;
        }
      } catch (_) { /* fall through to guest probe */ }
    // # block — معالجة أخطاء
    }

    // # try — معالجة عملية قد تفشل
    try {
      // # HTTP — طلب إلى API
      const res = await fetch(`${SL.apiBase}/api/user/init`, {
        method: 'POST',
        headers: { Accept: 'application/json' },
      });
      // # parse — قراءة JSON من الاستجابة
      const data = await res.json().catch(() => ({}));
      // # guard — شرط رفض أو خروج مبكر
      if (res.ok && H.apiResponseIndicatesSuccess(data)) {
        // # guard — شرط رفض أو خروج مبكر
        if (data.guest === true && token) {
          setFailed('Guest mode — sign in for dubbing', false);
          // # return — إرجاع النتيجة
          return;
        }
        // # block — فرع شرطي
        setConnected(brokerHint || (data.guest ? 'guest' : 'ok'));
        H.dismissConnectionCheckingUi();
        // # return — إرجاع النتيجة
        return;
      }
      setFailed(res.status ? 'API error (' + res.status + ')' : 'Unexpected response', true);
    } catch (e) {
      // # block — معالجة أخطاء
      setFailed('Cannot reach API — check API_BASE in config.js', true);
      console.warn('[API] connection failed:', SL.apiBase, e);
    // # block — معالجة أخطاء
    }
  }

  SL.connection = { checkApiConnectionAndUpdateBadge };
  global.checkConnection = checkApiConnectionAndUpdateBadge;
})(window);
