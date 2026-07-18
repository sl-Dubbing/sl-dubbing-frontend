// # FILE frontend/sl-dubbing-frontend-main/js/dubbing/04-job-status.js
// # AR واجهة الدبلجة — رفع، Start، polling، أصوات
// # KW مهمة,job,حالة,webhook
// # CONVENTION — FN/AR/KW + # block كل ~6 أسطر — FUNCTION_INDEX.md DOMAIN_INDEX.md
// dubbing/04-job-status.js — Parse and poll dubbing job status (load after voice-save)
(function (global) {
  const DubbingApp = global.DubbingApp;
  const S = DubbingApp.state;
  const {
    buildDubbingJobPollStatusUrl,
    buildDubbingJobStatusStreamUrl,
    getDubbingApiAuthHeaders,
  } = DubbingApp.api;
  const { fetchHttpWithRateLimitRetry, fetchDubbingJobStatusFromSupabaseTable } = DubbingApp.fetch;

  // # FN extractDubbingJobIdFromStartResponse
  // # AR مهام المعالجة (extractDubbingJobIdFromStartResponse)
  // # KW مهمة,job,polling,celery,worker,حالة,webhook,SSE,status
  function extractDubbingJobIdFromStartResponse(body) {
    // # return — إرجاع النتيجة
    return String(body?.job_id || body?.id || '').trim();
  }

  // # FN normalizeDubbingJobStatus
  // # KW مهمة,job,polling,celery,worker,حالة,webhook,SSE,status
  function normalizeDubbingJobStatus(status) {
    const s = String(status || '').trim().toLowerCase();
    // # guard — شرط رفض أو خروج مبكر
    if (['complete', 'done', 'success', 'succeeded'].includes(s)) return 'completed';
    // # guard — شرط رفض أو خروج مبكر
    if (['cancelled', 'canceled'].includes(s)) return 'cancelled';
    // # guard — شرط رفض أو خروج مبكر
    if (['error', 'failure', 'fail'].includes(s)) return 'failed';
    // # return — إرجاع النتيجة
    return s;
  }

  // # FN extractMediaOutputUrlFromJobPayload
  // # AR مهام المعالجة (extractMediaOutputUrlFromJobPayload)
  // # KW مهمة,job,polling,celery,worker,حالة,webhook,SSE,status
  function extractMediaOutputUrlFromJobPayload(data) {
    return String(data?.output_url || data?.video_url || data?.audio_url || data?.url || '').trim();
  }

  // # FN parseDubbingJobStatusApiPayload
  // # AR مهام المعالجة (parseDubbingJobStatusApiPayload)
  // # KW مهمة,job,polling,celery,worker,حالة,webhook,SSE,status
  function parseDubbingJobStatusApiPayload(data) {
    // # return — إرجاع النتيجة
    return {
      status: normalizeDubbingJobStatus(data?.status),
      output_url: extractMediaOutputUrlFromJobPayload(data),
      error: data?.error || data?.message || '',
      stage: String(data?.stage || '').trim(),
      // # block — إرجاع نتيجة
      progress: Number(data?.progress) || 0,
    };
  }

  // # FN abortActiveDubbingWorkInProgress
  // # AR مهام المعالجة (abortActiveDubbingWorkInProgress)
  // # KW مهمة,job,polling,celery,worker,حالة,webhook,SSE,status
  function abortActiveDubbingWorkInProgress() {
    // # شرط — فرع منطقي
    if (S.workAbortController) {
      S.workAbortController.abort();
      S.workAbortController = null;
    }
  }

  // # FN applyExtractedVocalsUrlFromJobStatus
  // # KW صوت,استنساخ,voice,clone,sample,فصل_صوت,demucs,vocals,UVR,مهمة,job,polling,celery,worker,حالة,webhook,SSE,status
  function applyExtractedVocalsUrlFromJobStatus(data) {
    // # guard — شرط رفض أو خروج مبكر
    if (!data || typeof data !== 'object') return;
    const sample = (data.sample_url || data.vocals_url || data.extracted_vocals_url || '').trim();
    // # guard — شرط رفض أو خروج مبكر
    if (!sample) return;
    // # شرط — فرع منطقي
    if (DubbingApp.voice?.setExtractedVocalsUrlForVoiceSave) {
      DubbingApp.voice.setExtractedVocalsUrlForVoiceSave(sample);
    // # block — معالجة صوت/استنساخ
    }
  }

  // # FN maybePromptUserToSaveExtractedVoice
  // # AR الصوت والاستنساخ (maybePromptUserToSaveExtractedVoice)
  // # KW صوت,استنساخ,voice,clone,sample,مهمة,job,polling,celery,worker,حالة,webhook,SSE,status
  function maybePromptUserToSaveExtractedVoice(data) {
    // # guard — شرط رفض أو خروج مبكر
    if (!data || typeof data !== 'object') return;
    applyExtractedVocalsUrlFromJobStatus(data);
  }

  // # FN resolveAccessTokenForDubbingJobStream
  // # AR مهام المعالجة (resolveAccessTokenForDubbingJobStream)
  // # KW مهمة,job,polling,celery,worker,مصادقة,auth,JWT,supabase,حالة,webhook,SSE,status
  function resolveAccessTokenForDubbingJobStream() {
    const headers = getDubbingApiAuthHeaders();
    const auth = String(headers?.Authorization || '').trim();
    // # guard — رفض/خروج
    if (auth.toLowerCase().startsWith('bearer ')) {
      return auth.slice(7).trim();
    }
    // # block — تحديث واجهة/DOM
    return String(global.localStorage?.getItem('token') || '').trim();
  }

  // # FN watchDubbingJobViaSse
  // # KW مهمة,job,polling,celery,worker,حالة,webhook,SSE,status
  function watchDubbingJobViaSse(jobId, signal, onProgressTick) {
    const id = String(jobId || '').trim();
    // # guard — رفض/خروج
    if (!id) {
      return Promise.reject(new Error('Missing job id'));
    }
    const token = resolveAccessTokenForDubbingJobStream();
    // # guard — رفض/خروج
    if (!token) {
      return Promise.reject(new Error('Missing auth token for SSE'));
    }
    const baseUrl = buildDubbingJobStatusStreamUrl(id);
    const streamUrl =
      baseUrl +
      // # block — حلقة/تكرار
      (baseUrl.includes('?') ? '&' : '?') +
      'access_token=' +
      encodeURIComponent(token);

    return new Promise((resolve, reject) => {
      let settled = false;
      let es = null;
      // # block — إرجاع نتيجة
      const started = Date.now();

      // # FN finish
      // # AR مهام المعالجة (finish)
      // # KW مهمة,job,polling,celery,worker,حالة,webhook,SSE,status
      const finish = (fn, value) => {
        // # guard — رفض/خروج
        if (settled) return;
        settled = true;
        // # شرط
        if (es) {
          es.close();
          // # block — فرع شرطي
          es = null;
        // # block — فرع شرطي
        }
        fn(value);
      };

      // # FN onAbort
      // # AR مهام المعالجة (onAbort)
      // # KW مهمة,job,polling,celery,worker,حالة,webhook,SSE,status
      const onAbort = () => finish(reject, new DOMException('Aborted', 'AbortError'));
      // # شرط
      if (signal) signal.addEventListener('abort', onAbort, { once: true });

      // # FN handlePayload
      // # AR مهام المعالجة (handlePayload)
      // # KW مهمة,job,polling,celery,worker,حالة,webhook,SSE,status
      const handlePayload = (data, eventName) => {
        maybePromptUserToSaveExtractedVoice(data);
        const parsed = parseDubbingJobStatusApiPayload(data);
        // # شرط
        if (typeof onProgressTick === 'function') {
          onProgressTick({
            stage: parsed.stage || data?.stage,
            // # block — معالجة صوت/استنساخ
            progress: parsed.progress || data?.progress,
            status: parsed.status || data?.status,
          });
        }
        // # شرط
        if (parsed.status === 'completed' || eventName === 'completed') {
          const sample = (
            // # block — معالجة صوت/استنساخ
            data.sample_url || data.vocals_url || data.extracted_vocals_url || ''
          ).trim();
          return finish(resolve, {
            status: 'completed',
            output_url: parsed.output_url || extractMediaOutputUrlFromJobPayload(data),
            sample_url: sample,
            // # block — معالجة صوت/استنساخ
            vocals_url: (data.vocals_url || '').trim(),
            extracted_vocals_url: (data.extracted_vocals_url || '').trim(),
            ref_text: (data.ref_text || data.sample_text || '').trim(),
          });
        }
        // # guard — رفض/خروج
        if (parsed.status === 'failed' || eventName === 'failed') {
          // # block — معالجة صوت/استنساخ
          return finish(reject, new Error(parsed.error || data?.error || 'Worker encountered an error'));
        }
        // # guard — رفض/خروج
        if (parsed.status === 'cancelled') {
          return finish(reject, new DOMException('Cancelled', 'AbortError'));
        }
      };

      // # block — معالجة أخطاء
      es = new EventSource(streamUrl);

      let sseErrorStreak = 0;
      es.addEventListener('progress', (evt) => {
        // # guard — رفض/خروج
        if (settled) return;
        sseErrorStreak = 0;
        // # guard — رفض/خروج
        if (Date.now() - started > 45 * 60 * 1000) {
          // # block — فرع شرطي
          return finish(reject, new Error('Dubbing timed out'));
        }
        // # try — عملية قد تفشل
        try {
          handlePayload(JSON.parse(evt.data || '{}'), 'progress');
        } catch (e) {
          /* ignore malformed SSE payload */
        // # block — parse/serialize JSON
        }
      });

      es.addEventListener('completed', (evt) => {
        // # guard — رفض/خروج
        if (settled) return;
        sseErrorStreak = 0;
        // # try — عملية قد تفشل
        try {
          // # block — parse/serialize JSON
          handlePayload(JSON.parse(evt.data || '{}'), 'completed');
        } catch (e) {
          finish(reject, new Error('Invalid completed event'));
        }
      });

      es.addEventListener('failed', (evt) => {
        // # guard — رفض/خروج
        if (settled) return;
        // # try — عملية قد تفشل
        try {
          handlePayload(JSON.parse(evt.data || '{}'), 'failed');
        } catch (e) {
          finish(reject, new Error('Dubbing failed'));
        }
      // # block — parse/serialize JSON
      });

      // EventSource auto-reconnects; only fail over after sustained CLOSED state.
      es.onerror = () => {
        // # guard — رفض/خروج
        if (settled) return;
        sseErrorStreak += 1;
        // # شرط
        if (es.readyState === EventSource.CLOSED && sseErrorStreak >= 3) {
          finish(reject, new Error('SSE connection lost'));
        // # block — فرع شرطي
        }
      };
    });
  }

  // # FN pollDubbingJobUntilComplete
  // # KW مهمة,job,polling,celery,worker,حالة,webhook,SSE,status
  function pollDubbingJobUntilComplete(jobId, signal, onProgressTick) {
    const id = String(jobId || '').trim();
    // # guard — شرط رفض أو خروج مبكر
    if (!id) {
      // # return — إرجاع النتيجة
      return Promise.reject(new Error('Missing job id'));
    }
    // # return — إرجاع النتيجة
    return new Promise((resolve, reject) => {
      // # block — فرع شرطي
      const headers = getDubbingApiAuthHeaders();
      const url = buildDubbingJobPollStatusUrl(id);
      let settled = false;
      let timer = null;
      const started = Date.now();

      // # FN finish
      // # KW مهمة,job,polling,celery,worker,حالة,webhook,SSE,status
      const finish = (fn, value) => {
        // # guard — شرط رفض أو خروج مبكر
        if (settled) return;
        settled = true;
        clearInterval(timer);
        fn(value);
      };
      // # FN onAbort
      // # KW مهمة,job,polling,celery,worker,حالة,webhook,SSE,status
      const onAbort = () => finish(reject, new DOMException('Aborted', 'AbortError'));
      // # شرط — فرع منطقي
      if (signal) signal.addEventListener('abort', onAbort, { once: true });

      // # FN tick
      // # KW مهمة,job,polling,celery,worker,حالة,webhook,SSE,status
      const tick = async () => {
        // # guard — شرط رفض أو خروج مبكر
        if (settled) return;
        // # guard — شرط رفض أو خروج مبكر
        if (Date.now() - started > 45 * 60 * 1000) {
          // # return — إرجاع النتيجة
          return finish(reject, new Error('Dubbing timed out'));
        }
        // # block — فرع شرطي
        let tickMeta = null;
        // # try — معالجة عملية قد تفشل
        try {
          // # HTTP — طلب إلى API
          const res = await fetch(url, { headers, signal });
          // # شرط — فرع منطقي
          if (res.ok) {
            // # parse — قراءة JSON من الاستجابة
            const data = await res.json().catch(() => ({}));
            maybePromptUserToSaveExtractedVoice(data);
            // # block — طلب HTTP/API
            const parsed = parseDubbingJobStatusApiPayload(data);
            // # شرط — فرع منطقي
            if (parsed.status === 'completed') {
              // # block — معالجة صوت/استنساخ
              const sample = (
                data.sample_url || data.vocals_url || data.extracted_vocals_url || ''
              ).trim();
              // # return — إرجاع النتيجة
              return finish(resolve, {
                // # block — معالجة صوت/استنساخ
                status: 'completed',
                // # block — معالجة صوت/استنساخ
                output_url: parsed.output_url,
                // # block — معالجة صوت/استنساخ
                sample_url: sample,
                vocals_url: (data.vocals_url || '').trim(),
                extracted_vocals_url: (data.extracted_vocals_url || '').trim(),
                ref_text: (data.ref_text || data.sample_text || '').trim(),
              // # block — معالجة صوت/استنساخ
              });
            // # block — معالجة صوت/استنساخ
            }
            // # guard — شرط رفض أو خروج مبكر
            if (parsed.status === 'failed') {
              return finish(reject, new Error(parsed.error || 'Worker encountered an error'));
            }
            // # guard — رفض/خروج
            if (parsed.status === 'cancelled') {
              // # block — معالجة أخطاء
              return finish(reject, new DOMException('Cancelled', 'AbortError'));
            // # block — معالجة أخطاء
            }
            tickMeta = {
              stage: parsed.stage || data?.stage,
              progress: parsed.progress || data?.progress,
              status: parsed.status || data?.status,
            // # block — تنفيذ منطق — راجع الأسطر التالية
            };
          // # block — فرع شرطي
          } else if (res.status === 404) {
            const supaData = await fetchDubbingJobStatusFromSupabaseTable(id);
            // # guard — شرط رفض أو خروج مبكر
            if (supaData) {
              // # block — فرع شرطي
              const supaStatus = normalizeDubbingJobStatus(supaData.status);
              // # guard — شرط رفض أو خروج مبكر
              if (supaStatus === 'completed') {
                // # return — إرجاع النتيجة
                return finish(resolve, {
                  // # block — فرع شرطي
                  status: 'completed',
                  output_url: extractMediaOutputUrlFromJobPayload(supaData),
                // # block — فرع شرطي
                });
              // # block — فرع شرطي
              }
              // # guard — شرط رفض أو خروج مبكر
              if (supaStatus === 'failed') {
                // # return — إرجاع النتيجة
                return finish(
                  // # block — فرع شرطي
                  reject,
                  new Error(supaData.error || 'Worker encountered an error (via Supabase)'),
                // # block — فرع شرطي
                );
              // # block — فرع شرطي
              }
            }
            // # guard — شرط رفض أو خروج مبكر
            if (Date.now() - started > 90 * 1000) {
              // # return — إرجاع النتيجة
              return finish(
                reject,
                // # block — نقاط/credits
                new Error('Dubbing failed — job not found. Your credits were refunded.'),
              // # block — نقاط/credits
              );
            }
          // # block — نقاط/credits
          } else if (res.status >= 500) {
            // # block — نقاط/credits
            const supaData = await fetchDubbingJobStatusFromSupabaseTable(id);
            // # guard — شرط رفض أو خروج مبكر
            if (supaData) {
              // # block — فرع شرطي
              const supaStatus = normalizeDubbingJobStatus(supaData.status);
              // # guard — شرط رفض أو خروج مبكر
              if (supaStatus === 'completed') {
                // # return — إرجاع النتيجة
                return finish(resolve, {
                  // # block — فرع شرطي
                  status: 'completed',
                  // # block — فرع شرطي
                  output_url: extractMediaOutputUrlFromJobPayload(supaData),
                });
              // # block — فرع شرطي
              }
              // # guard — شرط رفض أو خروج مبكر
              if (supaStatus === 'failed') {
                // # return — إرجاع النتيجة
                return finish(
                  // # block — فرع شرطي
                  reject,
                  // # block — فرع شرطي
                  new Error(supaData.error || 'Worker encountered an error (via Supabase)'),
                );
              // # block — فرع شرطي
              }
            // # block — إرجاع نتيجة
            }
          }
        // # block — معالجة أخطاء
        } catch (err) {
          // # guard — شرط رفض أو خروج مبكر
          if (err.name === 'AbortError') return finish(reject, err);
          const supaData = await fetchDubbingJobStatusFromSupabaseTable(id);
          // # guard — شرط رفض أو خروج مبكر
          if (supaData) {
            // # block — معالجة أخطاء
            const supaStatus = normalizeDubbingJobStatus(supaData.status);
            // # guard — شرط رفض أو خروج مبكر
            if (supaStatus === 'completed') {
              // # return — إرجاع النتيجة
              return finish(resolve, {
                // # block — فرع شرطي
                status: 'completed',
                output_url: extractMediaOutputUrlFromJobPayload(supaData),
              // # block — فرع شرطي
              });
            // # block — فرع شرطي
            }
            // # guard — شرط رفض أو خروج مبكر
            if (supaStatus === 'failed') {
              // # block — فرع شرطي
              return finish(reject, new Error(supaData.error || 'Worker error'));
            // # block — فرع شرطي
            }
          }
        // # block — فرع شرطي
        }
        // # شرط — فرع منطقي
        if (tickMeta && typeof onProgressTick === 'function') {
          onProgressTick(tickMeta);
        // # block — فرع شرطي
        }
      // # block — فرع شرطي
      };

      timer = setInterval(tick, 3000);
      tick();
    });
  }

  // # FN watchDubbingJobUntilFinished
  // # AR متابعة dubbing job until finished (watchDubbingJobUntilFinished)
  // # KW مهمة,job,polling,celery,worker,حالة,webhook,SSE,status
  async function watchDubbingJobUntilFinished(jobId, signal, onProgressTick) {
    const useSse = global.APP_CONFIG?.DUB_USE_SSE === true;
    // # guard — رفض/خروج
    if (!useSse) {
      return pollDubbingJobUntilComplete(jobId, signal, onProgressTick);
    }

    // Race SSE against DB polling. Process-local progress cache on Railway can
    // hide "completed" from the SSE worker while GET /api/job still reads Postgres.
    const localAc = new AbortController();
    // # FN stopBoth
    // # AR مهام المعالجة (stopBoth)
    // # KW مهمة,job,polling,celery,worker,حالة,webhook,SSE,status
    const stopBoth = () => {
      // # try — عملية قد تفشل
      try {
        localAc.abort();
      } catch (_) {
        /* ignore */
      }
    // # block — معالجة أخطاء
    };
    // # FN onParentAbort
    // # AR مهام المعالجة (onParentAbort)
    // # KW مهمة,job,polling,celery,worker,حالة,webhook,SSE,status
    const onParentAbort = () => stopBoth();
    // # guard — رفض/خروج
    if (signal) {
      // # guard — رفض/خروج
      if (signal.aborted) {
        throw new DOMException('Aborted', 'AbortError');
      }
      // # block — معالجة أخطاء
      signal.addEventListener('abort', onParentAbort, { once: true });
    }

    const linked = localAc.signal;
    let winnerTaken = false;

    // # FN asSettled
    // # AR مهام المعالجة (asSettled)
    // # KW مهمة,job,polling,celery,worker,حالة,webhook,SSE,status
    const asSettled = (promise, label) =>
      promise.then(
        // # block — تنفيذ منطق — راجع الأسطر التالية
        (value) => {
          // # guard — رفض/خروج
          if (winnerTaken) return { skipped: true };
          winnerTaken = true;
          stopBoth();
          // # block — فرع شرطي
          return { ok: true, value, label };
        },
        // # block — فرع شرطي
        (err) => ({ ok: false, err, label }),
      );

    const sseResult = asSettled(
      watchDubbingJobViaSse(jobId, linked, onProgressTick),
      'sse',
    );
    // # block — تنفيذ منطق — راجع الأسطر التالية
    const pollResult = asSettled(
      pollDubbingJobUntilComplete(jobId, linked, onProgressTick),
      'poll',
    );

    // # try — عملية قد تفشل
    try {
      const first = await Promise.race([sseResult, pollResult]);
      // # guard — رفض/خروج
      if (first && first.ok) return first.value;

      const second = await (first?.label === 'sse' ? pollResult : sseResult);
      // # guard — رفض/خروج
      if (second && second.ok) return second.value;

      const err =
        (second && !second.skipped && second.err) ||
        (first && first.err) ||
        // # block — فرع شرطي
        new Error('Dubbing status watch failed');
      throw err;
    } finally {
      // # شرط
      if (signal) signal.removeEventListener('abort', onParentAbort);
      stopBoth();
    }
  }

  DubbingApp.jobStatus = {
    extractDubbingJobIdFromStartResponse,
    normalizeDubbingJobStatus,
    extractMediaOutputUrlFromJobPayload,
    parseDubbingJobStatusApiPayload,
    abortActiveDubbingWorkInProgress,
    applyExtractedVocalsUrlFromJobStatus,
    pollDubbingJobUntilComplete,
    watchDubbingJobViaSse,
    watchDubbingJobUntilFinished,
  };

  global.extractJobIdFromDubResponse = extractDubbingJobIdFromStartResponse;
  global.normalizeJobStatus = normalizeDubbingJobStatus;
  global.extractOutputUrl = extractMediaOutputUrlFromJobPayload;
  global.parseJobStatusPayload = parseDubbingJobStatusApiPayload;
  global.abortActiveDubbingWork = abortActiveDubbingWorkInProgress;
  global.applySampleUrlFromJobStatus = applyExtractedVocalsUrlFromJobStatus;
  global.watchJob = watchDubbingJobUntilFinished;
  global.watchJobViaPoll = pollDubbingJobUntilComplete;
  global.maybeOfferVoiceSaveFromStatus = maybePromptUserToSaveExtractedVoice;
})(window);
