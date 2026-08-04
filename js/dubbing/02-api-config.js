// # FILE frontend/sl-dubbing-frontend-main/js/dubbing/02-api-config.js
// # AR واجهة الدبلجة — رفع، Start، polling، أصوات
// # KW عام,general
// # CONVENTION — FN/AR/KW + # block كل ~6 أسطر — FUNCTION_INDEX.md DOMAIN_INDEX.md
// =====================================================================
// 📒 فهرس الدوال — js/dubbing/02-api-config.js
// ---------------------------------------------------------------------
//  تطبيع_رابط_API              → normalizeApiBaseUrl
//  ترويسات_مصادقة_الدبلجة      → getDubbingApiAuthHeaders
//  رابط_SSE_حالة_المهمة        → buildDubbingJobStatusStreamUrl
//  رابط_استطلاع_حالة_المهمة    → buildDubbingJobPollStatusUrl
//  مفتاح_تخزين_الصوت_المخصص    → getLocalStorageKeyForUserCustomVoice
//  استخراج_رابط_عينة_من_الرفع  → resolveSampleUrlFromUploadApiResponse
//  auth headers + upload/status URL builders
// =====================================================================
(function (global) {
  const DubbingApp = global.DubbingApp;

  // # FN normalizeApiBaseUrl
  // # KW عام,general
  function normalizeApiBaseUrl() {
    const cfg = global.APP_CONFIG || {};
    const raw = global.API_BASE || cfg.API_BASE || 'https://api.glotix.ai';
    // # guard — شرط رفض أو خروج مبكر
    if (raw === '' || cfg.USE_GO_GATEWAY === true) {
      return String(global.location?.origin || '').replace(/\/$/, '');
    }
    // # block — فرع شرطي
    return String(raw).replace(/\/$/, '').replace(/([^:]\/)\/+/g, '$1');
  }

  // # FN getDubbingApiAuthHeaders
  // # AR المصادقة والجلسة (getDubbingApiAuthHeaders)
  // # KW مصادقة,auth,JWT,supabase
  function getDubbingApiAuthHeaders() {
    return typeof global.getApiAuthHeaders === 'function' ? global.getApiAuthHeaders() : null;
  }

  // # FN buildDubbingJobStatusStreamUrl
  // # AR مهام المعالجة (buildDubbingJobStatusStreamUrl)
  // # KW مهمة,job,polling,celery,worker,حالة,webhook,SSE,status
  function buildDubbingJobStatusStreamUrl(jobId) {
    const id = String(jobId || '').trim();
    return `${normalizeApiBaseUrl()}/api/dub/status/${encodeURIComponent(id)}`;
  }

  // # FN buildDubbingJobPollStatusUrl
  // # AR مهام المعالجة (buildDubbingJobPollStatusUrl)
  // # KW مهمة,job,polling,celery,worker,حالة,webhook,SSE,status
  function buildDubbingJobPollStatusUrl(jobId) {
    return `${normalizeApiBaseUrl()}/api/job/${encodeURIComponent(String(jobId || '').trim())}`;
  }

  // # FN buildDubbingJobCancelUrl
  // # AR مهام المعالجة (buildDubbingJobCancelUrl)
  // # KW مهمة,job,polling,celery,worker
  function buildDubbingJobCancelUrl(jobId) {
    const id = String(jobId || '').trim();
    return `${normalizeApiBaseUrl()}/api/dub/${encodeURIComponent(id)}/cancel`;
  }

  /** استخراج_رابط_عينة_من_الرفع — يفضّل public_url/download_url ولا يستخدم file_key وحده */
  // # FN resolveSampleUrlFromUploadApiResponse
  // # KW صوت,استنساخ,voice,clone,sample,رفع,upload,R2,storage
  function resolveSampleUrlFromUploadApiResponse(urlData) {
    // # guard — شرط رفض أو خروج مبكر
    if (!urlData || typeof urlData !== 'object') return '';
    const direct = (
      urlData.public_url ||
      urlData.download_url ||
      urlData.file_url ||
      // # block — فرع شرطي
      ''
    ).trim();
    // # guard — شرط رفض أو خروج مبكر
    if (direct) return direct;
    const key = String(urlData.file_key || '').trim();
    // # guard — شرط رفض أو خروج مبكر
    if (!key) return '';
    // # guard — شرط رفض أو خروج مبكر
    if (/^https?:\/\//i.test(key)) return key;
    // # return — إرجاع النتيجة
    return '';
  }

  // # FN resolveLocalStorageUserIdSuffix
  // # AR رفع الملفات والتخزين (resolveLocalStorageUserIdSuffix)
  // # KW رفع,upload,R2,storage,تنفيذ,local,cloud,modal,parity
  function resolveLocalStorageUserIdSuffix() {
    // # localStorage — تخزين محلي
    const token = localStorage.getItem('token') || '';
    let uid = 'guest';
    // # شرط — فرع منطقي
    if (token && typeof global.parseJwtSub === 'function') {
      uid = global.parseJwtSub(token) || 'guest';
    } else if (token) {
      // # try — معالجة عملية قد تفشل
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        uid = payload.sub || payload.id || 'guest';
      } catch (e) { /* ignore */ }
    }
    // # return — إرجاع النتيجة
    return uid;
  }

  // # FN getLocalStorageKeyForUserCustomVoice
  // # AR الصوت والاستنساخ (getLocalStorageKeyForUserCustomVoice)
  // # KW صوت,استنساخ,voice,clone,sample,رفع,upload,R2,storage,تنفيذ,local,cloud,modal,parity
  function getLocalStorageKeyForUserCustomVoice() {
    return 'glotix_custom_voice_' + resolveLocalStorageUserIdSuffix();
  }

  // # FN getLocalStorageKeyForPendingDubJobs
  // # AR جلب local storage key for pending dub jobs (getLocalStorageKeyForPendingDubJobs)
  // # KW رفع,upload,R2,storage,مهمة,job,polling,celery,worker,تنفيذ,local,cloud,modal,parity
  function getLocalStorageKeyForPendingDubJobs() {
    return 'glotix_pending_dub_jobs_' + resolveLocalStorageUserIdSuffix();
  }

  // # FN isEphemeralDubbingEnabled
  // # AR Session-only dubbing: no resume / history after refresh (credits stay)
  // # KW مهمة,job,رصيد,credits
  function isEphemeralDubbingEnabled() {
    // Default OFF — persist up to 5 dubbed videos per user (FIFO R2 eviction).
    // Opt in: window.GLOTIX_EPHEMERAL_DUB = true or localStorage glotix_ephemeral_dub=1
    // # guard — رفض/خروج
    if (typeof global.GLOTIX_EPHEMERAL_DUB === 'boolean') return global.GLOTIX_EPHEMERAL_DUB;
    // # try — عملية قد تفشل
    try {
      const v = localStorage.getItem('glotix_ephemeral_dub');
      // # guard — رفض/خروج
      if (v === '1' || v === 'true') return true;
      // # guard — رفض/خروج
      if (v === '0' || v === 'false') return false;
    // # block — تحديث واجهة/DOM
    } catch (_) {}
    return false;
  }

  // # FN clearPersistedPendingDubJobs
  // # AR Wipe any leftover pending-job localStorage keys (ephemeral mode)
  // # KW مهمة,job,polling,celery,worker
  function clearPersistedPendingDubJobs() {
    // # try — عملية قد تفشل
    try {
      localStorage.removeItem(getLocalStorageKeyForPendingDubJobs());
      const keys = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        // # شرط
        if (k && k.startsWith('glotix_pending_dub_jobs_')) keys.push(k);
      }
      keys.forEach((k) => localStorage.removeItem(k));
    } catch (_) {}
  }

  DubbingApp.api = {
    normalizeApiBaseUrl,
    getDubbingApiAuthHeaders,
    buildDubbingJobStatusStreamUrl,
    buildDubbingJobPollStatusUrl,
    buildDubbingJobCancelUrl,
    resolveSampleUrlFromUploadApiResponse,
    getLocalStorageKeyForUserCustomVoice,
    getLocalStorageKeyForPendingDubJobs,
    isEphemeralDubbingEnabled,
    clearPersistedPendingDubJobs,
  };

  global.getApiBase = normalizeApiBaseUrl;
  global.GET_API_URL = normalizeApiBaseUrl;
  global.getUploadAuthHeaders = getDubbingApiAuthHeaders;
  global.getUserVoiceKey = getLocalStorageKeyForUserCustomVoice;
})(window);
