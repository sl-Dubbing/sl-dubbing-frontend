// # FILE frontend/sl-dubbing-frontend-main/js/tts/03-ui-modes.js
// # AR واجهة TTS
// # KW توليد_صوت,TTS
// # CONVENTION — FN/AR/KW + # block كل ~6 أسطر — FUNCTION_INDEX.md DOMAIN_INDEX.md
// =====================================================================
// 📒 فهرس الدوال — js/tts/03-ui-modes.js
// ---------------------------------------------------------------------
//  عرض_وضع_التوليد        → showTtsGenerateModeUi
//  عرض_وضع_التحميل        → showTtsLoadingModeUi
//  عرض_وضع_المشغّل        → showTtsPlayerModeUi
//  تحديث_أيقونة_التشغيل   → setTtsPlayPauseIcon
// =====================================================================
(function (global) {
  const TtsApp = global.TtsApp;

  // # FN getGenerateBtn
  // # AR Text-to-speech (getGenerateBtn)
  // # KW توليد_صوت,TTS,synthesis
  function getGenerateBtn() {
    // # return — إرجاع النتيجة
    return document.getElementById('generateBtn');
  }

  /** عرض_وضع_التوليد — زر Generate ظاهر */
  // # FN showTtsGenerateModeUi
  // # AR Text-to-speech (showTtsGenerateModeUi)
  // # KW توليد_صوت,TTS,synthesis
  function showTtsGenerateModeUi() {
    const generateBtn = getGenerateBtn();
    // # شرط — فرع منطقي
    if (generateBtn) {
      generateBtn.style.display = 'flex';
      generateBtn.disabled = false;
      generateBtn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> Generate';
    // # block — تحديث واجهة/DOM
    }
    const playerControls = document.getElementById('playerControls');
    const progressWrap = document.getElementById('progressWrap');
    const playerDlBtn = document.getElementById('playerDlBtn');
    // # شرط — فرع منطقي
    if (playerControls) playerControls.style.display = 'none';
    // # شرط — فرع منطقي
    if (progressWrap) progressWrap.style.display = 'none';
    // # شرط — فرع منطقي
    if (playerDlBtn) playerDlBtn.style.display = 'none';
  }

  /** عرض_وضع_التحميل — أثناء طلب API */
  // # FN showTtsLoadingModeUi
  // # KW توليد_صوت,TTS,synthesis
  function showTtsLoadingModeUi() {
    const generateBtn = getGenerateBtn();
    // # شرط — فرع منطقي
    if (generateBtn) {
      generateBtn.style.display = 'flex';
      generateBtn.disabled = true;
      generateBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Generating...';
    // # block — تحديث واجهة/DOM
    }
    const playerControls = document.getElementById('playerControls');
    const progressWrap = document.getElementById('progressWrap');
    // # شرط — فرع منطقي
    if (playerControls) playerControls.style.display = 'none';
    // # شرط — فرع منطقي
    if (progressWrap) progressWrap.style.display = 'none';
  }

  /** عرض_وضع_المشغّل — بعد نجاح التوليد */
  // # FN showTtsPlayerModeUi
  // # AR Text-to-speech (showTtsPlayerModeUi)
  // # KW توليد_صوت,TTS,synthesis
  function showTtsPlayerModeUi() {
    const generateBtn = getGenerateBtn();
    // # شرط — فرع منطقي
    if (generateBtn) generateBtn.style.display = 'none';
    const playerControls = document.getElementById('playerControls');
    const progressWrap = document.getElementById('progressWrap');
    const playerDlBtn = document.getElementById('playerDlBtn');
    // # شرط — فرع منطقي
    if (playerControls) playerControls.style.display = 'flex';
    // # شرط — فرع منطقي
    if (progressWrap) progressWrap.style.display = 'flex';
    // # شرط — فرع منطقي
    if (playerDlBtn) playerDlBtn.style.display = 'flex';
  }

  /** تحديث_أيقونة_التشغيل */
  // # FN setTtsPlayPauseIcon
  // # AR تعيين tts play pause icon (setTtsPlayPauseIcon)
  // # KW توليد_صوت,TTS,synthesis
  function setTtsPlayPauseIcon(playing) {
    const playPauseIcon = document.getElementById('playPauseIcon');
    const playPauseBtn = document.getElementById('playPauseBtn');
    // # guard — شرط رفض أو خروج مبكر
    if (!playPauseIcon) return;
    playPauseIcon.className = playing ? 'fa-solid fa-pause' : 'fa-solid fa-play';
    // # شرط — فرع منطقي
    if (playPauseBtn) playPauseBtn.title = playing ? 'Pause' : 'Play';
  }

  TtsApp.ui = {
    showTtsGenerateModeUi,
    showTtsLoadingModeUi,
    showTtsPlayerModeUi,
    setTtsPlayPauseIcon,
  };
})(window);
