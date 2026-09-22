// # FILE frontend/sl-dubbing-frontend-main/js/tts/05-stt.js
// # AR واجهة TTS
// # KW تفريغ,ASR,توليد_صوت,TTS
// # CONVENTION — FN/AR/KW + # block كل ~6 أسطر — FUNCTION_INDEX.md DOMAIN_INDEX.md
// =====================================================================
// 📒 فهرس الدوال — js/tts/05-stt.js
// ---------------------------------------------------------------------
//  إيقاف_الإملاء_الصوتي     → stopTtsSpeechDictation
//  ربط_زر_الإملاء_الصوتي    → bindTtsSpeechDictationButton
// =====================================================================
(function (global) {
  const TtsApp = global.TtsApp;

  let recognition = null;
  let isRecordingStt = false;

  // # FN getTtsInputElement
  // # AR Speech-to-text (getTtsInputElement)
  // # KW تفريغ,ASR,STT,whisper,deepgram,توليد_صوت,TTS,synthesis
  function getTtsInputElement() {
    // # return — إرجاع النتيجة
    return document.getElementById('ttsInput');
  }

  // # FN onSttFinalTranscript
  // # KW تفريغ,ASR,STT,whisper,deepgram,توليد_صوت,TTS,synthesis
  function onSttFinalTranscript(chunk) {
    const ttsInput = getTtsInputElement();
    // # guard — شرط رفض أو خروج مبكر
    if (!chunk || !ttsInput) return;
    const currentVal = ttsInput.value;
    const separator =
      currentVal === '' || currentVal.endsWith(' ') || currentVal.endsWith('\n') ? '' : ' ';
    // # block — توليد صوت TTS
    ttsInput.value = currentVal + separator + chunk;
    const generateBtn = document.getElementById('generateBtn');
    // # شرط — فرع منطقي
    if (generateBtn && generateBtn.style.display === 'none') {
      TtsApp.ui.showTtsGenerateModeUi();
      TtsApp.player.disposeTtsCurrentAudio();
    }
  }

  /** إيقاف_الإملاء_الصوتي */
  // # FN stopTtsSpeechDictation
  // # AR Speech-to-text (stopTtsSpeechDictation)
  // # KW تفريغ,ASR,STT,whisper,deepgram,توليد_صوت,TTS,synthesis
  function stopTtsSpeechDictation() {
    // # guard — شرط رفض أو خروج مبكر
    if (!recognition) return;
    isRecordingStt = false;
    // # try — معالجة عملية قد تفشل
    try {
      recognition.stop();
    } catch (_) { /* ignore */ }
    // # block — معالجة صوت/استنساخ
    const voiceTypingBtn = document.getElementById('voiceTypingBtn');
    // # شرط — فرع منطقي
    if (voiceTypingBtn) {
      voiceTypingBtn.classList.remove('recording-active');
      voiceTypingBtn.innerHTML = '<i class="fa-solid fa-microphone"></i> Start Dictation';
    }
  }

  // # FN speechRecognitionLangFromCatalogCode
  // # AR Map Glotix locale codes (ar-eg) to Web Speech BCP-47 (ar-EG).
  // # KW تفريغ,ASR,STT,لغة,language,dialect
  function speechRecognitionLangFromCatalogCode(code) {
    const raw = String(code || '').trim().toLowerCase();
    // # guard — شرط رفض أو خروج مبكر
    if (!raw) return 'ar-SA';
    const parts = raw.split('-');
    const base = parts[0] || 'ar';
    const region = parts[1];
    // # شرط — فرع منطقي
    if (region) return `${base}-${region.toUpperCase()}`;
    const defaults = {
      ar: 'ar-SA',
      en: 'en-US',
      fr: 'fr-FR',
      es: 'es-ES',
      de: 'de-DE',
      it: 'it-IT',
      pt: 'pt-BR',
      zh: 'zh-CN',
      ja: 'ja-JP',
      ko: 'ko-KR',
      hi: 'hi-IN',
      tr: 'tr-TR',
      ru: 'ru-RU',
      nl: 'nl-NL',
      pl: 'pl-PL',
      uk: 'uk-UA',
      vi: 'vi-VN',
      id: 'id-ID',
      ms: 'ms-MY',
      fil: 'fil-PH',
      th: 'th-TH',
      he: 'he-IL',
      fa: 'fa-IR',
      ur: 'ur-PK',
      bn: 'bn-BD',
      sw: 'sw-KE',
    };
    // # return — إرجاع النتيجة
    return defaults[base] || base;
  }

  // # FN populateTtsDictationLangSelect
  // # AR Keep Voice Typing list in sync with the Generate language catalog.
  // # KW تفريغ,ASR,STT,لغة,language,dialect
  function populateTtsDictationLangSelect(preferredCode) {
    const select = document.getElementById('sttLangSelect');
    // # guard — شرط رفض أو خروج مبكر
    if (!select) return;
    const langs = global.SHARED_LANGUAGES || global.LANGUAGES || [];
    // # guard — شرط رفض أو خروج مبكر
    if (!langs.length) return;
    const previous = select.value;
    const preferred = speechRecognitionLangFromCatalogCode(
      preferredCode || global.TtsApp?.state?.currentLangCode || '',
    );
    select.replaceChildren();
    langs.forEach((lang) => {
      const opt = document.createElement('option');
      opt.value = speechRecognitionLangFromCatalogCode(lang.code);
      opt.dataset.code = lang.code;
      const dialect = String(lang.dialect || '').trim();
      opt.textContent = dialect
        ? `${lang.name_en} — ${dialect}`
        : lang.name_en || lang.code;
      select.appendChild(opt);
    });
    const matchPreferred = Array.from(select.options).find((o) => o.value === preferred);
    const matchPrevious = Array.from(select.options).find((o) => o.value === previous);
    select.value = (matchPreferred || matchPrevious || select.options[0])?.value || preferred;
  }

  /** ربط_زر_الإملاء_الصوتي */
  // # FN bindTtsSpeechDictationButton
  // # AR bind tts speech dictation button (bindTtsSpeechDictationButton)
  // # KW تفريغ,ASR,STT,whisper,deepgram,توليد_صوت,TTS,synthesis
  function bindTtsSpeechDictationButton() {
    const voiceTypingBtn = document.getElementById('voiceTypingBtn');
    const sttLangSelect = document.getElementById('sttLangSelect');
    populateTtsDictationLangSelect();
    document.addEventListener('glotix:languages-ready', () => {
      populateTtsDictationLangSelect(global.TtsApp?.state?.currentLangCode);
    });

    // # شرط — فرع منطقي
    if (global.SpeechRecognition || global.webkitSpeechRecognition) {
      const SpeechRecognition =
        global.SpeechRecognition || global.webkitSpeechRecognition;
      // # block — معالجة صوت/استنساخ
      recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = false;

      recognition.onstart = function () {
        isRecordingStt = true;
        // # شرط — فرع منطقي
        if (voiceTypingBtn) {
          // # block — معالجة صوت/استنساخ
          voiceTypingBtn.classList.add('recording-active');
          voiceTypingBtn.innerHTML = '<i class="fa-solid fa-stop"></i> Stop Dictation';
        }
        global.showToast?.('Listening... speak now.', 'info');
      };

      recognition.onerror = function (event) {
        // # شرط — فرع منطقي
        if (event.error !== 'no-speech') {
          global.showToast?.('Microphone error: ' + event.error, 'error');
          stopTtsSpeechDictation();
        }
      };

      recognition.onend = function () {
        // # شرط — فرع منطقي
        if (isRecordingStt) stopTtsSpeechDictation();
      };

      recognition.onresult = function (event) {
        let finalChunk = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          // # شرط — فرع منطقي
          if (event.results[i].isFinal) finalChunk += event.results[i][0].transcript;
        // # block — فرع شرطي
        }
        onSttFinalTranscript(finalChunk);
      };

      voiceTypingBtn?.addEventListener('click', () => {
        // # شرط — فرع منطقي
        if (isRecordingStt) {
          stopTtsSpeechDictation();
        // # block — معالجة صوت/استنساخ
        } else {
          recognition.lang = sttLangSelect?.value || 'ar-SA';
          recognition.start();
        }
      });
    } else if (voiceTypingBtn) {
      // # block — معالجة صوت/استنساخ
      voiceTypingBtn.disabled = true;
      voiceTypingBtn.style.opacity = '0.5';
      voiceTypingBtn.innerHTML = '<i class="fa-solid fa-microphone-slash"></i> Not Supported';
    }
  }

  TtsApp.stt = {
    bindTtsSpeechDictationButton,
    stopTtsSpeechDictation,
    populateTtsDictationLangSelect,
  };
})(window);
