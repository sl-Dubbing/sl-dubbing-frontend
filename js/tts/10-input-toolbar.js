// # FILE frontend/sl-dubbing-frontend-main/js/tts/10-input-toolbar.js
// # AR واجهة TTS
// # KW توليد_صوت,TTS
// # CONVENTION — FN/AR/KW + # block كل ~6 أسطر — FUNCTION_INDEX.md DOMAIN_INDEX.md
// =====================================================================
// 📒 فهرس الدوال — js/tts/10-input-toolbar.js
// ---------------------------------------------------------------------
//  ربط_شريط_أدوات_الإدخال   → bindTtsInputToolbarEvents
// =====================================================================
(function (global) {
  const TtsApp = global.TtsApp;

  // # FN isPlayerModeActive
  // # AR Text-to-speech (isPlayerModeActive)
  // # KW توليد_صوت,TTS,synthesis
  function isPlayerModeActive() {
    const generateBtn = document.getElementById('generateBtn');
    // # return — إرجاع النتيجة
    return generateBtn && generateBtn.style.display === 'none';
  }

  // # FN resetToGenerateModeAfterInputChange
  // # AR Text-to-speech (resetToGenerateModeAfterInputChange)
  // # KW توليد_صوت,TTS,synthesis
  function resetToGenerateModeAfterInputChange() {
    // # شرط — فرع منطقي
    if (isPlayerModeActive()) {
      TtsApp.ui.showTtsGenerateModeUi();
      TtsApp.player.disposeTtsCurrentAudio();
    }
  }

  /** ربط_شريط_أدوات_الإدخال — لصق، مسح، استماع سريع */
  // # FN bindTtsInputToolbarEvents
  // # AR bind tts input toolbar events (bindTtsInputToolbarEvents)
  // # KW توليد_صوت,TTS,synthesis
  function bindTtsInputToolbarEvents() {
    const ttsInput = document.getElementById('ttsInput');
    const pasteBtn = document.getElementById('pasteBtn');
    const quickListenBtn = document.getElementById('quickListenBtn');
    const clearBtn = document.getElementById('clearBtn');

    ttsInput?.addEventListener('input', resetToGenerateModeAfterInputChange);

    // # block — توليد صوت TTS
    pasteBtn?.addEventListener('click', async () => {
      // # try — معالجة عملية قد تفشل
      try {
        const text = await navigator.clipboard.readText();
        // # شرط — فرع منطقي
        if (ttsInput) {
          ttsInput.value = text;
          TtsApp.ui.showTtsGenerateModeUi();
          // # block — توليد صوت TTS
          TtsApp.player.disposeTtsCurrentAudio();
        }
      } catch (err) {
        global.showToast?.('Please allow clipboard permissions to paste text.', 'error');
      }
    });

    // # block — معالجة أخطاء
    quickListenBtn?.addEventListener('click', () => {
      TtsApp.generate.generateTtsAudioFromApi();
    });

    clearBtn?.addEventListener('click', () => {
      // # شرط — فرع منطقي
      if (ttsInput) {
        ttsInput.value = '';
        // # block — توليد صوت TTS
        ttsInput.focus();
        TtsApp.ui.showTtsGenerateModeUi();
        TtsApp.player.disposeTtsCurrentAudio();
      }
    });
  }

  TtsApp.input = { bindTtsInputToolbarEvents };
})(window);
