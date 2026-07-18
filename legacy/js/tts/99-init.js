// # FILE frontend/sl-dubbing-frontend-main/js/tts/99-init.js
// # AR واجهة TTS
// # KW توليد_صوت,TTS
// # CONVENTION — FN/AR/KW + # block كل ~6 أسطر — FUNCTION_INDEX.md DOMAIN_INDEX.md
// =====================================================================
// 📒 فهرس الدوال — js/tts/99-init.js
// ---------------------------------------------------------------------
//  تحميل_الصوت_المحفوظ_محلياً → restoreSavedCustomVoiceFromLocalStorage
//  تشغيل_صفحة_TTS            → bootstrapTtsPageOnDomReady
// =====================================================================
(function (global) {
  const TtsApp = global.TtsApp;
  const S = TtsApp.state;
  const { getTtsUserVoiceStorageKey, normalizeTtsLangCode } = TtsApp.helpers;
  const LANG_KEY = TtsApp.constants.LANG_STORAGE_KEY;

  /** تحميل_الصوت_المحفوظ_محلياً */
  // # FN restoreSavedCustomVoiceFromLocalStorage
  // # AR الصوت والاستنساخ (restoreSavedCustomVoiceFromLocalStorage)
  // # KW صوت,استنساخ,voice,clone,sample,رفع,upload,R2,storage,توليد_صوت,TTS,synthesis,تنفيذ,local,cloud,modal,parity
  function restoreSavedCustomVoiceFromLocalStorage() {
    // # localStorage — تخزين محلي
    const savedCustomVoice = localStorage.getItem(getTtsUserVoiceStorageKey());
    // # guard — شرط رفض أو خروج مبكر
    if (!savedCustomVoice) return;
    global.currentSampleUrl = savedCustomVoice;
    global.usingSavedVoice = true;
    global.voiceMode = 'clone';
    // Bug 1 fix: restore selectedVoiceId so generate knows to use clone mode
    // # block — معالجة صوت/استنساخ
    S.selectedVoiceId = 'custom_clone';
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

  // # FN bootstrapTtsPageOnDomReady
  // # AR bootstrap tts page on dom ready (bootstrapTtsPageOnDomReady)
  // # KW توليد_صوت,TTS,synthesis
  function bootstrapTtsPageOnDomReady() {
    restoreSavedCustomVoiceFromLocalStorage();

    // # localStorage — تخزين محلي
    const storedLang = localStorage.getItem(LANG_KEY) || 'ar';
    S.currentLangCode = normalizeTtsLangCode(storedLang);

    TtsApp.lang.bindTtsLanguageDropdownUi(S.currentLangCode);
    TtsApp.voice.bindTtsVoicePanelUi();
    // Bug 1 fix: show clone note if voice was restored from localStorage
    // # شرط — فرع منطقي
    if (S.selectedVoiceId === 'custom_clone') {
      TtsApp.voice.showVoiceCloneNote(true);
      document.getElementById('cloneCard')?.classList.add('selected');
    } else if (!S.selectedVoiceId) {
      // Reliable default: Edge TTS (Quick) — no ElevenLabs key required
      TtsApp.voice.selectQuickEdgeVoice?.();
    }
    // # block — معالجة صوت/استنساخ
    TtsApp.voice.loadTtsPremiumVoicesFromSupabase();
    setTimeout(() => TtsApp.voice.loadUserVoiceClonesIntoTtsPanel(), 800);
    // # block — معالجة صوت/استنساخ
    TtsApp.input.bindTtsInputToolbarEvents();
    TtsApp.stt.bindTtsSpeechDictationButton();
    TtsApp.player.bindTtsPlayerControlButtons();
    TtsApp.generate.bindTtsGenerateButton();

    // # block — معالجة صوت/استنساخ
    TtsApp.ui.showTtsGenerateModeUi();
    setTimeout(() => TtsApp.recent.loadAndRenderRecentTtsWorks(), 1000);
  }

  document.addEventListener('DOMContentLoaded', bootstrapTtsPageOnDomReady);
})(window);
