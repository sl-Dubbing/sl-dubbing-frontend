// # FILE frontend/sl-dubbing-frontend-main/js/dubbing/99-init.js
// # AR وحدة الدبلجة — رفع، بدء مهمة، polling، أصوات
// # CONVENTION — # FN / # AR فوق كل دالة، # قبل كل خطوة — see FUNCTION_INDEX.md
// dubbing/99-init.js — Page bootstrap and global exports
(function (global) {
  const DubbingApp = global.DubbingApp || {};
  const api = DubbingApp.api || {};

  // # FN bootDubbingPageUi
  // # AR Bind buttons / media / voices after DOM ready
  // # KW عام,general
  function bootDubbingPageUi() {
    // # try — لا توقف تهيئة الرفع إن فشل جزء آخر
    try {
      const keyFn = api.getLocalStorageKeyForUserCustomVoice;
      const storageKey = typeof keyFn === 'function' ? keyFn() : null;
      const savedCustomVoice = storageKey ? localStorage.getItem(storageKey) : null;
      // # شرط — فرع منطقي
      if (savedCustomVoice) {
        // # block — معالجة صوت/استنساخ
        global.currentSampleUrl = savedCustomVoice;
        const cloneLabel = document.getElementById('cloneLabel');
        // # شرط — فرع منطقي
        if (cloneLabel) cloneLabel.textContent = 'My Voice';
        const cloneIcon = document.getElementById('cloneIcon');
        // # شرط — فرع منطقي
        if (cloneIcon) {
          cloneIcon.className = 'fa-solid fa-microphone-lines';
          // # block — معالجة صوت/استنساخ
          cloneIcon.style.color = 'var(--accent-blue)';
        }
      }
    } catch (err) {
      console.warn('[dubbing-init] custom voice restore failed', err);
    }

    // # try — قائمة اللغات
    try {
      // # شرط — فرع منطقي
      if (typeof global.buildLanguageDropdown === 'function') {
        global.buildLanguageDropdown(document.getElementById('dubbing-lang-select'), 'ar-eg');
      }
    } catch (err) {
      console.warn('[dubbing-init] lang dropdown failed', err);
    // # block — تحديث واجهة/DOM
    }

    // # try — زر البدء
    try {
      const dubBtn = document.getElementById('dubBtn');
      // # شرط — فرع منطقي
      if (dubBtn) {
        dubBtn.onclick = () => {
          const start =
            // # block — تحديث واجهة/DOM
            DubbingApp.startFlow?.handleStartDubbingButtonClick ||
            DubbingApp.startFlow?.startDubbingJobForAllSelectedLanguages ||
            global.startDubbing;
          // # شرط — فرع منطقي
          if (typeof start === 'function') start();
          else global.showToast?.('Start action unavailable — refresh the page', 'error');
        };
        // # block — فرع شرطي
        DubbingApp.srtEditor?.syncStartDubbingButtonPhaseUi?.();
      }
    } catch (err) {
      console.warn('[dubbing-init] dub button bind failed', err);
    }

    // # try — إلغاء
    try {
      // # block — تحديث واجهة/DOM
      const cancelDubBtn = document.getElementById('cancelDubBtn');
      // # شرط — فرع منطقي
      if (cancelDubBtn) {
        cancelDubBtn.onclick = () =>
          DubbingApp.pendingJobs?.cancelAllActiveDubbingJobsPermanently?.();
      }
    } catch (err) {
      // # block — معالجة أخطاء
      console.warn('[dubbing-init] cancel bind failed', err);
    }

    // # try — أهم جزء: ربط رفع الملف
    try {
      DubbingApp.langAttention?.bindDubbingLangAttentionUi?.();
      DubbingApp.mediaInput?.bindDubbingMediaFileInputChangeHandler?.();
      // # fallback — إن فُقد mediaInput لسبب ما
      if (typeof global.initDubbingMediaInput === 'function') {
        // # block — معالجة أخطاء
        global.initDubbingMediaInput();
      }
    } catch (err) {
      console.error('[dubbing-init] media input bind failed', err);
      global.showToast?.('Upload UI failed to start — refresh the page', 'error');
    }

    // # try — أصوات
    try {
      DubbingApp.voice?.fetchUserVoiceClonesFromApi?.();
      DubbingApp.voice?.fetchSavedVoiceProfileFromApi?.();
    } catch (err) {
      console.warn('[dubbing-init] voice fetch failed', err);
    }

    // # try — مهام معلّقة / أعمال حديثة
    try {
      // # شرط — فرع منطقي
      if (DubbingApp.api?.isEphemeralDubbingEnabled?.()) {
        DubbingApp.api.clearPersistedPendingDubJobs?.();
        const recentSection = document.getElementById('recentJobsSection');
        // # شرط — فرع منطقي
        if (recentSection) {
          recentSection.style.display = 'none';
          // # block — تحديث واجهة/DOM
          recentSection.hidden = true;
          recentSection.setAttribute('aria-hidden', 'true');
        }
      } else {
        const recentSection = document.getElementById('recentJobsSection');
        // # شرط — فرع منطقي
        if (recentSection) {
          // # block — تحديث واجهة/DOM
          recentSection.hidden = false;
          recentSection.removeAttribute('aria-hidden');
          recentSection.style.display = '';
        }
        DubbingApp.pendingJobs?.resumePendingDubJobsIfAny?.();
        setTimeout(() => DubbingApp.recentJobs?.loadAndRenderRecentDubbingJobs?.(), 1000);
      // # block — تحديث واجهة/DOM
      }
    } catch (err) {
      console.warn('[dubbing-init] pending/recent failed', err);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootDubbingPageUi);
  } else {
    bootDubbingPageUi();
  }
})(window);
