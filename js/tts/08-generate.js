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

  let livePcmCtx = null;

  function pcmToWavBlob(chunks, sampleRate) {
    let length = 0;
    chunks.forEach((chunk) => {
      length += chunk.byteLength;
    });
    const pcm = new Uint8Array(length);
    let offset = 0;
    chunks.forEach((chunk) => {
      pcm.set(chunk, offset);
      offset += chunk.byteLength;
    });
    const even = pcm.length - (pcm.length % 2);
    const dataLen = even;
    const header = new ArrayBuffer(44);
    const view = new DataView(header);
    const write = (pos, text) => {
      for (let i = 0; i < text.length; i++) view.setUint8(pos + i, text.charCodeAt(i));
    };
    write(0, 'RIFF');
    view.setUint32(4, 36 + dataLen, true);
    write(8, 'WAVE');
    write(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    write(36, 'data');
    view.setUint32(40, dataLen, true);
    return new Blob([header, pcm.subarray(0, even)], { type: 'audio/wav' });
  }

  // # FN playLivePcmStream
  // # AR Play 24 kHz PCM as it arrives, then keep a WAV for replay and download.
  async function playLivePcmStream(res) {
    if (livePcmCtx) {
      try { await livePcmCtx.close(); } catch (_) { /* replaced */ }
      livePcmCtx = null;
    }
    const sampleRate = 24000;
    const ctx = new AudioContext({ sampleRate });
    livePcmCtx = ctx;
    if (ctx.state === 'suspended') await ctx.resume();
    TtsApp.ui.showTtsPlayerModeUi();
    const reader = res.body.getReader();
    let nextAt = ctx.currentTime + 0.05;
    let pending = new Uint8Array(0);
    const collected = [];
    let started = false;
    while (true) {
      const { done, value } = await reader.read();
      if (value && value.byteLength) {
        collected.push(value);
        const merged = new Uint8Array(pending.length + value.byteLength);
        merged.set(pending, 0);
        merged.set(value, pending.length);
        const even = merged.length - (merged.length % 2);
        const pcm = merged.subarray(0, even);
        pending = merged.slice(even);
        if (pcm.length >= 2) {
          const samples = pcm.length / 2;
          const buffer = ctx.createBuffer(1, samples, sampleRate);
          const channel = buffer.getChannelData(0);
          const view = new DataView(pcm.buffer, pcm.byteOffset, pcm.byteLength);
          for (let i = 0; i < samples; i++) channel[i] = view.getInt16(i * 2, true) / 32768;
          const source = ctx.createBufferSource();
          source.buffer = buffer;
          source.connect(ctx.destination);
          const when = Math.max(nextAt, ctx.currentTime + 0.02);
          source.start(when);
          nextAt = when + buffer.duration;
          if (!started) {
            started = true;
            global.showToast?.('Audio started', 'success');
          }
        }
      }
      if (done) break;
    }
    const wavUrl = URL.createObjectURL(pcmToWavBlob(collected, sampleRate));
    if (S.currentAudio && typeof S.currentAudio.pause === 'function') {
      try { S.currentAudio.pause(); } catch (_) { /* live context already played */ }
    }
    const audio = new Audio(wavUrl);
    audio._blobUrl = wavUrl;
    audio._downloadUrl = wavUrl;
    audio._rawDownloadUrl = wavUrl;
    S.currentAudio = audio;
    TtsApp.recent.loadAndRenderRecentTtsWorks();
  }

  /** توليد_الصوت_من_API — POST /api/tts/stream أو /api/tts/quick */
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

      const useStream = global.voiceMode !== 'quick' && S.selectedVoiceId !== 'quick_edge';
      const path = useStream ? '/api/tts/stream' : '/api/tts/quick';
      // # HTTP — طلب إلى API
      const res = await fetch(`${API}${path}`, {
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
          // Backend binds a saved Instant Voice id so the second generation skips clone.
          sample_url: global.currentSampleUrl || '',
          sample_text: (global.currentSampleText || '').trim(),
          elevenlabs_voice_id: S.selectedElevenLabsVoiceId || '',
          mode: global.voiceMode === 'quick' ? 'quick' : 'standard',
        }),
      // # block — معالجة صوت/استنساخ
      });

      const streamType = res.headers.get('content-type') || '';
      if (useStream && res.ok && streamType.includes('glotix-pcm')) {
        await playLivePcmStream(res);
        TtsApp.voiceSave?.maybePromptVoiceSaveAfterTtsSuccess?.(text);
        return;
      }
      if (useStream && res.ok && streamType.includes('audio/mpeg')) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        TtsApp.player.playTtsAudioFromApiUrl(url);
        global.showToast?.('Audio ready!', 'success');
        return;
      }

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
          global.logApiRequestFailure(`POST ${path}`, `${API}${path}`, res, data);
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