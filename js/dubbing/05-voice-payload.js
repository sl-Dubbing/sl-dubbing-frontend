// # FILE frontend/sl-dubbing-frontend-main/js/dubbing/05-voice-payload.js
// # AR واجهة الدبلجة — رفع، Start، polling، أصوات
// # KW صوت,استنساخ
// # CONVENTION — FN/AR/KW + # block كل ~6 أسطر — FUNCTION_INDEX.md DOMAIN_INDEX.md
// dubbing/05-voice-payload.js — Build voice section of dub start request body
(function (global) {
  const DubbingApp = global.DubbingApp;

  // # FN readSelectedVoiceModeFromDomElements
  // # AR الصوت والاستنساخ (readSelectedVoiceModeFromDomElements)
  // # KW صوت,استنساخ,voice,clone,sample
  function readSelectedVoiceModeFromDomElements() {
    const active = document.querySelector(
      '.voice-option.active[data-voice-mode], [data-voice-mode].selected, [data-voice-mode][aria-selected="true"]',
    );
    // # guard — شرط رفض أو خروج مبكر
    if (active) {
      const m = (active.getAttribute('data-voice-mode') || '').toLowerCase().trim();
      // # guard — شرط رفض أو خروج مبكر
      if (m) return m;
    }
    const g = (global.voiceMode || '').toLowerCase().trim();
    // # return — إرجاع النتيجة
    return g || '';
  }

  // # FN resolveSelectedVoiceSampleUrlFromDom
  // # KW صوت,استنساخ,voice,clone,sample
  function resolveSelectedVoiceSampleUrlFromDom() {
    const fromWindow = (global.selectedSample || '').trim();
    // # guard — شرط رفض أو خروج مبكر
    if (fromWindow.startsWith('http') || fromWindow.startsWith('data:')) return fromWindow;

    const selectedCard = document.querySelector('.voice-avatar-card.selected[data-sample-url]');
    // # guard — شرط رفض أو خروج مبكر
    if (selectedCard) {
      const fromCard = (selectedCard.getAttribute('data-sample-url') || '').trim();
      // # guard — شرط رفض أو خروج مبكر
      if (fromCard.startsWith('http') || fromCard.startsWith('data:')) return fromCard;
    }

    // # guard — شرط رفض أو خروج مبكر
    if (global.usingSavedVoice || document.querySelector('.voice-saved-user-card.selected')) {
      const saved = (global.savedVoiceProfile?.sample_url || '').trim();
      // # guard — شرط رفض أو خروج مبكر
      if (saved) return saved;
    }
    // # return — إرجاع النتيجة
    return fromWindow;
  }

  // # FN resolveSelectedVoiceSampleTextFromDom
  // # AR الصوت والاستنساخ (resolveSelectedVoiceSampleTextFromDom)
  // # KW صوت,استنساخ,voice,clone,sample
  function resolveSelectedVoiceSampleTextFromDom() {
    const fromWindow = (global.selectedSampleText || '').trim();
    // # guard — شرط رفض أو خروج مبكر
    if (fromWindow) return fromWindow;

    const selectedCard = document.querySelector(
      '.voice-avatar-card.selected[data-sample-text], .voice-user-clone-card.selected[data-sample-text]',
    );
    // # guard — شرط رفض أو خروج مبكر
    if (selectedCard) {
      return (selectedCard.getAttribute('data-sample-text') || '').trim();
    }
    // # return — إرجاع النتيجة
    return '';
  }

  // # FN resolveCloneSourceForDubRequest
  // # KW صوت,استنساخ,voice,clone,sample
  function resolveCloneSourceForDubRequest(sample, usingSaved) {
    // # guard — شرط رفض أو خروج مبكر
    if (!sample) return 'video';
    const preset = (global.selectedCloneSource || '').trim();
    // # guard — شرط رفض أو خروج مبكر
    if (preset) return preset;
    // # guard — شرط رفض أو خروج مبكر
    if (usingSaved) return 'saved';
    const card = document.querySelector('.voice-avatar-card.selected[data-sample-url]');
    // # guard — شرط رفض أو خروج مبكر
    if (card?.classList.contains('voice-user-clone-card')) return 'library';
    // # guard — شرط رفض أو خروج مبكر
    if (card?.classList.contains('voice-saved-user-card')) return 'saved';
    // # return — إرجاع النتيجة
    return 'premium';
  }

  // # FN dubbingRequestNeedsVoiceCloneCreditCharge
  // # AR الصوت والاستنساخ (dubbingRequestNeedsVoiceCloneCreditCharge)
  // # KW صوت,استنساخ,voice,clone,sample,نقاط,credits,billing,خصم
  function dubbingRequestNeedsVoiceCloneCreditCharge() {
    // # guard — رفض/خروج
    if (global.APP_CONFIG && global.APP_CONFIG.CPU_SITE_MODE) return false;
    const sample = resolveSelectedVoiceSampleUrlFromDom();
    const usingSaved = !!global.usingSavedVoice;
    const mode = readSelectedVoiceModeFromDomElements();
    const cloneSource = resolveCloneSourceForDubRequest(sample, usingSaved);
    // # guard — شرط رفض أو خروج مبكر
    if (cloneSource === 'premium') return false;
    // # guard — شرط رفض أو خروج مبكر
    if (cloneSource === 'library' || cloneSource === 'saved') return false;
    // # guard — شرط رفض أو خروج مبكر
    if (mode === 'default') return false;
    // # return — إرجاع النتيجة
    return cloneSource === 'video' || !sample;
  }

  // # FN buildVoiceConfigPayloadForDubApiRequest
  // # AR بناء voice config payload for dub API —  request (buildVoiceConfigPayloadForDubApiRequest)
  // # KW صوت,استنساخ,voice,clone,sample
  function buildVoiceConfigPayloadForDubApiRequest() {
    const sample = resolveSelectedVoiceSampleUrlFromDom();
    const sampleText = resolveSelectedVoiceSampleTextFromDom();
    const usingSaved = !!global.usingSavedVoice;
    const mode = readSelectedVoiceModeFromDomElements();
    let quality = String(global.dubbingQuality || 'studio').toLowerCase();
    const elevenLabsVoiceId = String(global.selectedElevenLabsVoiceId || '').trim();
    // # block — معالجة صوت/استنساخ
    const cpuSite = !!(global.APP_CONFIG && global.APP_CONFIG.CPU_SITE_MODE);
    const videoClone = !sample && !usingSaved && mode !== 'default' && !elevenLabsVoiceId;
    // # guard — Fast Dub cannot isolate music/clone from video; fall back to studio
    if (quality === 'fast' && videoClone) {
      quality = 'studio';
      global.showToast?.(
        'Fast Dub needs Default/Premium voice — using Studio for voice clone',
        'info',
      );
    }

    // # guard — CPU site mode: Edge neural voices, browser stem prep, no GPU clone
    if (cpuSite && !sample && !usingSaved) {
      return {
        voice_mode: 'default',
        cpu_site_mode: true,
        browser_stem_prep: true,
        // # block — معالجة صوت/استنساخ
        quality: 'fast',
      };
    }

    // # شرط — فرع منطقي
    if (sample) {
      const payload = {
        sample_url: sample,
        // # block — معالجة صوت/استنساخ
        voice_mode: mode || 'clone',
        clone_source: resolveCloneSourceForDubRequest(sample, usingSaved),
        speaker_mode: (global.speakerMode || 'auto'),
        enable_lipsync: !!global.enableLipsync,
        quality,
      // # block — معالجة صوت/استنساخ
      };
      // # guard — شرط رفض أو خروج مبكر
      if (sampleText) payload.sample_text = sampleText;
      // # guard — شرط رفض أو خروج مبكر
      if (usingSaved) payload.use_saved_voice = true;
      // # guard — premium ElevenLabs id skips Instant Voice Clone on Fast path
      if (elevenLabsVoiceId) payload.elevenlabs_voice_id = elevenLabsVoiceId;
      // # return — إرجاع النتيجة
      return payload;
    }
    // # guard — شرط رفض أو خروج مبكر
    if (usingSaved && global.savedVoiceProfile?.sample_url) {
      // # return — إرجاع النتيجة
      return {
        // # block — معالجة صوت/استنساخ
        sample_url: global.savedVoiceProfile.sample_url.trim(),
        use_saved_voice: true,
        // # block — معالجة صوت/استنساخ
        voice_mode: mode || 'clone',
        clone_source: 'saved',
        speaker_mode: (global.speakerMode || 'auto'),
        enable_lipsync: !!global.enableLipsync,
        // # block — معالجة صوت/استنساخ
        quality,
        ...(elevenLabsVoiceId ? { elevenlabs_voice_id: elevenLabsVoiceId } : {}),
      // # block — معالجة صوت/استنساخ
      };
    }
    // # guard — شرط رفض أو خروج مبكر
    if (mode === 'default' || (quality === 'fast' && !sample)) {
      // # return — إرجاع النتيجة
      return {
        voice_mode: 'default',
        // # block — معالجة صوت/استنساخ
        speaker_mode: (global.speakerMode || 'auto'),
        enable_lipsync: !!global.enableLipsync,
        quality,
        ...(elevenLabsVoiceId ? { elevenlabs_voice_id: elevenLabsVoiceId } : {}),
      };
    }
    return {
      // # block — معالجة صوت/استنساخ
      voice_mode: 'clone',
      clone_source: 'video',
      speaker_mode: (global.speakerMode || 'auto'),
      enable_lipsync: !!global.enableLipsync,
      quality,
    };
  }

  DubbingApp.voicePayload = {
    readSelectedVoiceModeFromDomElements,
    resolveSelectedVoiceSampleUrlFromDom,
    buildVoiceConfigPayloadForDubApiRequest,
    dubbingRequestNeedsVoiceCloneCreditCharge,
  };

  global.resolveVoiceDubPayload = buildVoiceConfigPayloadForDubApiRequest;
})(window);
