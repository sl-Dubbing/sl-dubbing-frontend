// # FILE frontend/sl-dubbing-frontend-main/js/dubbing/12-start-dubbing.js
// # AR واجهة الدبلجة — رفع، Start، polling، أصوات
// # KW عام,general
// # CONVENTION — FN/AR/KW + # block كل ~6 أسطر — FUNCTION_INDEX.md DOMAIN_INDEX.md
// dubbing/12-start-dubbing.js — Main dubbing start flow (upload + queue + watch)
(function (global) {
  const DubbingApp = global.DubbingApp;
  const S = DubbingApp.state;
  const { normalizeApiBaseUrl, getDubbingApiAuthHeaders } = DubbingApp.api;
  const { fetchHttpWithRateLimitRetry } = DubbingApp.fetch;

  // # FN startDubbingJobForAllSelectedLanguages
  // # KW مهمة,job,polling,celery,worker,لغة,language,dialect
  async function startDubbingJobForAllSelectedLanguages() {
    // # guard — شرط رفض أو خروج مبكر
    if (S.startButtonLocked) return;
    DubbingApp.ui.lockStartDubbingButton();

    const inputEl = document.getElementById('mediaFile');
    const file = S.selectedMediaFile || (inputEl?.files?.[0]);
    let authHeaders =
      // # block — تحديث واجهة/DOM
      typeof global.refreshApiAuthHeadersFromSupabase === 'function'
        ? await global.refreshApiAuthHeadersFromSupabase()
        : getDubbingApiAuthHeaders();
    // # شرط — فرع منطقي
    if (!authHeaders) authHeaders = getDubbingApiAuthHeaders();
    // # localStorage — تخزين محلي
    const token = localStorage.getItem('token');

    // # guard — شرط رفض أو خروج مبكر
    if (!authHeaders || !token) {
      // # block — تحديث واجهة/DOM
      DubbingApp.ui.unlockStartDubbingButton();
      // # return — إرجاع النتيجة
      return global.showToast?.('Please sign in first', 'error');
    }
    // # guard — شرط رفض أو خروج مبكر
    if (!file) {
      DubbingApp.ui.unlockStartDubbingButton();
      return global.showToast?.('Please select a media file', 'error');
    // # block — فرع شرطي
    }
    // # guard — شرط رفض أو خروج مبكر
    if (file.size > DubbingApp.upload.computeMaxDubbingUploadBytes()) {
      DubbingApp.ui.unlockStartDubbingButton();
      // # return — إرجاع النتيجة
      return global.showToast?.('File too large', 'error');
    }
    // # guard — شرط رفض أو خروج مبكر
    if (!global.selectedLangs?.size) {
      // # block — رفع أو تخزين ملف
      DubbingApp.ui.unlockStartDubbingButton();
      return global.showToast?.('Select target languages', 'error');
    }

    const sourceLang =
      typeof global.getSelectedSourceLanguage === 'function'
        ? global.getSelectedSourceLanguage()
        // # block — إرجاع نتيجة
        : '';
    const sourceDialect =
      typeof global.getSelectedSourceDialect === 'function'
        ? global.getSelectedSourceDialect()
        : '';
    // # guard — شرط رفض أو خروج مبكر
    if (!sourceLang) {
      // # block — تحديث واجهة/DOM
      document.getElementById('srcLangTrigger')?.classList.add('invalid', 'active');
      DubbingApp.ui.unlockStartDubbingButton();
      return global.showToast?.('Select original video language', 'error');
    }
    document.getElementById('srcLangTrigger')?.classList.remove('invalid');

    DubbingApp.jobStatus.abortActiveDubbingWorkInProgress();
    // # block — تحديث واجهة/DOM
    document.getElementById('dubAnotherBtn')?.remove();
    S.workAbortController = new AbortController();
    const workSignal = S.workAbortController.signal;

    document.getElementById('dubBtn').style.display = 'none';
    document.getElementById('progressArea').style.display = 'block';
    document.getElementById('resultsCard').style.display = 'block';
    // # block — تحديث واجهة/DOM
    DubbingApp.ui.showDubbingCancelButton();
    // # block — تحديث واجهة/DOM
    document.getElementById('cinemaLangs').innerHTML = '';
    S.cinemaResults = {};
    S.progressPercentMonotonic = 5;

    // Voice-clone credit toast removed (UI cleanup)

    // # try — معالجة عملية قد تفشل
    try {
      DubbingApp.ui.updateDubbingProgressBarUi('Initializing...', 5);

      // # شرط
      if (DubbingApp.hyperLive?.isHyperLiveModeEnabled?.()) {
        await DubbingApp.hyperLive.runHyperLiveBrowserPreflight(file, (label, pct) => {
          DubbingApp.ui.updateDubbingProgressBarUi(label, pct);
        });
      } else if (DubbingApp.browserCpu?.isCpuSiteModeEnabled?.()) {
        // # try — عملية قد تفشل
        try {
          // # block — معالجة أخطاء
          await DubbingApp.browserCpu.prepareMediaForCpuDub(file, (label, pct) => {
            DubbingApp.ui.updateDubbingProgressBarUi(label, pct);
          });
        } catch (prepErr) {
          console.warn('[cpu-site] browser prep failed, uploading original:', prepErr);
        }
      // # block — رفع أو تخزين ملف
      }

      // # HTTP — طلب إلى API
      const urlRes = await fetch(`${normalizeApiBaseUrl()}/api/upload-url`, {
        // # block — طلب HTTP/API
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        // # تسلسل JSON للطلب
        body: JSON.stringify({
          filename: file.name,
          // # block — طلب HTTP/API
          content_type: file.type || 'application/octet-stream',
        // # block — parse/serialize JSON
        }),
      // # block — parse/serialize JSON
      });
      // # guard — شرط رفض أو خروج مبكر
      if (!urlRes.ok) {
        // # parse — قراءة JSON من الاستجابة
        const errData = await urlRes.json().catch(() => ({}));
        // # raise — رفع خطأ للم caller
        throw new Error(errData.error || `upload-url failed: HTTP ${urlRes.status}`);
      // # block — رفع أو تخزين ملف
      }
      // # parse — قراءة JSON من الاستجابة
      const urlData = await urlRes.json();
      // # block — رفع أو تخزين ملف
      await DubbingApp.upload.uploadMediaFileFromUploadUrlResponse(
        urlData,
        file,
        authHeaders,
      // # block — رفع أو تخزين ملف
      );
      // # block — رفع أو تخزين ملف
      S.progressPercentMonotonic = 50;
      // # HTTP — طلب outbound
      DubbingApp.ui.updateDubbingProgressBarUi('Sending processing requests...', 50);

      const fileKey = urlData.file_key;
      S.srtPreviewFileKey = fileKey;
      const langArray = Array.from(global.selectedLangs);
      // # block — طلب HTTP/API
      const dubEndpoint = `${normalizeApiBaseUrl()}/api/dub`;
      const dubHeaders = { ...authHeaders, 'Content-Type': 'application/json' };
      // # block — طلب HTTP/API
      const videoOutput = typeof file.type === 'string' && file.type.startsWith('video/');
      // # block — رفع أو تخزين ملف
      const cinemaList = document.getElementById('cinemaLangs');
      
      const voicePayload = DubbingApp.voicePayload.buildVoiceConfigPayloadForDubApiRequest();
      const hyperPayload = DubbingApp.hyperLive?.buildHyperLiveStartPayload?.() || {};
      // # block — معالجة صوت/استنساخ
      const mergedVoice = DubbingApp.hyperLive?.mergeHyperLiveIntoVoiceConfig?.(voicePayload) || voicePayload;
      const sampleUrl = (mergedVoice.sample_url || '').trim();
      const sampleText = (mergedVoice.sample_text || '').trim();
      const scriptSegments =
        typeof DubbingApp.srtEditor?.getScriptSegmentsForDub === 'function'
          ? DubbingApp.srtEditor.getScriptSegmentsForDub()
          // # block — معالجة صوت/استنساخ
          : typeof global.getDubbingScriptSegments === 'function'
            ? global.getDubbingScriptSegments()
            : [];
      const hasScript = Array.isArray(scriptSegments) && scriptSegments.length > 0;
      // # شرط
      if (hasScript) {
        // Silent — no Modal/ElevenLabs pipeline toast
      }

      // # FN dubOneTargetLanguage
      // # AR dub one target language (dubOneTargetLanguage)
      // # KW لغة,language,dialect
      const dubOneTargetLanguage = async (langCode) => {
        // # block — معالجة صوت/استنساخ
        const langInfo = global.LANGUAGES?.find((l) => l.code === langCode);
        const langFields =
          typeof global.resolveDubbingRequestLangFields === 'function'
            ? global.resolveDubbingRequestLangFields(sourceLang, langCode)
            : {
                // # block — تنفيذ منطق — راجع الأسطر التالية
                source_language: sourceLang,
                // # block — تنفيذ منطق — راجع الأسطر التالية
                source_dialect: sourceDialect,
                dialect: langInfo?.dialect || (langInfo?.base_lang === 'ar' ? 'الفصحى' : ''),
                target_language: langInfo?.base_lang || langCode.split('-')[0],
                translate: sourceLang !== langCode,
              };
        // # block — خطوة ترجمة (مترجم)
        const item = document.createElement('div');
        // # block — خطوة ترجمة (مترجم)
        item.className = 'side-lang-card';
        item.id = `side-${langCode}`;
        item.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> ${langInfo?.name_en || langCode}`;
        cinemaList?.prepend(item);

        let jobId = '';
        // # try — معالجة عملية قد تفشل
        try {
          // # block — معالجة أخطاء
          const forcedEngine = (global.forceEngine || '').trim();
          const requestBody = {
            file_key: fileKey,
            lang: langCode,
            target_language: langFields.target_language,
            // # block — رفع أو تخزين ملف
            dialect: langFields.dialect,
            source_language: langFields.source_language,
            source_dialect: langFields.source_dialect,
            // Pre-translated literal SRT → Modal skips GPT translate
            translate: langFields.translate,
            voice_config: mergedVoice,
            sample_url: sampleUrl,
            // # block — خطوة ترجمة (مترجم)
            sample_text: sampleText,
            voice_mode: mergedVoice.voice_mode || global.voiceMode || '',
            clone_source: mergedVoice.clone_source || '',
            speaker_mode: (mergedVoice.speaker_mode || global.speakerMode || 'auto'),
            enable_lipsync: !!(mergedVoice.enable_lipsync || global.enableLipsync),
            use_saved_voice: !!(mergedVoice.use_saved_voice || global.usingSavedVoice),
            // # block — معالجة صوت/استنساخ
            quality: mergedVoice.quality || global.dubbingQuality || 'studio',
            video_output: videoOutput,
            // # block — معالجة صوت/استنساخ
            ...hyperPayload,
          };
          if (mergedVoice.elevenlabs_voice_id) {
            requestBody.elevenlabs_voice_id = mergedVoice.elevenlabs_voice_id;
          }
          // # شرط
          if (hasScript) {
            let readySegs = scriptSegments;
            // # شرط
            if (typeof DubbingApp.srtEditor?.getSegmentsReadyForDub === 'function') {
              readySegs = await DubbingApp.srtEditor.getSegmentsReadyForDub(langCode);
            }
            // Prefer live editor edits when already showing this language
            // # شرط
            if (
              DubbingApp.state?.preTranslatedLang === langCode &&
              typeof DubbingApp.srtEditor?.getScriptSegmentsForDub === 'function'
            // # block — خطوة ترجمة (مترجم)
            ) {
              const live = DubbingApp.srtEditor.getScriptSegmentsForDub();
              // # شرط
              if (live?.length) readySegs = live;
            }
            requestBody.segments = readySegs;
            requestBody.script_segments = readySegs;
            // Already literal-translated (or same language) — do not re-translate on Modal
            // # block — خطوة ترجمة (مترجم)
            requestBody.translate = false;
          }
          // # شرط — فرع منطقي
          if (forcedEngine) {
            requestBody.force_engine = forcedEngine;
            requestBody.engine = forcedEngine;
          }
          // # block — معالجة أخطاء
          const dubRes = await fetchHttpWithRateLimitRetry(
            // # block — معالجة أخطاء
            dubEndpoint,
            // # تسلسل JSON للطلب
            { method: 'POST', headers: dubHeaders, signal: workSignal, body: JSON.stringify(requestBody) },
          );
          // # parse — قراءة JSON من الاستجابة
          const dubData = await dubRes.json().catch(() => ({}));
          // # شرط — فرع منطقي
          if (dubRes.status === 402 || dubData.error === 'INSUFFICIENT_CREDITS') {
            // # block — نقاط/credits
            DubbingApp.ui.showInsufficientCreditsBlockingModal(
              // # block — نقاط/credits
              dubData.required ?? '?',
              // # block — نقاط/credits
              dubData.balance ?? '?',
            );
            DubbingApp.jobStatus.abortActiveDubbingWorkInProgress();
            // # return — إرجاع النتيجة
            return;
          // # block — تنفيذ منطق — راجع الأسطر التالية
          }
          // # شرط — فرع منطقي
          if (!dubRes.ok) {
            // # شرط — فرع منطقي
            if (typeof global.logApiRequestFailure === 'function') {
              global.logApiRequestFailure('POST /api/dub', dubEndpoint, dubRes, dubData);
            }
            const msg =
              // # block — فرع شرطي
              typeof global.humanizeApiErrorMessage === 'function'
                // # block — فرع شرطي
                ? global.humanizeApiErrorMessage(dubRes, dubData, 'Dubbing failed')
                // # block — تنفيذ منطق — راجع الأسطر التالية
                : dubData.error || 'dub failed';
            // # raise — رفع خطأ للم caller
            throw new Error(msg);
          }

          jobId = DubbingApp.jobStatus.extractDubbingJobIdFromStartResponse(dubData);
          // # guard — شرط رفض أو خروج مبكر
          if (!jobId) throw new Error('Server did not return a job id');
          // # block — معالجة أخطاء
          DubbingApp.pendingJobs?.registerPendingDubJob?.({
            // # block — معالجة أخطاء
            jobId,
            langCode,
            langName: langInfo?.name_en || langCode,
            startedAt: new Date().toISOString(),
          // # block — تنفيذ منطق — راجع الأسطر التالية
          });
          // # block — تنفيذ منطق — راجع الأسطر التالية
          const job = await DubbingApp.jobStatus.watchDubbingJobUntilFinished(
            // # block — تنفيذ منطق — راجع الأسطر التالية
            jobId,
            workSignal,
            (jobMeta) => {
              // # شرط
              if (DubbingApp.stemPipeline?.applyDubbingStageToProgressUi) {
                // # block — فرع شرطي
                DubbingApp.stemPipeline.applyDubbingStageToProgressUi(jobMeta || {});
              } else {
                const apiPct = Number(jobMeta?.progress);
                // # شرط
                if (Number.isFinite(apiPct) && apiPct > 0) {
                  S.progressPercentMonotonic = Math.max(
                    S.progressPercentMonotonic,
                    // # block — فرع شرطي
                    Math.min(94, apiPct),
                  );
                } else {
                  S.progressPercentMonotonic = Math.min(94, S.progressPercentMonotonic + 1);
                }
                DubbingApp.ui.updateDubbingProgressBarUi(
                  // # block — تنفيذ منطق — راجع الأسطر التالية
                  'Dubbing in progress...',
                  S.progressPercentMonotonic,
                // # block — تنفيذ منطق — راجع الأسطر التالية
                );
              }
            },
          );

          // Guard: if backend returns URL under a non-standard field name, extractMediaOutputUrlFromJobPayload
          // returns '' and switchCinemaResultsToLanguage silently bails — surface the failure explicitly.
          // # block — تنفيذ منطق — راجع الأسطر التالية
          const outputUrl = DubbingApp.jobStatus.extractMediaOutputUrlFromJobPayload(job)
            // # block — تنفيذ منطق — راجع الأسطر التالية
            || job.dubbed_url || job.file_url || job.result_url || '';
          // # block — معالجة صوت/استنساخ
          DubbingApp.jobStatus.applyExtractedVocalsUrlFromJobStatus(job);
          DubbingApp.pendingJobs?.clearPendingDubJob?.(jobId);

          // # شرط — فرع منطقي
          if (!outputUrl) {
            item.innerHTML = `${DubbingApp.voiceHtml.buildLanguageFlagImgHtml(langCode)} ${langInfo?.name_en} <i class="fa-solid fa-triangle-exclamation"></i>`;
            // # block — معالجة صوت/استنساخ
            global.showToast?.(`${langInfo?.name_en || langCode}: completed but no media URL returned`, 'error');
          // # block — معالجة صوت/استنساخ
          } else {
            // # block — معالجة صوت/استنساخ
            S.cinemaResults[langCode] = {
              url: outputUrl,
              name: langInfo?.name_en || langCode,
              flag: langCode,
              // # block — تنفيذ منطق — راجع الأسطر التالية
              created_at: new Date().toISOString(),
            // # block — تنفيذ منطق — راجع الأسطر التالية
            };
            // # block — معالجة صوت/استنساخ
            item.innerHTML = `${DubbingApp.voiceHtml.buildLanguageFlagImgHtml(langCode)} ${langInfo?.name_en} <i class="fa-solid fa-circle-check"></i>`;
            item.onclick = () => DubbingApp.ui.switchCinemaResultsToLanguage(langCode);
            // # شرط — فرع منطقي
            if (Object.keys(S.cinemaResults).length === 1) {
              DubbingApp.ui.switchCinemaResultsToLanguage(langCode);
            // # block — معالجة صوت/استنساخ
            }
            // # شرط — فرع منطقي
            if (cinemaList && item.parentNode === cinemaList) cinemaList.prepend(item);
            // # block — معالجة صوت/استنساخ
            const cloneSampleUrl =
              job.sample_url ||
              job.extracted_vocals_url ||
              job.vocals_url ||
              // # block — معالجة صوت/استنساخ
              global.lastExtractedVocalsUrl ||
              // # block — معالجة صوت/استنساخ
              S.pendingRecordedSampleUrl ||
              // # block — معالجة صوت/استنساخ
              sampleUrl ||
              '';
            const cloneSampleText = job.ref_text || sampleText;
            // # شرط
            if (S.voiceSaveIntentActive && !S.voiceSaveIntentFulfilled) {
              // # block — معالجة صوت/استنساخ
              await DubbingApp.voiceSave?.tryFulfillVoiceSaveIntent?.(cloneSampleUrl, cloneSampleText);
            // # block — معالجة صوت/استنساخ
            } else {
              // # block — معالجة صوت/استنساخ
              DubbingApp.voiceSave?.offerVoiceSaveAfterCloneSuccess?.(cloneSampleUrl, cloneSampleText);
            }
            DubbingApp.recentJobs.prependCompletedJobToGrid({
              // # block — معالجة صوت/استنساخ
              output_url: outputUrl,
              // # block — معالجة صوت/استنساخ
              status: 'completed',
              // # block — معالجة صوت/استنساخ
              created_at: new Date().toISOString(),
            // # block — تنفيذ منطق — راجع الأسطر التالية
            });
          }

          const nextPct =
            // # block — تنفيذ منطق — راجع الأسطر التالية
            50 + (Object.keys(S.cinemaResults).length / langArray.length) * 50;
          // # block — تنفيذ منطق — راجع الأسطر التالية
          S.progressPercentMonotonic = Math.max(S.progressPercentMonotonic, nextPct);
          // # block — تنفيذ منطق — راجع الأسطر التالية
          DubbingApp.ui.updateDubbingProgressBarUi('Dubbing in progress...', S.progressPercentMonotonic);

          // # شرط — فرع منطقي
          if (Object.keys(S.cinemaResults).length === langArray.length) {
            DubbingApp.ui.updateDubbingProgressBarUi('All Done!', 100);
            DubbingApp.ui.hideDubbingCancelButton();
            setTimeout(() => {
              // # block — تحديث واجهة/DOM
              const progressArea = document.getElementById('progressArea');
              // # شرط — فرع منطقي
              if (progressArea) progressArea.style.display = 'none';
            // # block — تحديث واجهة/DOM
            }, 800);
          // # block — تحديث واجهة/DOM
          }
        } catch (err) {
          // # guard — شرط رفض أو خروج مبكر
          if (err?.name === 'AbortError') return;
          // # شرط — فرع منطقي
          if (jobId) DubbingApp.pendingJobs?.clearPendingDubJob?.(jobId);
          // # block — معالجة أخطاء
          item.textContent = `${langInfo?.name_en || langCode} Error`;
          // # block — معالجة أخطاء
          global.showToast?.(`Language ${langCode}: ${err.message}`, 'error');
          // # شرط — فرع منطقي
          if (cinemaList && item.parentNode === cinemaList) cinemaList.prepend(item);
        }
      };

      // # parallel — تنفيذ متوازي
      await Promise.all(
        // # block — فرع شرطي
        langArray.map((langCode, index) =>
          // # block — فرع شرطي
          new Promise(async (resolve) => {
            // # شرط — فرع منطقي
            if (index > 0) await new Promise((r) => setTimeout(r, 50 * index));
            await dubOneTargetLanguage(langCode);
            resolve();
          // # block — فرع شرطي
          }),
        // # block — فرع شرطي
        ),
      // # block — فرع شرطي
      );

      // # block — معالجة صوت/استنساخ
      DubbingApp.voiceSave?.notifyVoiceSaveIntentSkippedAfterFailedClone?.();

      // # شرط — فرع منطقي
      if (typeof global.refreshUserCredits === 'function') {
        void global.refreshUserCredits({ retryDelays: [0, 2000, 5000] });
      // # block — معالجة صوت/استنساخ
      }

      // # block — معالجة صوت/استنساخ
      DubbingApp.ui.unlockStartDubbingButton();
      DubbingApp.ui.appendDubAnotherVideoButtonToUi();
      // Reload from API after a delay to sync server-side history (optimistic prepend already done per-language above)
      // # block — نقاط/credits
      setTimeout(() => DubbingApp.recentJobs.loadAndRenderRecentDubbingJobs(), 4000);
    } catch (e) {
      // # guard — شرط رفض أو خروج مبكر
      if (e?.name === 'AbortError') return;
      // # block — معالجة أخطاء
      global.showToast?.(e.message, 'error');
      // # block — معالجة أخطاء
      DubbingApp.ui.unlockStartDubbingButton();
      document.getElementById('dubBtn').style.display = 'block';
      DubbingApp.srtEditor?.syncStartDubbingButtonPhaseUi?.();
      // # block — تحديث واجهة/DOM
      DubbingApp.ui.updateDubbingProgressBarUi('Process Interrupted', 0);
    }
  }

  // # FN handleStartDubbingButtonClick
  // # AR Step1 extract SRT if empty; Step2 start real dub after user review
  // # KW تفريغ,asr,srt,مهمة,job
  async function handleStartDubbingButtonClick() {
    // # guard — شرط رفض أو خروج مبكر
    if (S.startButtonLocked) return;

    const segs =
      typeof DubbingApp.srtEditor?.getScriptSegmentsForDub === 'function'
        ? DubbingApp.srtEditor.getScriptSegmentsForDub()
        : [];
    // # شرط — لا سكربت بعد → استخراج أولاً
    if (!Array.isArray(segs) || segs.length === 0) {
      // # guard — ملف مطلوب قبل الاستخراج
      const inputEl = document.getElementById('mediaFile');
      const file = S.selectedMediaFile || inputEl?.files?.[0];
      // # guard — رفض/خروج
      if (!file) {
        global.showToast?.('Please select a media file', 'error');
        // # return — إرجاع النتيجة
        return;
      // # block — تحديث واجهة/DOM
      }
      const extract =
        DubbingApp.srtEditor?.extractScriptFromMedia || global.extractScriptFromMedia;
      // # guard — شرط رفض أو خروج مبكر
      if (typeof extract !== 'function') {
        global.showToast?.('Script extractor unavailable', 'error');
        // # return — إرجاع النتيجة
        return;
      // # block — فرع شرطي
      }
      await extract();
      // # return — إرجاع النتيجة (المستخدم يراجع ثم يضغط مجدداً)
      return;
    }

    // # block — المرحلة الثانية: الدبلجة الحقيقية
    await startDubbingJobForAllSelectedLanguages();
  }

  DubbingApp.startFlow = {
    startDubbingJobForAllSelectedLanguages,
    handleStartDubbingButtonClick,
  };
  global.startDubbing = handleStartDubbingButtonClick;
})(window);
