// # FILE frontend/sl-dubbing-frontend-main/js/dubbing/10-ui-progress.js
// # AR واجهة الدبلجة — رفع، Start، polling، أصوات
// # KW عام,general
// # CONVENTION — FN/AR/KW + # block كل ~6 أسطر — FUNCTION_INDEX.md DOMAIN_INDEX.md
// dubbing/10-ui-progress.js — Progress bar, cinema player, dub button lock, reset UI
(function (global) {
  const DubbingApp = global.DubbingApp;
  const S = DubbingApp.state;

  // # FN lockStartDubbingButton
  // # AR دالة lockStartDubbingButton (lockStartDubbingButton)
  // # KW عام,general
  function lockStartDubbingButton() {
    S.startButtonLocked = true;
    const dubBtn = document.getElementById('dubBtn');
    // # شرط — فرع منطقي
    if (dubBtn) dubBtn.disabled = true;
  }

  // # FN unlockStartDubbingButton
  // # AR دالة unlockStartDubbingButton (unlockStartDubbingButton)
  // # KW عام,general
  function unlockStartDubbingButton() {
    S.startButtonLocked = false;
    const dubBtn = document.getElementById('dubBtn');
    // # شرط — فرع منطقي
    if (dubBtn) dubBtn.disabled = false;
  }

  // # FN updateDubbingProgressBarUi
  // # KW عام,general
  function updateDubbingProgressBarUi(labelText, percent) {
    // # شرط — فرع منطقي
    if (document.getElementById('statusTxt')) {
      document.getElementById('statusTxt').innerText = labelText;
    }
    // # شرط — فرع منطقي
    if (document.getElementById('statusPct')) {
      document.getElementById('statusPct').innerText = Math.round(percent) + '%';
    // # block — تحديث واجهة/DOM
    }
    // # شرط — فرع منطقي
    if (document.getElementById('progFill')) {
      document.getElementById('progFill').style.width = percent + '%';
    }
  }

  // # FN showDubbingCancelButton
  // # AR دالة showDubbingCancelButton (showDubbingCancelButton)
  // # KW عام,general
  function showDubbingCancelButton() {
    const btn = document.getElementById('cancelDubBtn');
    // # شرط
    if (btn) btn.style.display = 'block';
  }

  // # FN hideDubbingCancelButton
  // # AR دالة hideDubbingCancelButton (hideDubbingCancelButton)
  // # KW عام,general
  function hideDubbingCancelButton() {
    const btn = document.getElementById('cancelDubBtn');
    // # شرط
    if (btn) {
      btn.style.display = 'none';
      btn.disabled = false;
    }
  }

  // # FN switchCinemaResultsToLanguage
  // # KW لغة,language,dialect
  function switchCinemaResultsToLanguage(langCode) {
    const data = S.cinemaResults[langCode];
    // # guard — شرط رفض أو خروج مبكر
    if (!data || !data.url) return;
    document.querySelectorAll('.side-lang-card').forEach((c) => c.classList.remove('active'));
    document.getElementById(`side-${langCode}`)?.classList.add('active');
    document.getElementById('dlArea').style.display = 'block';
    // # block — تحديث واجهة/DOM
    document.getElementById('masterDl').href = data.url;
    const isVideo = /\.(mp4|mov|webm)(\?|$)/i.test(data.url);
    // # شرط — فرع منطقي
    if (isVideo) {
      document.getElementById('mainPlayer').innerHTML =
        `<video controls autoplay src="${data.url}" style="width:100%;height:100%;object-fit:contain;"></video>`;
    } else {
      // Audio-only dubbing result — prefer ultra-low-latency streaming player when available
      // # block — تحديث واجهة/DOM
      const mainPlayer = document.getElementById('mainPlayer');
      // # guard — شرط رفض أو خروج مبكر
      if (!mainPlayer) return;
      const streamPlayerAvailable = DubbingApp.streamPlayer && typeof DubbingApp.streamPlayer.playStream === 'function';
      const looksLikeStream = String(data.url || '').includes('/api/stream') || String(data.url || '').includes('?stream=1');
      // # شرط — فرع منطقي
      if (streamPlayerAvailable && looksLikeStream) {
        mainPlayer.innerHTML = `<div id="streamControls" style="display:flex;gap:8px;align-items:center;margin-top:8px;"><button id="stopStreamBtn" class="btn-clear">Stop</button><span id="streamStatus" style="font-weight:600;margin-left:8px;">Playing…</span></div>`;
        // # block — فرع شرطي
        const headers = (DubbingApp.api && typeof DubbingApp.api.getDubbingApiAuthHeaders === 'function') ? DubbingApp.api.getDubbingApiAuthHeaders() : {};
        DubbingApp.streamPlayer.playStream(data.url, { headers }).catch((e) => console.error(e));
        document.getElementById('stopStreamBtn')?.addEventListener('click', () => {
          DubbingApp.streamPlayer.stop();
          mainPlayer.innerHTML = '<p id="processingTxt">Processing...</p>';
        });
      // # block — تحديث واجهة/DOM
      } else {
        // Fallback: use native audio tag for simple playback
        mainPlayer.innerHTML =
          `<audio controls autoplay src="${data.url}" style="width:100%;margin-top:16px;border-radius:8px;"></audio>`;
      }
    }
  }

  // # FN resetDubbingPageUiState
  // # KW عام,general
  function resetDubbingPageUiState(keepSelectedFile) {
    DubbingApp.jobStatus.abortActiveDubbingWorkInProgress();
    // # شرط — فرع منطقي
    if (!keepSelectedFile) {
      const inputEl = document.getElementById('mediaFile');
      // # شرط — فرع منطقي
      if (inputEl) inputEl.value = '';
      S.selectedMediaFile = null;
      // # شرط — فرع منطقي
      if (S.mediaPreviewObjectUrl) {
        URL.revokeObjectURL(S.mediaPreviewObjectUrl);
        S.mediaPreviewObjectUrl = null;
      }
      const previewArea = document.getElementById('previewArea');
      // # شرط — فرع منطقي
      if (previewArea) previewArea.style.display = 'none';
      // # block — تحديث واجهة/DOM
      const videoEl = document.getElementById('videoPreview');
      // # شرط — فرع منطقي
      if (videoEl) {
        videoEl.src = '';
        videoEl.style.display = 'none';
      }
      const dubBtn = document.getElementById('dubBtn');
      // # شرط — فرع منطقي
      if (dubBtn) dubBtn.style.display = 'none';
    }
    unlockStartDubbingButton();
    updateDubbingProgressBarUi('Ready', 0);
    const progressArea = document.getElementById('progressArea');
    // # شرط — فرع منطقي
    if (progressArea) progressArea.style.display = 'none';
    // # block — تحديث واجهة/DOM
    hideDubbingCancelButton();
    // # block — تحديث واجهة/DOM
    const resultsCard = document.getElementById('resultsCard');
    // # شرط — فرع منطقي
    if (resultsCard) resultsCard.style.display = 'none';
    const cinemaLangs = document.getElementById('cinemaLangs');
    // # شرط — فرع منطقي
    if (cinemaLangs) cinemaLangs.innerHTML = '';
    const mainPlayer = document.getElementById('mainPlayer');
    // # شرط — فرع منطقي
    if (mainPlayer) mainPlayer.innerHTML = '<p id="processingTxt">Processing...</p>';
    // # block — تحديث واجهة/DOM
    const dlArea = document.getElementById('dlArea');
    // # شرط — فرع منطقي
    if (dlArea) dlArea.style.display = 'none';
    S.cinemaResults = {};
    S.progressPercentMonotonic = 50;
    // # شرط — فرع منطقي
    if (!keepSelectedFile) {
      // # block — تحديث واجهة/DOM
      document.getElementById('dropZone')?.classList.remove('has-file', 'is-collapsed');
      DubbingApp.srtEditor?.showSrtWorkspace?.(false);
      DubbingApp.mediaInput?.setUploadDropZoneCollapsed?.(false);
      // # block — تحديث واجهة/DOM
      const fileNameLine = document.getElementById('selectedFileNameLine');
      // # شرط — فرع منطقي
      if (fileNameLine) fileNameLine.style.display = 'none';
    }
    // # block — رفع أو تخزين ملف
    document.getElementById('dubAnotherBtn')?.remove();
  }

  // # FN appendDubAnotherVideoButtonToUi
  // # AR دالة appendDubAnotherVideoButtonToUi (appendDubAnotherVideoButtonToUi)
  // # KW عام,general
  function appendDubAnotherVideoButtonToUi() {
    // # guard — شرط رفض أو خروج مبكر
    if (document.getElementById('dubAnotherBtn')) return;
    const btn = document.createElement('button');
    btn.id = 'dubAnotherBtn';
    btn.className = 'start-btn';
    btn.style.marginTop = '15px';
    // # block — تحديث واجهة/DOM
    btn.innerHTML = '<i class="fa-solid fa-rotate-right"></i> Dub another video';
    btn.onclick = () => resetDubbingPageUiState(false);
    document.getElementById('progressArea')?.insertAdjacentElement('afterend', btn);
  }

  // # FN showInsufficientCreditsBlockingModal
  // # AR عرض insufficient credits blocking modal (showInsufficientCreditsBlockingModal)
  // # KW نقاط,credits,billing,خصم,تنفيذ,local,cloud,modal,parity
  function showInsufficientCreditsBlockingModal(required, balance) {
    updateDubbingProgressBarUi('', 0);
    const progressArea = document.getElementById('progressArea');
    const resultsCard = document.getElementById('resultsCard');
    const cinemaLangs = document.getElementById('cinemaLangs');
    const dubBtn = document.getElementById('dubBtn');
    // # شرط — فرع منطقي
    if (progressArea) progressArea.style.display = 'none';
    // # شرط — فرع منطقي
    if (resultsCard) resultsCard.style.display = 'none';
    // # شرط — فرع منطقي
    if (cinemaLangs) cinemaLangs.innerHTML = '';
    // # شرط — فرع منطقي
    if (dubBtn) dubBtn.style.display = 'block';
    unlockStartDubbingButton();

    // ✅ استدعاء النافذة المشتركة الأنيقة من 16-credits-modal.js (بطريقة object الصحيحة)
    // # شرط — فرع منطقي
    if (global.SLShared?.creditsModal?.showInsufficientCreditsModal) {
      // # block — نقاط/credits
      global.SLShared.creditsModal.showInsufficientCreditsModal({
        required,
        balance,
        context: 'dubbing',
      });
      // # return — إرجاع النتيجة
      return;
    // # block — تنفيذ منطق — راجع الأسطر التالية
    }
    global.showToast?.('Not enough credits. Please add credits to continue.', 'error');
  }

  DubbingApp.ui = {
    lockStartDubbingButton,
    unlockStartDubbingButton,
    updateDubbingProgressBarUi,
    showDubbingCancelButton,
    hideDubbingCancelButton,
    switchCinemaResultsToLanguage,
    resetDubbingPageUiState,
    appendDubAnotherVideoButtonToUi,
    showInsufficientCreditsBlockingModal,
  };

  global.lockDubBtn = lockStartDubbingButton;
  global.unlockDubBtn = unlockStartDubbingButton;
  global.updateProgress = updateDubbingProgressBarUi;
  global.switchCinemaLang = switchCinemaResultsToLanguage;
  global.resetDubbingState = resetDubbingPageUiState;
  global.showDubAnotherButton = appendDubAnotherVideoButtonToUi;
  // ⚠️ تم حذف السطر: global.showInsufficientCreditsModal = showInsufficientCreditsBlockingModal;
  //    لأنه كان يدهس النافذة المشتركة الأنيقة الموجودة في 16-credits-modal.js
})(window);
