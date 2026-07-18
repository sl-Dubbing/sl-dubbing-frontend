// # FILE frontend/sl-dubbing-frontend-main/js/dubbing/08-voice-save-modal.js
// # AR واجهة الدبلجة — رفع، Start، polling، أصوات
// # KW صوت,استنساخ,تنفيذ,local
// # CONVENTION — FN/AR/KW + # block كل ~6 أسطر — FUNCTION_INDEX.md DOMAIN_INDEX.md
// dubbing/08-voice-save-modal.js — Modal to name and save extracted voice clone
// FUNCTION_INDEX: // # FN + // # AR فوق الدالة | // # داخل الدالة لكل خطوة — see FUNCTION_INDEX.md §1.3 + §7
(function (global) {
  const DubbingApp = global.DubbingApp;
  const S = DubbingApp.state;
  const { normalizeApiBaseUrl, getDubbingApiAuthHeaders } = DubbingApp.api;

  // # نصوص نافذة بعد نجاح استنساخ المقطع
  const AFTER_CLONE_MODAL_COPY = {
    title: 'Save this cloned voice?',
    text: 'Cloning finished successfully. Do you want to save this voice to your library? Enter a name and tap Save. Next time you pick this sample, dubbing will be faster.',
    confirm: 'Save to my library',
  };
  // # نصوص نافذة intent — حفظ بعد نجاح الاستنساخ
  const INTENT_MODAL_COPY = {
    title: 'Save Voice Sample?',
    text: 'Do you want to save this voice sample to your library? Enter a name and tap Save sample. It will appear in your voices automatically only if cloning completes successfully.',
    confirm: 'Save sample',
  };
  // # نصوص نافذة immediate — حفظ فوري عند وجود URL جاهز (Save+)
  const IMMEDIATE_MODAL_COPY = {
    title: 'Save Voice Sample',
    text: 'Enter a name for this sample.',
    confirm: 'Save to my library',
  };

  // # FN isSampleUrlInVoiceLibrary
  // # KW صوت,استنساخ,voice,clone,sample,تنفيذ,local,cloud,modal,parity
  function isSampleUrlInVoiceLibrary(sampleUrl) {
    // # تطبيع الرابط — trim ورفض القيم الفارغة
    const url = (sampleUrl || '').trim();
    // # guard — شرط رفض أو خروج مبكر
    if (!url) return false;
    // # جلب caches الأصوات من state (Premium + clones المستخدم)
    const premium = Array.isArray(S.premiumVoicesCache) ? S.premiumVoicesCache : [];
    const clones = Array.isArray(S.userVoiceClonesCache) ? S.userVoiceClonesCache : [];
    // # مطابقة URL مع Premium أو clones أو savedVoiceProfile
    return (
      // # block — معالجة صوت/استنساخ
      premium.some((v) => (((v && v.sample_url) || '')).trim() === url) ||
      clones.some((v) => (((v && v.sample_url) || '')).trim() === url) ||
      (global.savedVoiceProfile && (global.savedVoiceProfile.sample_url || '').trim() === url)
    );
  }

  // # FN shouldAutoOfferVoiceSave
  // # AR الصوت والاستنساخ (shouldAutoOfferVoiceSave)
  // # KW صوت,استنساخ,voice,clone,sample,تنفيذ,local,cloud,modal,parity
  function shouldAutoOfferVoiceSave() {
    // # يجب وجود footprint مستخرج (vocals URL)
    const footprint = (global.lastExtractedVocalsUrl || S.pendingVoiceSampleUrl || '').trim();
    // # guard — شرط رفض أو خروج مبكر
    if (!footprint) return false;
    // # فقط في وضع clone — لا default ولا saved
    if (global.voiceMode !== 'clone') return false;
    // # guard — شرط رفض أو خروج مبكر
    if (global.usingSavedVoice === true) return false;
    // # لا نعرض إن كان الصوت المختار من المكتبة أصلاً
    if (isSampleUrlInVoiceLibrary(global.selectedSample)) return false;
    // # return — إرجاع النتيجة
    return true;
  }

  // # FN shouldOfferVoiceSaveIntent
  // # KW صوت,استنساخ,voice,clone,sample,تنفيذ,local,cloud,modal,parity
  function shouldOfferVoiceSaveIntent() {
    // # شرط أساسي: فيديو/صوت مرفوع على الصفحة
    if (!S.selectedMediaFile) return false;
    // # guard — شرط رفض أو خروج مبكر
    if (global.usingSavedVoice === true) return false;
    // # guard — شرط رفض أو خروج مبكر
    if (global.voiceMode === 'default') return false;
    // # guard — شرط رفض أو خروج مبكر
    if (isSampleUrlInVoiceLibrary(global.selectedSample)) return false;

    // # مسار تسجيل Mic: عينة على R2 ولم تُحفظ بعد في المكتبة
    const recordedUrl = (S.pendingRecordedSampleUrl || '').trim();
    // # guard — شرط رفض أو خروج مبكر
    if (recordedUrl && global.selectedCloneSource === 'upload') {
      // # return — إرجاع النتيجة
      return !isSampleUrlInVoiceLibrary(recordedUrl);
    }

    // # مسار استنساخ من الفيديو: clone بدون sample_url محدد + رسوم +100
    const mode = (global.voiceMode || DubbingApp.voicePayload?.readSelectedVoiceModeFromDomElements?.() || '')
      .toLowerCase()
      .trim();
    // # guard — شرط رفض أو خروج مبكر
    if (mode !== 'clone') return false;
    // # guard — شرط رفض أو خروج مبكر
    if ((global.selectedSample || '').trim()) return false;
    return DubbingApp.voicePayload?.dubbingRequestNeedsVoiceCloneCreditCharge?.() === true;
  }

  // # FN setVoiceSaveModalCopy
  // # AR الصوت والاستنساخ (setVoiceSaveModalCopy)
  // # KW صوت,استنساخ,voice,clone,sample,تنفيذ,local,cloud,modal,parity
  function setVoiceSaveModalCopy(mode) {
    // # اختيار مجموعة النصوص حسب الوضع
    let copy = IMMEDIATE_MODAL_COPY;
    // # شرط
    if (mode === 'intent') copy = INTENT_MODAL_COPY;
    else if (mode === 'after_clone') copy = AFTER_CLONE_MODAL_COPY;
    const titleEl = document.getElementById('voiceSaveModalTitle');
    const textEl = document.getElementById('voiceSaveModalText');
    // # block — معالجة صوت/استنساخ
    const confirmBtn = document.getElementById('voiceSaveConfirmBtn');
    // # تطبيق النصوص على عناصر DOM
    if (titleEl) titleEl.textContent = copy.title;
    // # شرط — فرع منطقي
    if (textEl) textEl.textContent = copy.text;
    // # شرط — فرع منطقي
    if (confirmBtn) confirmBtn.textContent = copy.confirm;
  }

  // # FN shouldOfferVoiceSaveAfterCloneSuccess
  // # AR بعد نجاح استنساخ المقطع — اعرض الحفظ إن كانت العينة جديدة
  // # KW صوت,استنساخ,voice,clone,sample,تنفيذ,local,cloud,modal,parity
  function shouldOfferVoiceSaveAfterCloneSuccess(sampleUrl) {
    const url = (sampleUrl || '').trim();
    // # guard — رفض/خروج
    if (!url) return false;
    // # guard — رفض/خروج
    if (global.usingSavedVoice === true) return false;
    // # guard — رفض/خروج
    if (isSampleUrlInVoiceLibrary(url)) return false;
    // # clone من مكتبة/premium محفوظة — لا تسأل عن الحفظ مجدداً
    const src = (global.selectedCloneSource || '').toLowerCase();
    // # guard — رفض/خروج
    if (src === 'library' || src === 'premium') return false;
    return true;
  }

  // # FN offerVoiceSaveAfterCloneSuccess
  // # KW صوت,استنساخ,voice,clone,sample,تنفيذ,local,cloud,modal,parity
  function offerVoiceSaveAfterCloneSuccess(sampleUrl, sampleText) {
    const url = (sampleUrl || '').trim();
    // # guard — رفض/خروج
    if (!shouldOfferVoiceSaveAfterCloneSuccess(url)) return false;
    // # guard — رفض/خروج
    if (S.voiceSaveModalShownForUrl === url) return false;

    // # immediate — الاستنساخ اكتمل؛ احفظ الآن (وليس intent مؤجلاً)
    S.voiceSaveModalMode = 'immediate';
    setVoiceSaveModalCopy('after_clone');
    // # block — معالجة صوت/استنساخ
    DubbingApp.voice?.setExtractedVocalsUrlForVoiceSave(url);
    S.pendingVoiceSampleUrl = url;
    S.pendingVoiceSampleText = sampleText || '';
    S.voiceSaveModalShownForUrl = url;
    S.voiceSaveIntentActive = false;
    S.voiceSaveIntentName = '';

    // # block — معالجة صوت/استنساخ
    const nameInput = document.getElementById('voiceCloneNameInput');
    // # شرط
    if (nameInput && !nameInput.value.trim()) {
      nameInput.value = `My Voice ${new Date().toLocaleDateString('en-US')}`;
    }
    const modal = document.getElementById('voiceSaveModal');
    // # guard — رفض/خروج
    if (modal) modal.style.display = 'flex';
    // # block — معالجة صوت/استنساخ
    return true;
  }

  // # FN onMediaFileSelectedForVoiceSave
  // # AR الصوت والاستنساخ (onMediaFileSelectedForVoiceSave)
  // # KW صوت,استنساخ,voice,clone,sample,تنفيذ,local,cloud,modal,parity
  function onMediaFileSelectedForVoiceSave() {
    // # تصفير flags الحفظ المؤجل من جلسة سابقة
    S.voiceSaveIntentActive = false;
    S.voiceSaveIntentName = '';
    S.voiceSaveIntentFulfilled = false;
    S.voiceSaveIntentModalOffered = false;
    S.voiceSaveModalMode = 'immediate';
    // # block — معالجة صوت/استنساخ
    S.voiceSaveModalShownForUrl = '';
  }

  // # FN resetVoiceSaveIntentForNewJob
  // # AR الصوت والاستنساخ (resetVoiceSaveIntentForNewJob)
  // # KW صوت,استنساخ,voice,clone,sample,مهمة,job,polling,celery,worker,تنفيذ,local,cloud,modal,parity
  function resetVoiceSaveIntentForNewJob() {
    onMediaFileSelectedForVoiceSave();
    S.pendingRecordedSampleUrl = '';
  }

  // # FN clearVoiceSaveIntent
  // # AR الصوت والاستنساخ (clearVoiceSaveIntent)
  // # KW صوت,استنساخ,voice,clone,sample,تنفيذ,local,cloud,modal,parity
  function clearVoiceSaveIntent() {
    S.voiceSaveIntentActive = false;
    S.voiceSaveIntentName = '';
  }

  // # FN openVoiceSaveIntentModal
  // # KW صوت,استنساخ,voice,clone,sample,تنفيذ,local,cloud,modal,parity
  function openVoiceSaveIntentModal(forceOffer) {
    // # guards: شروط العرض + عدم تكرار + عدم فتح إن intent مفعّل
    if (!shouldOfferVoiceSaveIntent()) return;
    // # guard — شرط رفض أو خروج مبكر
    if (S.voiceSaveIntentActive) return;
    // # guard — شرط رفض أو خروج مبكر
    if (!forceOffer && S.voiceSaveIntentModalOffered) return;

    // # تفعيل وضع intent وتحديث نصوص النافذة
    S.voiceSaveIntentModalOffered = true;
    S.voiceSaveModalMode = 'intent';
    // # block — معالجة صوت/استنساخ
    setVoiceSaveModalCopy('intent');
    // # اسم افتراضي إن كان الحقل فارغاً
    const nameInput = document.getElementById('voiceCloneNameInput');
    // # شرط — فرع منطقي
    if (nameInput && !nameInput.value.trim()) {
      nameInput.value = `My Voice ${new Date().toLocaleDateString('en-US')}`;
    }
    // # إظهار النافذة
    const modal = document.getElementById('voiceSaveModal');
    // # شرط — فرع منطقي
    if (modal) modal.style.display = 'flex';
  }

  // # FN maybeOfferVoiceSaveIntentModal
  // # AR الصوت والاستنساخ (maybeOfferVoiceSaveIntentModal)
  // # KW صوت,استنساخ,voice,clone,sample,تنفيذ,local,cloud,modal,parity
  function maybeOfferVoiceSaveIntentModal(opts = {}) {
    // # تمرير force لتجاوز guard «عرض مرة واحدة» (مثلاً بعد Mic)
    openVoiceSaveIntentModal(!!opts.force);
  }

  // # FN onVoiceCloneModeSelectedAfterMediaUpload
  // # KW صوت,استنساخ,voice,clone,sample,رفع,upload,R2,storage,تنفيذ,local,cloud,modal,parity
  function onVoiceCloneModeSelectedAfterMediaUpload() {
    /* modal shown after clone completes — see offerVoiceSaveAfterCloneSuccess */
  }

  // # FN onRecordedSampleUploadedToStorage
  // # AR الصوت والاستنساخ (onRecordedSampleUploadedToStorage)
  // # KW صوت,استنساخ,voice,clone,sample,رفع,upload,R2,storage,تنفيذ,local,cloud,modal,parity
  function onRecordedSampleUploadedToStorage(sampleUrl) {
    // # رفض URL فارغ
    const url = (sampleUrl || '').trim();
    // # guard — شرط رفض أو خروج مبكر
    if (!url) return;
    // # حفظ URL المعلق حتى نجاح الدبلجة — النافذة تظهر بعد اكتمال النسخ
    S.pendingRecordedSampleUrl = url;
  }

  // # FN onVoiceSelectionChanged
  // # AR الصوت والاستنساخ (onVoiceSelectionChanged)
  // # KW صوت,استنساخ,voice,clone,sample,تنفيذ,local,cloud,modal,parity
  function onVoiceSelectionChanged(mode, sampleUrl) {
    // # صوت جاهز/محفوظ/default — لا حفظ intent
    if (mode === 'default' || global.usingSavedVoice || isSampleUrlInVoiceLibrary(sampleUrl)) {
      clearVoiceSaveIntent();
      // # return — إرجاع النتيجة
      return;
    }
    // # Voice Clone من فيديو بدون sample — النافذة بعد نجاح الدبلجة
    if (mode === 'clone' && !(sampleUrl || '').trim()) {
      // # block — معالجة صوت/استنساخ
      clearVoiceSaveIntent();
    }
  }

  // # FN showVoiceSaveNameModal
  // # KW صوت,استنساخ,voice,clone,sample,تنفيذ,local,cloud,modal,parity
  function showVoiceSaveNameModal(sampleUrl, sampleText) {
    // # guard — شرط رفض أو خروج مبكر
    if (!sampleUrl) return;
    // # وضع immediate + نصوص النافذة
    S.voiceSaveModalMode = 'immediate';
    setVoiceSaveModalCopy('immediate');
    // # تخزين URL في state/global للحفظ الفوري
    DubbingApp.voice?.setExtractedVocalsUrlForVoiceSave(sampleUrl);
    S.pendingVoiceSampleUrl = sampleUrl;
    // # block — معالجة صوت/استنساخ
    S.pendingVoiceSampleText = sampleText || '';
    S.voiceSaveModalShownForUrl = sampleUrl;

    const nameInput = document.getElementById('voiceCloneNameInput');
    // # شرط — فرع منطقي
    if (nameInput && !nameInput.value.trim()) {
      nameInput.value = `My Voice ${new Date().toLocaleDateString('en-US')}`;
    }
    // # block — معالجة صوت/استنساخ
    const modal = document.getElementById('voiceSaveModal');
    // # شرط — فرع منطقي
    if (modal) modal.style.display = 'flex';
  }

  // # FN maybeShowVoiceSaveModalOnce
  // # AR الصوت والاستنساخ (maybeShowVoiceSaveModalOnce)
  // # KW صوت,استنساخ,voice,clone,sample,تنفيذ,local,cloud,modal,parity
  function maybeShowVoiceSaveModalOnce(sampleUrl, sampleText) {
    const clean = (sampleUrl || '').trim();
    // # منع التكرار لنفس URL
    if (!clean || S.voiceSaveModalShownForUrl === clean) return;
    // # guard — شرط رفض أو خروج مبكر
    if (!shouldAutoOfferVoiceSave()) return;
    showVoiceSaveNameModal(clean, sampleText);
  }

  // # FN hideVoiceSaveNameModal
  // # AR الصوت والاستنساخ (hideVoiceSaveNameModal)
  // # KW صوت,استنساخ,voice,clone,sample,تنفيذ,local,cloud,modal,parity
  function hideVoiceSaveNameModal() {
    const modal = document.getElementById('voiceSaveModal');
    // # شرط — فرع منطقي
    if (modal) modal.style.display = 'none';
    // # شرط — فرع منطقي
    if (S.voiceSaveModalMode === 'intent') {
      clearVoiceSaveIntent();
    } else {
      // # block — معالجة صوت/استنساخ
      S.pendingVoiceSampleUrl = '';
      S.pendingVoiceSampleText = '';
    }
  }

  // # FN persistVoiceCloneToLibrary
  // # KW صوت,استنساخ,voice,clone,sample,تنفيذ,local,cloud,modal,parity
  async function persistVoiceCloneToLibrary(url, text, name) {
    // # حد أقصى 10 clones
    if (S.userVoiceClonesCache && S.userVoiceClonesCache.length >= 10) {
      // # raise — رفع خطأ للم caller
      throw new Error('Maximum limit reached (10 Voice Clones). Delete one from My Files first.');
    }
    // # JWT مطلوب
    const headers = getDubbingApiAuthHeaders();
    // # guard — شرط رفض أو خروج مبكر
    if (!headers) throw new Error('Please sign in first');

    // # POST — حفظ في DB + R2 URL
    const res = await fetch(`${normalizeApiBaseUrl()}/api/user/voice-clones`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      // # تسلسل JSON للطلب
      body: JSON.stringify({ sample_url: url, sample_text: text, name }),
    });
    // # parse — قراءة JSON من الاستجابة
    const data = await res.json().catch(() => ({}));
    // # guard — شرط رفض أو خروج مبكر
    if (!res.ok || !data.success) throw new Error(data.error || 'Could not save voice clone');

    // # دمج clone الجديد في cache (أحدث أولاً)
    if (data.clone && S.userVoiceClonesCache) {
      S.userVoiceClonesCache = [
        data.clone,
        ...S.userVoiceClonesCache.filter((c) => c.id !== data.clone.id),
      ];
    // # block — معالجة صوت/استنساخ
    }
    // # مزامنة اختيار الصوت الحالي مع المكتبة
    global.selectedSample = url;
    global.selectedSampleText = text;
    global.usingSavedVoice = false;
    global.voiceMode = 'clone';
    global.selectedCloneSource = 'library';
    // # block — معالجة صوت/استنساخ
    S.pendingRecordedSampleUrl = '';

    // # إعادة رسم بطاقات الأصوات — تظهر العينة بين العينات
    if (DubbingApp.voiceHtml?.refreshVoiceSavePlusCardInGrid) {
      DubbingApp.voiceHtml.refreshVoiceSavePlusCardInGrid();
    }
    // # return — إرجاع النتيجة
    return data;
  }

  // # FN confirmAndSaveVoiceCloneFromModal
  // # KW صوت,استنساخ,voice,clone,sample,تنفيذ,local,cloud,modal,parity
  async function confirmAndSaveVoiceCloneFromModal() {
    const btn = document.getElementById('voiceSaveConfirmBtn');
    const nameInput = document.getElementById('voiceCloneNameInput');
    const name = (nameInput?.value || '').trim() || 'My Voice';

    // # مسار intent — تسجيل الاسم فقط، الحفظ لاحقاً عند نجاح الدبلجة
    if (S.voiceSaveModalMode === 'intent') {
      S.voiceSaveIntentActive = true;
      // # block — معالجة صوت/استنساخ
      S.voiceSaveIntentName = name;
      const modal = document.getElementById('voiceSaveModal');
      // # شرط — فرع منطقي
      if (modal) modal.style.display = 'none';
      global.showToast?.(
        'Your sample will be saved automatically when voice cloning completes successfully.',
        'success',
      // # block — معالجة صوت/استنساخ
      );
      // # return — إرجاع النتيجة
      return;
    }

    // # مسار immediate — URL جاهز، حفظ الآن
    const url = (S.pendingVoiceSampleUrl || global.lastExtractedVocalsUrl || '').trim();
    const text = (S.pendingVoiceSampleText || global.lastExtractedVocalsText || '').trim();

    // # guard — شرط رفض أو خروج مبكر
    if (!url) {
      // # block — معالجة صوت/استنساخ
      hideVoiceSaveNameModal();
      // # return — إرجاع النتيجة
      return;
    }
    // # شرط — فرع منطقي
    if (btn) btn.disabled = true;

    // # try — معالجة عملية قد تفشل
    try {
      await persistVoiceCloneToLibrary(url, text, name);
      // # block — معالجة صوت/استنساخ
      global.showToast?.(
        'Voice sample saved! Next time you pick it, dubbing will skip re-cloning.',
        'success',
      );
      hideVoiceSaveNameModal();
      // # شرط — فرع منطقي
      if (nameInput) nameInput.value = '';
      // # block — معالجة صوت/استنساخ
      S.voiceSaveModalShownForUrl = '';
    } catch (err) {
      global.showToast?.(err.message || 'Save failed', 'error');
    // # block — معالجة صوت/استنساخ
    } finally {
      // # شرط — فرع منطقي
      if (btn) btn.disabled = false;
    }
  }

  // # FN tryFulfillVoiceSaveIntent
  // # KW صوت,استنساخ,voice,clone,sample,تنفيذ,local,cloud,modal,parity
  async function tryFulfillVoiceSaveIntent(sampleUrl, sampleText) {
    // # لا حفظ بدون intent أو إن حُفظ مسبقاً
    if (!S.voiceSaveIntentActive || S.voiceSaveIntentFulfilled) return false;

    // # أولوية مصادر URL: job → Mic → selected → extracted
    const url = (
      sampleUrl ||
      S.pendingRecordedSampleUrl ||
      global.selectedSample ||
      // # block — معالجة صوت/استنساخ
      global.lastExtractedVocalsUrl ||
      S.pendingVoiceSampleUrl ||
      ''
    ).trim();
    const text = (sampleText || S.pendingVoiceSampleText || global.lastExtractedVocalsText || '').trim();
    // # guard — شرط رفض أو خروج مبكر
    if (!url) return false;

    // # block — معالجة صوت/استنساخ
    const name = (S.voiceSaveIntentName || '').trim() || 'My Voice';
    // # try — معالجة عملية قد تفشل
    try {
      await persistVoiceCloneToLibrary(url, text, name);
      // # علامة منع حفظ مكرر + تنظيف intent
      S.voiceSaveIntentFulfilled = true;
      clearVoiceSaveIntent();
      global.showToast?.('Voice sample saved to your library!', 'success');
      // # block — معالجة صوت/استنساخ
      const nameInput = document.getElementById('voiceCloneNameInput');
      // # guard — شرط رفض أو خروج مبكر
      if (nameInput) nameInput.value = '';
      // # return — إرجاع النتيجة
      return true;
    } catch (err) {
      global.showToast?.(err.message || 'Could not save voice sample', 'error');
      return false;
    // # block — معالجة صوت/استنساخ
    }
  }

  // # FN notifyVoiceSaveIntentSkippedAfterFailedClone
  // # AR toast عند فشل الاستنساخ — لا تُحفظ العينة رغم intent
  // # KW صوت,استنساخ,voice,clone,sample,تنفيذ,local,cloud,modal,parity
  function notifyVoiceSaveIntentSkippedAfterFailedClone() {
    // # intent موجود ولم يُنفَّذ بعد
    if (!S.voiceSaveIntentActive || S.voiceSaveIntentFulfilled) return;
    global.showToast?.(
      'Voice sample was not saved because voice cloning did not complete successfully.',
      'info',
    );
    // # block — معالجة صوت/استنساخ
    clearVoiceSaveIntent();
  }

  DubbingApp.voiceSave = {
    showVoiceSaveNameModal,
    maybeOfferVoiceSaveIntentModal,
    onMediaFileSelectedForVoiceSave,
    onVoiceCloneModeSelectedAfterMediaUpload,
    onRecordedSampleUploadedToStorage,
    onVoiceSelectionChanged,
    maybeShowVoiceSaveModalOnce,
    hideVoiceSaveNameModal,
    confirmAndSaveVoiceCloneFromModal,
    shouldAutoOfferVoiceSave,
    shouldOfferVoiceSaveIntent,
    shouldOfferVoiceSaveAfterCloneSuccess,
    offerVoiceSaveAfterCloneSuccess,
    resetVoiceSaveIntentForNewJob,
    clearVoiceSaveIntent,
    tryFulfillVoiceSaveIntent,
    notifyVoiceSaveIntentSkippedAfterFailedClone,
  };

  global.showVoiceSaveModal = showVoiceSaveNameModal;
  global.dismissVoiceSaveModal = hideVoiceSaveNameModal;
  global.confirmSaveVoiceProfile = confirmAndSaveVoiceCloneFromModal;
})(window);
