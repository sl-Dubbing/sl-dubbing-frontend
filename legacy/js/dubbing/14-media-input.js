// # FILE frontend/sl-dubbing-frontend-main/js/dubbing/14-media-input.js
// # AR اختيار ملف الوسائط والمعاينة + إخفاء drag-drop بعد الاختيار
// # KW رفع,upload,فيديو
(function (global) {
  const DubbingApp = global.DubbingApp;
  const S = DubbingApp.state;

  // # FN getDubbingMediaFileInputElement
  // # KW عام,general
  function getDubbingMediaFileInputElement() {
    return document.getElementById('mediaFile');
  }

  const MIN_DURATION_SEC = 5;
  const MAX_DURATION_SEC = 5400; // 1.5 hours
  const DURATION_CHECK_TIMEOUT_MS = 8000;

  // # FN isVideoMediaFile
  // # AR Detect video by MIME or extension (empty MIME on some OS)
  // # KW عام,general
  function isVideoMediaFile(file) {
    // # guard — شرط رفض أو خروج مبكر
    if (!file) return false;
    const mime = String(file.type || '').toLowerCase();
    // # شرط — فرع منطقي
    if (mime.startsWith('video/')) return true;
    // # شرط — فرع منطقي
    if (mime.startsWith('audio/')) return false;
    const name = String(file.name || '').toLowerCase();
    // # return — إرجاع النتيجة
    return /\.(mp4|mov|mkv|webm|m4v|avi)$/i.test(name);
  }

  // # FN setUploadDropZoneCollapsed
  // # AR إخفاء/إظهار مربع السحب بعد اختيار المقطع
  // # KW رفع,upload,R2,storage
  function setUploadDropZoneCollapsed(collapsed) {
    const dropZone = document.getElementById('dropZone');
    // # guard — شرط رفض أو خروج مبكر
    if (!dropZone) return;
    dropZone.classList.toggle('is-collapsed', !!collapsed);
    // # شرط — فرع منطقي
    if (collapsed) dropZone.classList.add('has-file');
    else dropZone.classList.remove('has-file');
  }

  // # FN openMediaFilePicker
  // # AR فتح منتقي الملف لاستبدال المقطع
  // # KW عام,general
  function openMediaFilePicker() {
    const input = getDubbingMediaFileInputElement();
    // # guard — شرط رفض أو خروج مبكر
    if (!input) return;
    input.value = '';
    input.click();
  }

  // # FN checkMediaDurationAsync
  // # AR Read duration with timeout so UI never hangs waiting for metadata
  // # KW عام,general
  function checkMediaDurationAsync(objectUrl, isVideo) {
    // # return — إرجاع النتيجة
    return new Promise((resolve) => {
      let settled = false;
      const el = isVideo ? document.createElement('video') : document.createElement('audio');
      el.preload = 'metadata';

      // # FN finish
      // # KW عام,general
      function finish(durationSec) {
        // # guard — شرط رفض أو خروج مبكر
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        // # try — عملية قد تفشل
        try {
          el.removeAttribute('src');
          // # block — معالجة أخطاء
          el.load();
        // # block — معالجة أخطاء
        } catch (_) {}
        // # return — إرجاع النتيجة
        resolve(Number(durationSec) || 0);
      }

      const timer = setTimeout(() => finish(0), DURATION_CHECK_TIMEOUT_MS);
      el.onloadedmetadata = () => finish(el.duration);
      el.onerror = () => finish(0);
      // # block — تنفيذ منطق — راجع الأسطر التالية
      el.src = objectUrl;
    });
  }

  // # FN resetMediaSelectionUi
  // # KW عام,general
  function resetMediaSelectionUi() {
    S.selectedMediaFile = null;
    S.selectedMediaDurationSec = 0;
    S.srtPreviewFileKey = '';
    DubbingApp.srtEditor?.clearSrtEditor?.();
    DubbingApp.srtEditor?.showSrtWorkspace?.(false);
    // # block — رفع أو تخزين ملف
    setUploadDropZoneCollapsed(false);
    const previewArea = document.getElementById('previewArea');
    const dubBtn = document.getElementById('dubBtn');
    const fileNameLine = document.getElementById('selectedFileNameLine');
    // # شرط — فرع منطقي
    if (previewArea) previewArea.style.display = 'none';
    // # شرط — فرع منطقي
    if (dubBtn) {
      // # block — تحديث واجهة/DOM
      dubBtn.style.display = 'none';
      DubbingApp.ui?.unlockStartDubbingButton?.();
    }
    // # شرط — فرع منطقي
    if (fileNameLine) fileNameLine.style.display = 'none';
    document.getElementById('srcLangTrigger')?.classList.remove('needs-attention');
    document.getElementById('langTrigger')?.classList.remove('needs-attention');
    // # block — تحديث واجهة/DOM
    const input = getDubbingMediaFileInputElement();
    // # شرط — فرع منطقي
    if (input) input.value = '';
    DubbingApp.costEstimate?.refreshCostEstimateUi?.();
  }

  // # FN applySelectedMediaFileToPreviewUi
  // # AR Apply file to preview immediately; validate duration without blocking UI
  // # KW رفع,upload,فيديو
  function applySelectedMediaFileToPreviewUi(file) {
    const previewArea = document.getElementById('previewArea');
    const videoEl = document.getElementById('videoPreview');
    const audioLabel = document.getElementById('audioPreviewLabel');
    const dubBtn = document.getElementById('dubBtn');
    const fileNameLine = document.getElementById('selectedFileNameLine');

    // # guard — مسح الاختيار
    if (!file) {
      // # شرط — فرع منطقي
      if (S.mediaPreviewObjectUrl) {
        URL.revokeObjectURL(S.mediaPreviewObjectUrl);
        S.mediaPreviewObjectUrl = null;
      }
      resetMediaSelectionUi();
      // # return — إرجاع النتيجة
      return;
    }

    // # try — لا تترك الواجهة عالقة عند خطأ غير متوقع
    try {
      // # شرط — فرع منطقي
      if (S.mediaPreviewObjectUrl) URL.revokeObjectURL(S.mediaPreviewObjectUrl);
      S.mediaPreviewObjectUrl = URL.createObjectURL(file);
      const isVideo = isVideoMediaFile(file);

      // # block — تطبيق فوري (لا ننتظر metadata)
      S.selectedMediaFile = file;
      S.selectedMediaDurationSec = 0;
      S.srtPreviewFileKey = '';
      DubbingApp.srtEditor?.clearSrtEditor?.();
      DubbingApp.srtEditor?.showSrtWorkspace?.(true);
      setUploadDropZoneCollapsed(true);
      // # block — معالجة صوت/استنساخ
      DubbingApp.voiceSave?.onMediaFileSelectedForVoiceSave?.();

      // # شرط — فرع منطقي
      if (previewArea) previewArea.style.display = 'flex';
      // # شرط — فرع منطقي
      if (fileNameLine) {
        fileNameLine.textContent = file.name || '';
        fileNameLine.style.display = 'none';
      }

      // # شرط — فرع منطقي
      if (isVideo) {
        // # شرط — فرع منطقي
        if (videoEl) {
          videoEl.style.display = 'block';
          videoEl.src = S.mediaPreviewObjectUrl;
        }
        // # شرط — فرع منطقي
        if (audioLabel) audioLabel.style.display = 'none';
      // # block — تحديث واجهة/DOM
      } else {
        // # شرط — فرع منطقي
        if (videoEl) {
          videoEl.style.display = 'none';
          videoEl.removeAttribute('src');
        }
        // # شرط — فرع منطقي
        if (audioLabel) {
          // # block — تحديث واجهة/DOM
          audioLabel.style.display = 'block';
          const nameEl = document.getElementById('audioFileName');
          // # شرط — فرع منطقي
          if (nameEl) nameEl.textContent = file.name || 'Audio file';
        }
      }

      // # شرط — فرع منطقي
      if (dubBtn) {
        // # block — تحديث واجهة/DOM
        dubBtn.style.display = 'block';
        dubBtn.disabled = false;
        DubbingApp.srtEditor?.syncStartDubbingButtonPhaseUi?.();
      }
      DubbingApp.langAttention?.highlightLangButtonsNeedsAttention?.();
      DubbingApp.costEstimate?.refreshCostEstimateUi?.();

      // # block — تحقق المدة بشكل غير حاجب
      void checkMediaDurationAsync(S.mediaPreviewObjectUrl, isVideo).then((durationSec) => {
        // # guard — تم استبدال الملف أثناء الانتظار
        if (S.selectedMediaFile !== file) return;
        S.selectedMediaDurationSec = durationSec;
        // # شرط — قصير جداً
        if (durationSec > 0 && durationSec < MIN_DURATION_SEC) {
          global.showToast?.(
            `Video is too short (minimum ${MIN_DURATION_SEC}s). Current: ${Math.round(durationSec)}s`,
            // # block — فرع شرطي
            'error',
          );
          resetMediaSelectionUi();
          // # return — إرجاع النتيجة
          return;
        }
        // # شرط — طويل جداً
        if (durationSec > MAX_DURATION_SEC) {
          // # block — فرع شرطي
          global.showToast?.(
            `Video is too long (maximum ${MAX_DURATION_SEC / 60} minutes). Current: ${Math.round(durationSec / 60)}m`,
            'error',
          );
          resetMediaSelectionUi();
          // # return — إرجاع النتيجة
          return;
        // # block — تنفيذ منطق — راجع الأسطر التالية
        }
        DubbingApp.costEstimate?.refreshCostEstimateUi?.();
      });
    } catch (err) {
      console.error('[media-input] apply failed', err);
      global.showToast?.(err.message || 'Could not open this media file', 'error');
      // # block — معالجة أخطاء
      resetMediaSelectionUi();
    }
  }

  // # FN bindDropZoneDragAndDrop
  // # AR Drag & drop files onto the upload box
  // # KW عام,general
  function bindDropZoneDragAndDrop(dropZone) {
    // # guard — شرط رفض أو خروج مبكر
    if (!dropZone || dropZone.dataset.dndBound === '1') return;
    dropZone.dataset.dndBound = '1';

    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach((evtName) => {
      dropZone.addEventListener(evtName, (e) => {
        e.preventDefault();
        // # block — فرع شرطي
        e.stopPropagation();
      });
    });
    dropZone.addEventListener('dragover', () => dropZone.classList.add('drag-over'));
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
    dropZone.addEventListener('drop', (e) => {
      // # block — تنفيذ منطق — راجع الأسطر التالية
      dropZone.classList.remove('drag-over');
      const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      // # guard — شرط رفض أو خروج مبكر
      if (!file) return;
      const input = getDubbingMediaFileInputElement();
      // # شرط — مزامنة input إن أمكن (بعض المتصفحات تمنع تعيين files)
      try {
        // # شرط
        if (input && typeof DataTransfer !== 'undefined') {
          // # block — معالجة أخطاء
          const dt = new DataTransfer();
          dt.items.add(file);
          input.files = dt.files;
        }
      } catch (_) {}
      applySelectedMediaFileToPreviewUi(file);
    // # block — معالجة أخطاء
    });
  }

  // # FN bindDubbingMediaFileInputChangeHandler
  // # KW عام,general
  function bindDubbingMediaFileInputChangeHandler() {
    const input = getDubbingMediaFileInputElement();
    const dropZone = document.getElementById('dropZone');
    // # guard — شرط رفض أو خروج مبكر
    if (!input) {
      console.warn('[media-input] #mediaFile missing');
      // # return — إرجاع النتيجة
      return;
    // # block — تحديث واجهة/DOM
    }
    // # guard — لا تربط مرتين
    if (!S.mediaInputInitialized) {
      S.mediaInputInitialized = true;
      input.addEventListener('change', (e) => {
        const file = e.target.files && e.target.files[0];
        applySelectedMediaFileToPreviewUi(file || null);
      // # block — فرع شرطي
      });
      document.getElementById('replaceMediaBtn')?.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        openMediaFilePicker();
      });
    // # block — تحديث واجهة/DOM
    }
    bindDropZoneDragAndDrop(dropZone);
  }

  DubbingApp.mediaInput = {
    getDubbingMediaFileInputElement,
    applySelectedMediaFileToPreviewUi,
    bindDubbingMediaFileInputChangeHandler,
    setUploadDropZoneCollapsed,
    openMediaFilePicker,
    isVideoMediaFile,
  };

  global.getDubbingFileInput = getDubbingMediaFileInputElement;
  global.applyDubbingMediaSelection = applySelectedMediaFileToPreviewUi;
  global.initDubbingMediaInput = bindDubbingMediaFileInputChangeHandler;

  // # block — اربط فوراً ولا تعتمد فقط على 99-init
  // # FN bootMediaInputBinding
  // # AR دالة bootMediaInputBinding (bootMediaInputBinding)
  // # KW عام,general
  function bootMediaInputBinding() {
    // # try — عملية قد تفشل
    try {
      bindDubbingMediaFileInputChangeHandler();
    } catch (err) {
      console.error('[media-input] bind failed', err);
    }
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootMediaInputBinding);
  } else {
    bootMediaInputBinding();
  }
})(window);
