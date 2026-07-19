// # FILE frontend/sl-dubbing-frontend-main/js/dubbing/03-api-fetch.js
// # AR واجهة الدبلجة — رفع، Start، polling، أصوات
// # KW عام,general
// # CONVENTION — FN/AR/KW + # block كل ~6 أسطر — FUNCTION_INDEX.md DOMAIN_INDEX.md
// dubbing/03-api-fetch.js — HTTP helpers with retry
(function (global) {
  const DubbingApp = global.DubbingApp;
  const { normalizeApiBaseUrl, getDubbingApiAuthHeaders } = DubbingApp.api;

  // # FN fetchHttpWithRateLimitRetry
  // # AR دالة fetchHttpWithRateLimitRetry (fetchHttpWithRateLimitRetry)
  // # KW عام,general
  async function fetchHttpWithRateLimitRetry(url, options, { retries = 3, baseDelayMs = 500 } = {}) {
    let res;
    for (let attempt = 0; attempt <= retries; attempt++) {
      // # HTTP — طلب إلى API
      res = await fetch(url, options);
      // # guard — شرط رفض أو خروج مبكر
      if (res.status !== 429 || attempt === retries) return res;
      const retryAfter = parseInt(res.headers.get('Retry-After') || '0', 10);
      // # block — طلب HTTP/API
      const waitMs = retryAfter > 0 ? retryAfter * 1000 : baseDelayMs * Math.pow(2, attempt);
      await new Promise((r) => setTimeout(r, waitMs));
    }
    // # return — إرجاع النتيجة
    return res;
  }

  // # FN fetchDubbingJobStatusFromSupabaseTable
  // # AR جلب dubbing job status from supabase table (fetchDubbingJobStatusFromSupabaseTable)
  // # KW مهمة,job,polling,celery,worker,مصادقة,auth,JWT,supabase,حالة,webhook,SSE,status
  async function fetchDubbingJobStatusFromSupabaseTable(jobId) {
    const supa = typeof global.getSupabase === 'function' ? global.getSupabase() : null;
    // # guard — شرط رفض أو خروج مبكر
    if (!supa) return null;
    // # try — معالجة عملية قد تفشل
    try {
      const { data, error } = await supa
        .from('dubbing_jobs')
        // # block — معالجة أخطاء
        .select('status, output_url, error')
        .eq('id', jobId)
        .maybeSingle();
      // # guard — شرط رفض أو خروج مبكر
      if (error) return null;
      // # return — إرجاع النتيجة
      return data;
    } catch (err) {
      // # return — إرجاع النتيجة
      return null;
    }
  }

  DubbingApp.fetch = {
    fetchHttpWithRateLimitRetry,
    fetchDubbingJobStatusFromSupabaseTable,
  };

  global.fetchWithRetry = fetchHttpWithRateLimitRetry;
  global.fetchJobStatusFromSupabase = fetchDubbingJobStatusFromSupabaseTable;
})(window);
