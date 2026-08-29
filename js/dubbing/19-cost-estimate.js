// # FILE frontend/sl-dubbing-frontend-main/js/dubbing/19-cost-estimate.js
// # AR واجهة الدبلجة — رفع، Start، polling، أصوات
// # KW عام,general
// # CONVENTION — FN/AR/KW + # block كل ~6 أسطر — FUNCTION_INDEX.md DOMAIN_INDEX.md
// =====================================================================
// 📒 فهرس الدوال — js/dubbing/19-cost-estimate.js
// ---------------------------------------------------------------------
//  تقدير_تكلفة_الأحرف_من_المدة        → estimateCharacterCostFromDuration
//  قراءة_مدة_الوسائط_المحددة          → readSelectedMediaDurationSec
//  تحديث_تحذير_التكلفة_في_النموذج     → refreshCostEstimateUi
// =====================================================================
(function (global) {
  const DubbingApp = global.DubbingApp || (global.DubbingApp = {});
  const CHARS_PER_MIN = 1000;
  const MARKUP = 1.5;

  // # FN estimateCharacterCostFromDuration
  // # AR تقدير تكلفة الأحرف من مدة الفيديو (بدون عرض UI)
  // # KW عام,general
  function estimateCharacterCostFromDuration(durationSec) {
    const minutes = Math.max(0, Number(durationSec || 0) / 60);
    const raw = Math.ceil(minutes * CHARS_PER_MIN);
    // # guard — رفض/خروج
    if (raw <= 0) return 0;
    return Math.max(1, Math.ceil(raw * MARKUP));
  }

  // # FN readSelectedMediaDurationSec
  // # AR قراءة مدة الوسائط المحددة
  // # KW عام,general
  function readSelectedMediaDurationSec() {
    const video = document.getElementById('videoPreview');
    // # guard — رفض/خروج
    if (video && video.duration && isFinite(video.duration) && video.duration > 0) {
      return video.duration;
    }
    return DubbingApp.state?.selectedMediaDurationSec || 0;
  }

  // # FN removeLegacyCostEstimateDom
  // # AR إزالة صندوق تقدير التكلفة إن وُجد من جلسة سابقة
  // # KW عام,general
  function removeLegacyCostEstimateDom() {
    document.getElementById('charCostEstimate')?.remove();
  }

  // # FN refreshCostEstimateUi
  // # AR تعطيل Start عند رصيد 0 فقط — بدون لوحة تقدير مرئية
  // # KW عام,general
  function refreshCostEstimateUi() {
    removeLegacyCostEstimateDom();
    const dubBtn = document.getElementById('dubBtn');
    // # guard — رفض/خروج
    if (!dubBtn) return;

    const balanceRaw =
      global.SLShared?.creditsHelpers?.readCurrentUserCreditBalance?.() ??
      // # block — نقاط/credits
      global.__glotixCharacterCredits ??
      global.__glotixUserCredits;
    const balance = Number(balanceRaw);
    const balanceKnown = Number.isFinite(balance);
    const balanceZero = balanceKnown && balance <= 0;

    // # شرط
    if (balanceZero) {
      // # block — نقاط/credits
      dubBtn.disabled = true;
      dubBtn.setAttribute('aria-disabled', 'true');
      dubBtn.title = 'Character balance is 0 — purchase credits to continue';
      dubBtn.style.opacity = '0.55';
      dubBtn.style.cursor = 'not-allowed';
      return;
    // # block — نقاط/credits
    }

    dubBtn.removeAttribute('aria-disabled');
    dubBtn.style.opacity = '';
    dubBtn.style.cursor = '';
    DubbingApp.srtEditor?.syncStartDubbingButtonPhaseUi?.();
  }

  // # FN patchMediaDurationTracking
  // # AR تتبع مدة الفيديو وتحديث حالة زر Start
  // # KW عام,general
  function patchMediaDurationTracking() {
    const video = document.getElementById('videoPreview');
    // # شرط
    if (video && !video.__glotixDurationHook) {
      video.__glotixDurationHook = true;
      video.addEventListener('loadedmetadata', () => {
        // # شرط
        if (isFinite(video.duration) && video.duration > 0) {
          // # block — تحديث واجهة/DOM
          DubbingApp.state = DubbingApp.state || {};
          DubbingApp.state.selectedMediaDurationSec = video.duration;
        }
        refreshCostEstimateUi();
      });
    }
    // # block — تحديث واجهة/DOM
    const input = document.getElementById('mediaFile');
    // # شرط
    if (input && !input.__glotixEstimateHook) {
      input.__glotixEstimateHook = true;
      input.addEventListener('change', () => setTimeout(refreshCostEstimateUi, 300));
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    patchMediaDurationTracking();
    refreshCostEstimateUi();
  });

  DubbingApp.costEstimate = {
    estimateCharacterCostFromDuration,
    readSelectedMediaDurationSec,
    refreshCostEstimateUi,
  };
  global.refreshCharCostEstimate = refreshCostEstimateUi;
})(window);
