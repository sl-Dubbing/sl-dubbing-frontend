// # FILE frontend/sl-dubbing-frontend-main/js/tts/08-generate.js
// # AR واجهة TTS
// # KW توليد_صوت,TTS
// # CONVENTION — FN/AR/KW + # block كل ~6 أسطر — FUNCTION_INDEX.md DOMAIN_INDEX.md
// =====================================================================
// 📒 فهرس الدوال — js/tts/08-generate.js
// ---------------------------------------------------------------------
//  توليد_الصوت_من_API       → generateTtsAudioFromApi
//  ربط_زر_التوليد           → bindTtsGenerateButton
// =====================================================================
(function (global) {
  const TtsApp = global.TtsApp;
  const S = TtsApp.state;
  const { normalizeTtsApiBaseUrl, resolveTtsTranslationContext } = TtsApp.helpers;

  /** توليد_الصوت_من_API — POST /api/tts/quick */
  // # FN generateTtsAudioFromApi
  // # KW توليد_صوت,TTS,synthesis
  async function generateTtsAudioFromApi() {
    const ttsInput = document.getElementById('ttsInput');
    const text = ttsInput ? ttsInput.value.trim() : '';
    // # guard — شرط رفض أو خروج مبكر
    if (!text) {
      global.showToast?.('Please enter text first', 'error');
      // # return — إرجاع النتيجة
      return;
    // # block — توليد صوت TTS
    }
    // # guard — شرط رفض أو خروج مبكر
    if (S.generating) return;

    S.generating = true;
    TtsApp.ui.showTtsLoadingModeUi();

    // # try — معالجة عملية قد تفشل
    try {
      let headers =
        // # block — توليد صوت TTS
        typeof global.refreshApiAuthHeadersFromSupabase === 'function'
          ? await global.refreshApiAuthHeadersFromSupabase()
          : null;
      // # شرط — فرع منطقي
      if (!headers && typeof global.getApiAuthHeaders === 'function') {
        headers = global.getApiAuthHeaders();
      }
      // # guard — شرط رفض أو خروج مبكر
      if (!headers) {
        global.showToast?.('Please sign in first', 'error');
        TtsApp.ui.showTtsGenerateModeUi();
        // # return — إرجاع النتيجة
        return;
      }

      const API = normalizeTtsApiBaseUrl();
      // # block — معالجة صوت/استنساخ
      const isUserClone = (S.selectedVoiceId || '').startsWith('clone_');
      const isCustomUpload = S.selectedVoiceId === 'custom_clone';
      const isPremiumVoice =
        S.selectedVoiceId &&
        S.selectedVoiceId !== 'quick_edge' &&
        !isUserClone &&
        // # block — معالجة صوت/استنساخ
        !isCustomUpload;

      const { sourceCode, sourceDialect, translate } = resolveTtsTranslationContext(
        text,
        S.currentLangCode,
        S.currentBaseLang,
        S.currentDialect,
      // # block — خطوة ترجمة (مترجم)
      );

      // # HTTP — طلب إلى API
      const res = await fetch(`${API}/api/tts/quick`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        // # تسلسل JSON للطلب
        body: JSON.stringify({
          text,
          // # block — طلب HTTP/API
          lang: S.currentLangCode,
          lang_code: S.currentLangCode,
          dialect: S.currentDialect,
          source_language: sourceCode,
          source_dialect: sourceDialect,
          translate,
          // # block — خطوة ترجمة (مترجم)
          voice_id: S.selectedVoiceId,
          voice_name: document.getElementById('currentVoiceName')?.textContent?.trim() || '',
          // Backend resolves from Supabase; send sample as fallback if service lookup fails
          sample_url: global.currentSampleUrl || '',
          sample_text: (global.currentSampleText || '').trim(),
          mode: global.voiceMode === 'quick' ? 'quick' : 'standard',
        }),
      // # block — معالجة صوت/استنساخ
      });

      let data = {};
      // # try — معالجة عملية قد تفشل
      try {
        // # parse — قراءة JSON من الاستجابة
        data = await res.json();
      } catch (_) {
        data = {};
      // # block — parse/serialize JSON
      }

      // # شرط — فرع منطقي
      if (
        typeof global.isInsufficientCreditsResponse === 'function' &&
        global.isInsufficientCreditsResponse(res, data)
      ) {
        global.showInsufficientCreditsModal?.({
          // # block — نقاط/credits
          required: data.required,
          balance: data.balance,
          context: 'tts',
        });
        TtsApp.ui.showTtsGenerateModeUi();
        // # return — إرجاع النتيجة
        return;
      // # block — توليد صوت TTS
      }

      // # شرط — فرع منطقي
      if (!res.ok || !data.success) {
        // # شرط — فرع منطقي
        if (typeof global.logApiRequestFailure === 'function') {
          global.logApiRequestFailure('POST /api/tts/quick', `${API}/api/tts/quick`, res, data);
        }
        const msg =
          // # block — توليد صوت TTS
          typeof global.humanizeApiErrorMessage === 'function'
            ? global.humanizeApiErrorMessage(res, data, 'Server failed to generate audio')
            : data.error || 'Server failed to generate audio';
        // # raise — رفع خطأ للم caller
        throw new Error(msg);
      }

      const rawUrl = data.url || '';
      // # guard — شرط رفض أو خروج مبكر
      if (!rawUrl) throw new Error('No audio URL returned');

      // الترجمة الصامتة: الخادم يعيد النص الأصلي دائماً — لا نغيّر مربع الإدخال
      const displayText = (data.text || text).trim() || text;

      TtsApp.player.playTtsAudioFromApiUrl(rawUrl);
      global.showToast?.('Audio ready!', 'success');

      TtsApp.recent.saveTtsItemToLocalHistory({
        text: displayText,
        // # block — توليد صوت TTS
        url: rawUrl,
        lang: S.currentLangCode || S.currentBaseLang,
      });
      TtsApp.recent.loadAndRenderRecentTtsWorks();

      TtsApp.voiceSave?.maybePromptVoiceSaveAfterTtsSuccess?.(displayText);
    } catch (e) {
      // # block — معالجة صوت/استنساخ
      console.error('[tts] generate error:', e);
      global.showToast?.(e.message || 'Generation failed', 'error');
      TtsApp.ui.showTtsGenerateModeUi();
    } finally {
      S.generating = false;
    }
  }

  // # FN bindTtsGenerateButton
  // # AR bind tts generate button (bindTtsGenerateButton)
  // # KW توليد_صوت,TTS,synthesis
  function bindTtsGenerateButton() {
    document.getElementById('generateBtn')?.addEventListener('click', generateTtsAudioFromApi);
  }

  TtsApp.generate = {
    generateTtsAudioFromApi,
    bindTtsGenerateButton,
  };
})(window);