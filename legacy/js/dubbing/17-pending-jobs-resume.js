// # FILE frontend/sl-dubbing-frontend-main/js/dubbing/17-pending-jobs-resume.js
// # AR واجهة الدبلجة — رفع، Start، polling، أصوات
// # KW مهمة,job
// # CONVENTION — FN/AR/KW + # block كل ~6 أسطر — FUNCTION_INDEX.md DOMAIN_INDEX.md
// dubbing/17-pending-jobs-resume.js — In-flight dub jobs (session-only when ephemeral)
(function (global) {
  const DubbingApp = global.DubbingApp;
  const S = DubbingApp.state;
  const {
    getLocalStorageKeyForPendingDubJobs,
    isEphemeralDubbingEnabled,
    clearPersistedPendingDubJobs,
  } = DubbingApp.api;

  let resumeAttempted = false;
  // Session-only list for Cancel during the same page lifetime (not restored after refresh).
  let sessionPendingJobs = [];

  // # FN loadPendingDubJobsFromStorage
  // # AR رفع الملفات والتخزين (loadPendingDubJobsFromStorage)
  // # KW رفع,upload,R2,storage,مهمة,job,polling,celery,worker
  function loadPendingDubJobsFromStorage() {
    // # guard — رفض/خروج
    if (isEphemeralDubbingEnabled?.()) {
      return sessionPendingJobs.filter((entry) => String(entry?.jobId || '').trim());
    }
    // # try — معالجة عملية قد تفشل
    try {
      // # localStorage — تخزين محلي
      const raw = localStorage.getItem(getLocalStorageKeyForPendingDubJobs());
      // # block — تحديث واجهة/DOM
      const parsed = raw ? JSON.parse(raw) : [];
      // # guard — شرط رفض أو خروج مبكر
      if (!Array.isArray(parsed)) return [];
      return parsed.filter((entry) => String(entry?.jobId || '').trim());
    // # block — تحديث واجهة/DOM
    } catch (_) {
      // # return — إرجاع النتيجة
      return [];
    }
  }

  // # FN savePendingDubJobsToStorage
  // # KW رفع,upload,R2,storage,مهمة,job,polling,celery,worker
  function savePendingDubJobsToStorage(jobs) {
    const list = Array.isArray(jobs) ? jobs : [];
    // # guard — رفض/خروج
    if (isEphemeralDubbingEnabled?.()) {
      sessionPendingJobs = list;
      clearPersistedPendingDubJobs?.();
      return;
    // # block — فرع شرطي
    }
    const key = getLocalStorageKeyForPendingDubJobs();
    // # guard — شرط رفض أو خروج مبكر
    if (!list.length) {
      // # localStorage — تخزين محلي
      localStorage.removeItem(key);
      // # return — إرجاع النتيجة
      return;
    // # block — تحديث واجهة/DOM
    }
    // # localStorage — تخزين محلي
    localStorage.setItem(key, JSON.stringify(list));
  }

  // # FN registerPendingDubJob
  // # AR مهام المعالجة (registerPendingDubJob)
  // # KW مهمة,job,polling,celery,worker
  function registerPendingDubJob(entry) {
    const jobId = String(entry?.jobId || '').trim();
    // # guard — شرط رفض أو خروج مبكر
    if (!jobId) return;
    const jobs = loadPendingDubJobsFromStorage().filter((j) => j.jobId !== jobId);
    jobs.push({
      jobId,
      // # block — معالجة أخطاء
      langCode: String(entry.langCode || '').trim(),
      langName: String(entry.langName || entry.langCode || 'Language').trim(),
      startedAt: entry.startedAt || new Date().toISOString(),
    });
    savePendingDubJobsToStorage(jobs);
  }

  // # FN clearPendingDubJob
  // # KW مهمة,job,polling,celery,worker
  function clearPendingDubJob(jobId) {
    const id = String(jobId || '').trim();
    // # guard — شرط رفض أو خروج مبكر
    if (!id) return;
    savePendingDubJobsToStorage(loadPendingDubJobsFromStorage().filter((j) => j.jobId !== id));
  }

  // # FN cancelAllActiveDubbingJobsPermanently
  // # AR مهام المعالجة (cancelAllActiveDubbingJobsPermanently)
  // # KW مهمة,job,polling,celery,worker
  async function cancelAllActiveDubbingJobsPermanently() {
    const pending = loadPendingDubJobsFromStorage();
    // # guard — رفض/خروج
    if (!pending.length) {
      global.showToast?.('No active dubbing job', 'info');
      return;
    }

    // # block — فرع شرطي
    const confirmMsg =
      pending.length === 1
        ? 'Cancel this dub and permanently delete it everywhere? This cannot be undone.'
        : `Cancel ${pending.length} dub jobs and permanently delete them? This cannot be undone.`;
    // # guard — رفض/خروج
    if (!window.confirm(confirmMsg)) return;

    const cancelBtn = document.getElementById('cancelDubBtn');
    // # شرط
    if (cancelBtn) cancelBtn.disabled = true;

    DubbingApp.jobStatus.abortActiveDubbingWorkInProgress();
    DubbingApp.streamPlayer?.stop?.();

    const headers = DubbingApp.api.getDubbingApiAuthHeaders();
    // # guard — رفض/خروج
    if (!headers) {
      // # guard — رفض/خروج
      if (cancelBtn) cancelBtn.disabled = false;
      // # block — فرع شرطي
      global.showToast?.('Please sign in first', 'error');
      return;
    }

    let cancelledCount = 0;
    for (const entry of pending) {
      const jobId = String(entry?.jobId || '').trim();
      // # شرط
      if (!jobId) continue;
      // # try — عملية قد تفشل
      try {
        // # HTTP — طلب API
        const res = await fetch(DubbingApp.api.buildDubbingJobCancelUrl(jobId), {
          method: 'POST',
          headers: { ...headers, 'Content-Type': 'application/json' },
        });
        // # block — طلب HTTP/API
        const data = await res.json().catch(() => ({}));
        // # شرط
        if (res.ok && data.success !== false) cancelledCount += 1;
      } catch (err) {
        console.warn('[cancel] failed for', jobId, err);
      }
      clearPendingDubJob(jobId);
    // # block — معالجة أخطاء
    }

    savePendingDubJobsToStorage([]);
    S.cinemaResults = {};
    const cinemaLangs = document.getElementById('cinemaLangs');
    // # شرط
    if (cinemaLangs) cinemaLangs.innerHTML = '';
    const resultsCard = document.getElementById('resultsCard');
    // # شرط
    if (resultsCard) resultsCard.style.display = 'none';
    DubbingApp.ui.hideDubbingCancelButton();
    DubbingApp.ui.unlockStartDubbingButton();
    DubbingApp.ui.updateDubbingProgressBarUi('Cancelled', 0);
    const progressArea = document.getElementById('progressArea');
    // # شرط
    if (progressArea) progressArea.style.display = 'none';
    // # block — تحديث واجهة/DOM
    const dubBtn = document.getElementById('dubBtn');
    // # شرط
    if (dubBtn) dubBtn.style.display = 'block';

    global.showToast?.(
      cancelledCount > 0
        ? 'Dub cancelled and permanently deleted'
        : 'Stopped locally — check your connection to the server',
      // # block — تحديث واجهة/DOM
      cancelledCount > 0 ? 'success' : 'warning',
    );
    // # شرط
    if (typeof global.refreshUserCredits === 'function') {
      void global.refreshUserCredits({ retryDelays: [0, 2000, 5000] });
    }
    setTimeout(() => DubbingApp.recentJobs.loadAndRenderRecentDubbingJobs(), 1500);
  }

  // # FN ensureCinemaSideCard
  // # AR مهام المعالجة (ensureCinemaSideCard)
  // # KW مهمة,job,polling,celery,worker
  function ensureCinemaSideCard(entry) {
    const langCode = entry.langCode || entry.jobId;
    const cardId = `side-${langCode}`;
    let item = document.getElementById(cardId);
    // # guard — شرط رفض أو خروج مبكر
    if (item) return item;
    const cinemaList = document.getElementById('cinemaLangs');
    // # guard — شرط رفض أو خروج مبكر
    if (!cinemaList) return null;
    item = document.createElement('div');
    item.className = 'side-lang-card';
    item.id = cardId;
    item.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> ${entry.langName || langCode}`;
    cinemaList.prepend(item);
    // # return — إرجاع النتيجة
    return item;
  }

  // # FN watchOnePendingDubJob
  // # KW مهمة,job,polling,celery,worker
  async function watchOnePendingDubJob(entry, totalCount, completedRef) {
    const langCode = entry.langCode || entry.jobId;
    const item = ensureCinemaSideCard(entry);
    // # try — معالجة عملية قد تفشل
    try {
      const job = await DubbingApp.jobStatus.watchDubbingJobUntilFinished(
        entry.jobId,
        // # block — معالجة أخطاء
        S.workAbortController?.signal || null,
        (jobMeta) => {
          // # شرط
          if (DubbingApp.stemPipeline?.applyDubbingStageToProgressUi) {
            DubbingApp.stemPipeline.applyDubbingStageToProgressUi(jobMeta || {});
          } else {
            const apiPct = Number(jobMeta?.progress);
            // # شرط
            if (Number.isFinite(apiPct) && apiPct > 0) {
              S.progressPercentMonotonic = Math.max(
                S.progressPercentMonotonic,
                Math.min(94, apiPct),
              );
            } else {
              // # block — تنفيذ منطق — راجع الأسطر التالية
              S.progressPercentMonotonic = Math.min(94, S.progressPercentMonotonic + 1);
            }
            // # block — فرع شرطي
            DubbingApp.ui.updateDubbingProgressBarUi(
              'Dubbing in progress...',
              S.progressPercentMonotonic,
            );
          // # block — تنفيذ منطق — راجع الأسطر التالية
          }
        },
      // # block — تنفيذ منطق — راجع الأسطر التالية
      );
      clearPendingDubJob(entry.jobId);
      DubbingApp.jobStatus.applyExtractedVocalsUrlFromJobStatus(job);

      const outputUrl =
        // # block — معالجة صوت/استنساخ
        DubbingApp.jobStatus.extractMediaOutputUrlFromJobPayload(job) ||
        job.dubbed_url ||
        // # block — معالجة صوت/استنساخ
        job.file_url ||
        job.result_url ||
        '';
      // # شرط — فرع منطقي
      if (!outputUrl) {
        // # شرط — فرع منطقي
        if (item) {
          item.innerHTML = `${DubbingApp.voiceHtml.buildLanguageFlagImgHtml(langCode)} ${entry.langName} <i class="fa-solid fa-triangle-exclamation"></i>`;
        // # block — معالجة صوت/استنساخ
        }
        global.showToast?.(`${entry.langName}: completed but no media URL returned`, 'error');
      } else {
        S.cinemaResults[langCode] = {
          // # block — معالجة صوت/استنساخ
          url: outputUrl,
          name: entry.langName,
          // # block — معالجة أخطاء
          flag: langCode,
          created_at: new Date().toISOString(),
        };
        // # شرط — فرع منطقي
        if (item) {
          // # block — معالجة صوت/استنساخ
          item.innerHTML = `${DubbingApp.voiceHtml.buildLanguageFlagImgHtml(langCode)} ${entry.langName} <i class="fa-solid fa-circle-check"></i>`;
          item.onclick = () => DubbingApp.ui.switchCinemaResultsToLanguage(langCode);
          // # block — معالجة صوت/استنساخ
          const cinemaList = document.getElementById('cinemaLangs');
          // # شرط — فرع منطقي
          if (cinemaList && item.parentNode === cinemaList) cinemaList.prepend(item);
        }
        // # شرط — فرع منطقي
        if (Object.keys(S.cinemaResults).length === 1) {
          // # block — تحديث واجهة/DOM
          DubbingApp.ui.switchCinemaResultsToLanguage(langCode);
        }
        // # block — فرع شرطي
        DubbingApp.recentJobs.prependCompletedJobToGrid({
          id: entry.jobId,
          output_url: outputUrl,
          status: 'completed',
          // # block — معالجة أخطاء
          created_at: new Date().toISOString(),
        });
        // # block — معالجة صوت/استنساخ
        const cloneSampleUrl =
          job.sample_url ||
          job.extracted_vocals_url ||
          job.vocals_url ||
          // # block — معالجة صوت/استنساخ
          global.lastExtractedVocalsUrl ||
          S.pendingRecordedSampleUrl ||
          // # block — معالجة صوت/استنساخ
          '';
        const cloneSampleText = job.ref_text || '';
        // # شرط
        if (S.voiceSaveIntentActive && !S.voiceSaveIntentFulfilled) {
          await DubbingApp.voiceSave?.tryFulfillVoiceSaveIntent?.(cloneSampleUrl, cloneSampleText);
        // # block — معالجة صوت/استنساخ
        } else {
          DubbingApp.voiceSave?.offerVoiceSaveAfterCloneSuccess?.(cloneSampleUrl, cloneSampleText);
        // # block — معالجة صوت/استنساخ
        }
      }

      completedRef.count += 1;
      const nextPct = 50 + (completedRef.count / Math.max(totalCount, 1)) * 50;
      // # block — معالجة صوت/استنساخ
      S.progressPercentMonotonic = Math.max(S.progressPercentMonotonic, nextPct);
      // # block — تنفيذ منطق — راجع الأسطر التالية
      DubbingApp.ui.updateDubbingProgressBarUi('Dubbing in progress...', S.progressPercentMonotonic);
      // # شرط — فرع منطقي
          if (completedRef.count >= totalCount) {
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
      clearPendingDubJob(entry.jobId);
      // # guard — رفض/خروج
      if (err?.name === 'AbortError') return;
      // # شرط — فرع منطقي
      if (item) {
        // # block — معالجة أخطاء
        item.textContent = `${entry.langName} Error`;
        // # block — تحديث واجهة/DOM
        const cinemaList = document.getElementById('cinemaLangs');
        // # شرط — فرع منطقي
        if (cinemaList && item.parentNode === cinemaList) cinemaList.prepend(item);
      }
      // # block — تحديث واجهة/DOM
      global.showToast?.(`${entry.langName}: ${err.message}`, 'error');
    }
  }

  // # FN resumePendingDubJobsIfAny
  // # AR resume pending dub jobs if any (resumePendingDubJobsIfAny)
  // # KW مهمة,job,polling,celery,worker
  async function resumePendingDubJobsIfAny(retryCount = 0) {
    // Ephemeral mode: refresh must drop all dubbing — never resume from storage.
    // # guard — رفض/خروج
    if (isEphemeralDubbingEnabled?.()) {
      clearPersistedPendingDubJobs?.();
      sessionPendingJobs = [];
      return;
    }
    // # guard — شرط رفض أو خروج مبكر
    if (resumeAttempted) return;
    const pending = loadPendingDubJobsFromStorage();
    // # guard — شرط رفض أو خروج مبكر
    if (!pending.length) return;

    const headers = DubbingApp.api.getDubbingApiAuthHeaders();
    // # شرط — فرع منطقي
    if (!headers) {
      // # guard — شرط رفض أو خروج مبكر
      if (retryCount < 8) {
        // # block — معالجة أخطاء
        setTimeout(() => resumePendingDubJobsIfAny(retryCount + 1), 1500);
      }
      // # return — إرجاع النتيجة
      return;
    }

    resumeAttempted = true;
    DubbingApp.ui.lockStartDubbingButton();
    // # block — تنفيذ منطق — راجع الأسطر التالية
    S.workAbortController = new AbortController();
    document.getElementById('dubBtn')?.style && (document.getElementById('dubBtn').style.display = 'none');
    document.getElementById('progressArea')?.style && (document.getElementById('progressArea').style.display = 'block');
    document.getElementById('resultsCard')?.style && (document.getElementById('resultsCard').style.display = 'block');
    DubbingApp.ui.showDubbingCancelButton();
    S.progressPercentMonotonic = Math.max(S.progressPercentMonotonic || 5, 5);
    // # block — تحديث واجهة/DOM
    DubbingApp.ui.updateDubbingProgressBarUi('Resuming dubbing in background...', S.progressPercentMonotonic);
    // # block — تحديث واجهة/DOM
    global.showToast?.('Processing continues — your video will appear in History when ready', 'info');

    pending.forEach(ensureCinemaSideCard);
    const completedRef = { count: 0 };
    // # parallel — تنفيذ متوازي
    await Promise.all(
      pending.map((entry) => watchOnePendingDubJob(entry, pending.length, completedRef)),
    // # block — معالجة أخطاء
    );

    S.workAbortController = null;

    // # block — معالجة أخطاء
    DubbingApp.ui.unlockStartDubbingButton();
    DubbingApp.ui.appendDubAnotherVideoButtonToUi();
    // # شرط — فرع منطقي
    if (typeof global.refreshUserCredits === 'function') {
      void global.refreshUserCredits({ retryDelays: [0, 2000, 5000] });
    // # block — نقاط/credits
    }
    setTimeout(() => DubbingApp.recentJobs.loadAndRenderRecentDubbingJobs(), 2000);
  }

  DubbingApp.pendingJobs = {
    loadPendingDubJobsFromStorage,
    registerPendingDubJob,
    clearPendingDubJob,
    cancelAllActiveDubbingJobsPermanently,
    resumePendingDubJobsIfAny,
  };
})(window);
