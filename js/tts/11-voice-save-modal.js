// # FILE frontend/sl-dubbing-frontend-main/js/tts/11-voice-save-modal.js
// # AR واجهة TTS
// # KW صوت,استنساخ,توليد_صوت,TTS,تنفيذ,local
// # CONVENTION — FN/AR/KW + # block كل ~6 أسطر — FUNCTION_INDEX.md DOMAIN_INDEX.md
// =====================================================================
// 📒 فهرس الدوال — js/tts/11-voice-save-modal.js
// ---------------------------------------------------------------------
//  عرض_نافذة_حفظ_الصوت      → showVoiceSaveNameModal
//  إخفاء_النافذة             → hideVoiceSaveNameModal
//  حفظ_النسخة_في_المكتبة     → confirmAndSaveVoiceCloneFromModal
// =====================================================================
(function (global) {
  const TtsApp = global.TtsApp;
  const S = TtsApp.state;
  const { normalizeTtsApiBaseUrl } = TtsApp.helpers;

  // # FN isSaveableSampleUrl
  // # AR الصوت والاستنساخ (isSaveableSampleUrl)
  // # KW صوت,استنساخ,voice,clone,sample,توليد_صوت,TTS,synthesis,تنفيذ,local,cloud,modal,parity
  function isSaveableSampleUrl(url) {
    const u = (url || '').trim();
    // # guard — شرط رفض أو خروج مبكر
    if (!u) return false;
    // # return — إرجاع النتيجة
    return (
      u.startsWith('http://') ||
      u.startsWith('https://') ||
      // # block — رفع أو تخزين ملف
      u.startsWith('r2://') ||
      u.startsWith('data:audio/')
    );
  }

  /** عرض_نافذة_حفظ_الصوت */
  // # FN showVoiceSaveNameModal
  // # KW صوت,استنساخ,voice,clone,sample,توليد_صوت,TTS,synthesis,تنفيذ,local,cloud,modal,parity
  function showVoiceSaveNameModal(sampleUrl, sampleText) {
    // # guard — شرط رفض أو خروج مبكر
    if (!isSaveableSampleUrl(sampleUrl)) return;
    S.pendingVoiceSampleUrl = sampleUrl.trim();
    S.pendingVoiceSampleText = (sampleText || '').trim();
    S.voiceSaveModalShownForUrl = S.pendingVoiceSampleUrl;
    global.currentSampleText = S.pendingVoiceSampleText;

    // # block — معالجة صوت/استنساخ
    const nameInput = document.getElementById('voiceCloneNameInput');
    // # شرط — فرع منطقي
    if (nameInput && !nameInput.value.trim()) {
      nameInput.value = 'My Voice — ' + new Date().toLocaleDateString('en-CA');
    }
    const modal = document.getElementById('voiceSaveModal');
    // # شرط — فرع منطقي
    if (modal) modal.style.display = 'flex';
  }

  // # FN hideVoiceSaveNameModal
  // # AR الصوت والاستنساخ (hideVoiceSaveNameModal)
  // # KW صوت,استنساخ,voice,clone,sample,توليد_صوت,TTS,synthesis,تنفيذ,local,cloud,modal,parity
  function hideVoiceSaveNameModal() {
    const modal = document.getElementById('voiceSaveModal');
    // # شرط — فرع منطقي
    if (modal) modal.style.display = 'none';
    S.pendingVoiceSampleUrl = '';
    S.pendingVoiceSampleText = '';
  }

  /** حفظ_النسخة_في_المكتبة — POST /api/user/voice-clones */
  // # FN confirmAndSaveVoiceCloneFromModal
  // # KW صوت,استنساخ,voice,clone,sample,توليد_صوت,TTS,synthesis,تنفيذ,local,cloud,modal,parity
  async function confirmAndSaveVoiceCloneFromModal() {
    const url = (S.pendingVoiceSampleUrl || global.currentSampleUrl || '').trim();
    const text = (S.pendingVoiceSampleText || '').trim();
    // # guard — شرط رفض أو خروج مبكر
    if (!url) {
      hideVoiceSaveNameModal();
      // # return — إرجاع النتيجة
      return;
    // # block — معالجة صوت/استنساخ
    }

    const headers =
      typeof global.refreshApiAuthHeadersFromSupabase === 'function'
        ? await global.refreshApiAuthHeadersFromSupabase()
        : typeof global.getApiAuthHeaders === 'function'
          ? global.getApiAuthHeaders()
          // # block — قاعدة بيانات
          : null;
    // # guard — شرط رفض أو خروج مبكر
    if (!headers) {
      global.showToast?.('Please sign in first', 'error');
      // # return — إرجاع النتيجة
      return;
    }

    const nameInput = document.getElementById('voiceCloneNameInput');
    // # block — معالجة صوت/استنساخ
    const name = (nameInput?.value || '').trim() || 'My Voice';
    const btn = document.getElementById('voiceSaveConfirmBtn');
    // # شرط — فرع منطقي
    if (btn) btn.disabled = true;

    // # try — معالجة عملية قد تفشل
    try {
      const API = normalizeTtsApiBaseUrl();
      // # HTTP — طلب إلى API
      const res = await fetch(`${API}/api/user/voice-clones`, {
        // # block — طلب HTTP/API
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        // # تسلسل JSON للطلب
        body: JSON.stringify({ sample_url: url, sample_text: text, name }),
      });
      // # parse — قراءة JSON من الاستجابة
      const data = await res.json().catch(() => ({}));
      // # شرط — فرع منطقي
      if (!res.ok || !data.success) {
        // # block — معالجة صوت/استنساخ
        const msg =
          typeof global.humanizeApiErrorMessage === 'function'
            ? global.humanizeApiErrorMessage(res, data, 'Could not save voice sample')
            : data.error || 'Could not save voice sample';
        // # raise — رفع خطأ للم caller
        throw new Error(msg);
      }

      // # block — معالجة صوت/استنساخ
      global.currentSampleUrl = url;
      global.currentSampleText = text;
      global.usingSavedVoice = true;
      global.voiceMode = 'clone';
      global.showToast?.('Voice sample saved to your library!', 'success');
      hideVoiceSaveNameModal();
      // # شرط — فرع منطقي
      if (nameInput) nameInput.value = '';
      S.voiceSaveModalShownForUrl = url;
    } catch (err) {
      global.showToast?.(err.message || 'Save failed', 'error');
    } finally {
      // # شرط — فرع منطقي
      if (btn) btn.disabled = false;
    // # block — معالجة صوت/استنساخ
    }
  }

  /** عينة مرفوعة محلياً ولم تُحفَظ بعد — لا تشمل أصوات الموقع أو مكتبة المستخدم */
  // # FN isNewUserUploadedSample
  // # AR الصوت والاستنساخ (isNewUserUploadedSample)
  // # KW صوت,استنساخ,voice,clone,sample,رفع,upload,R2,storage,توليد_صوت,TTS,synthesis,تنفيذ,local,cloud,modal,parity
  function isNewUserUploadedSample(sampleUrl, voiceId) {
    const url = (sampleUrl || '').trim();
    // # guard — شرط رفض أو خروج مبكر
    if (!url.startsWith('data:audio/')) return false;
    // # guard — شرط رفض أو خروج مبكر
    if (global.usingSavedVoice) return false;
    // # guard — شرط رفض أو خروج مبكر
    if (voiceId && voiceId !== 'custom_clone') return false;
    // # return — إرجاع النتيجة
    return true;
  }

  /** اقتراح_حفظ_العينة_بعد_نجاح_TTS */
  // # FN maybePromptVoiceSaveAfterTtsSuccess
  // # AR ربما prompt voice حفظ after tts success (maybePromptVoiceSaveAfterTtsSuccess)
  // # KW صوت,استنساخ,voice,clone,sample,توليد_صوت,TTS,synthesis,تنفيذ,local,cloud,modal,parity
  function maybePromptVoiceSaveAfterTtsSuccess(typedText) {
    const uploadedSampleUrl = (
      global.currentSampleUrl ||
      global.selectedSample ||
      ''
    ).trim();

    // # شرط — فرع منطقي
    if (
      !isNewUserUploadedSample(uploadedSampleUrl, S.selectedVoiceId) ||
      S.voiceSaveModalShownForUrl === uploadedSampleUrl
    ) {
      // # return — إرجاع النتيجة
      return;
    }

    // # block — معالجة صوت/استنساخ
    setTimeout(() => {
      showVoiceSaveNameModal(uploadedSampleUrl, typedText);
    }, 500);
  }

  TtsApp.voiceSave = {
    showVoiceSaveNameModal,
    hideVoiceSaveNameModal,
    confirmAndSaveVoiceCloneFromModal,
    maybePromptVoiceSaveAfterTtsSuccess,
  };

  global.showVoiceSaveModal = showVoiceSaveNameModal;
  global.dismissVoiceSaveModal = hideVoiceSaveNameModal;
  global.confirmSaveVoiceProfile = confirmAndSaveVoiceCloneFromModal;
})(window);
