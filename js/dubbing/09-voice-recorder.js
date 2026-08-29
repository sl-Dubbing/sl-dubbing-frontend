// # FILE frontend/sl-dubbing-frontend-main/js/dubbing/09-voice-recorder.js
// # AR واجهة الدبلجة — رفع، Start، polling، أصوات
// # KW صوت,استنساخ
// # CONVENTION — FN/AR/KW + # block كل ~6 أسطر — FUNCTION_INDEX.md DOMAIN_INDEX.md
// dubbing/09-voice-recorder.js — Microphone voice sample recorder modal
(function (global) {
  const DubbingApp = global.DubbingApp;
  const S = DubbingApp.state;
  const { normalizeApiBaseUrl, getDubbingApiAuthHeaders } = DubbingApp.api;

  // # FN releaseVoiceRecorderResources
  // # AR الصوت والاستنساخ (releaseVoiceRecorderResources)
  // # KW صوت,استنساخ,voice,clone,sample
  function releaseVoiceRecorderResources() {
    // # شرط — فرع منطقي
    if (S.voiceRecorder && S.voiceRecorder.state !== 'inactive') {
      try { S.voiceRecorder.stop(); } catch (e) { /* ignore */ }
    }
    // # شرط — فرع منطقي
    if (S.voiceRecorder) {
      try { S.voiceRecorder.stream.getTracks().forEach((t) => t.stop()); } catch (e) { /* ignore */ }
    // # block — معالجة صوت/استنساخ
    }
    S.voiceRecorder = null;
    S.voiceRecordChunks = [];
    // # شرط — فرع منطقي
    if (S.voiceRecordTimer) {
      clearInterval(S.voiceRecordTimer);
      S.voiceRecordTimer = null;
    // # block — معالجة صوت/استنساخ
    }
    // # شرط — فرع منطقي
    if (S.voiceRecordObjectUrl) {
      URL.revokeObjectURL(S.voiceRecordObjectUrl);
      S.voiceRecordObjectUrl = null;
    }
    S.voiceRecordBlob = null;
  }

  // # FN openMicrophoneVoiceRecordModal
  // # KW صوت,استنساخ,voice,clone,sample,تنفيذ,local,cloud,modal,parity
  function openMicrophoneVoiceRecordModal() {
    releaseVoiceRecorderResources();
    // # شرط — فرع منطقي
    if (S.userVoiceClonesCache.length >= 10) {
      global.showToast?.(
        'You have reached the maximum of 10 voice clones. Please delete an older one from My Files.',
        'error',
      // # block — معالجة صوت/استنساخ
      );
      // # return — إرجاع النتيجة
      return;
    }
    document.getElementById('voiceRecordModal')?.remove();
    // # شرط — فرع منطقي
    if (!document.getElementById('recPulseStyle')) {
      const s = document.createElement('style');
      // # block — معالجة صوت/استنساخ
      s.id = 'recPulseStyle';
      s.textContent =
        '@keyframes recPulseAnim{0%,100%{transform:scale(1);box-shadow:0 0 0 0 rgba(239,68,68,.4)}50%{transform:scale(1.08);box-shadow:0 0 0 18px rgba(239,68,68,0)}}';
      document.head.appendChild(s);
    }
    const overlay = document.createElement('div');
    // # block — معالجة صوت/استنساخ
    overlay.id = 'voiceRecordModal';
    overlay.style.cssText =
      'position:fixed;inset:0;z-index:10000;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.45);padding:20px;';
    const card = document.createElement('div');
    card.style.cssText =
      'background:#fff;border-radius:16px;padding:32px;max-width:440px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,0.2);';
    // # block — تحديث واجهة/DOM
    card.innerHTML = `
        <h3 style="margin:0 0 4px;font-size:1.15rem;color:#111827;">Record Voice Sample</h3>
        <p style="margin:0 0 20px;color:#6b7280;font-size:0.9rem;">Record up to 10 seconds using your microphone.</p>
        <div id="recIdleState" style="text-align:center;padding:20px 0;">
            <button id="startRecBtn" style="padding:12px 28px;border-radius:12px;border:none;background:#ef4444;color:#fff;font-weight:600;cursor:pointer;">Start Recording</button>
        </div>
        <div id="recActiveState" style="display:none;text-align:center;padding:20px 0;">
            <div id="recCountdown" style="font-size:2.5rem;font-weight:700;">10</div>
            <button id="stopRecBtn">Stop Early</button>
        </div>
        <div id="recPreviewState" style="display:none;">
            <audio id="recPreviewAudio" controls style="width:100%;"></audio>
            <input type="text" id="recVoiceName" placeholder="e.g. My voice" maxlength="120" style="width:100%;margin:12px 0;">
            <button id="reRecBtn">Re-record</button>
            <button id="saveRecBtn">Upload Sample</button>
        </div>
        <button id="recCancelBtn" style="margin-top:16px;">Cancel</button>`;
    overlay.appendChild(card);
    // # block — معالجة صوت/استنساخ
    overlay.addEventListener('click', (e) => {
      // # شرط — فرع منطقي
      if (e.target === overlay) closeMicrophoneVoiceRecordModal();
    });
    card.querySelector('#startRecBtn').onclick = startMicrophoneVoiceCapture;
    card.querySelector('#stopRecBtn').onclick = stopMicrophoneVoiceCapture;
    card.querySelector('#reRecBtn').onclick = resetMicrophoneRecorderToIdleUi;
    // # block — معالجة صوت/استنساخ
    card.querySelector('#saveRecBtn').onclick = uploadRecordedVoiceBlobAndSaveClone;
    card.querySelector('#recCancelBtn').onclick = closeMicrophoneVoiceRecordModal;
    document.body.appendChild(overlay);
  }

  // # FN closeMicrophoneVoiceRecordModal
  // # AR الصوت والاستنساخ (closeMicrophoneVoiceRecordModal)
  // # KW صوت,استنساخ,voice,clone,sample,تنفيذ,local,cloud,modal,parity
  function closeMicrophoneVoiceRecordModal() {
    releaseVoiceRecorderResources();
    document.getElementById('voiceRecordModal')?.remove();
  }

  // # FN startMicrophoneVoiceCapture
  // # KW صوت,استنساخ,voice,clone,sample
  async function startMicrophoneVoiceCapture() {
    let stream;
    // # try — معالجة عملية قد تفشل
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      global.showToast?.('Microphone access denied or not available', 'error');
      // # return — إرجاع النتيجة
      return;
    }
    S.voiceRecordChunks = [];
    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : MediaRecorder.isTypeSupported('audio/webm')
        // # block — معالجة صوت/استنساخ
        ? 'audio/webm'
        : '';
    S.voiceRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    S.voiceRecorder.ondataavailable = (e) => {
      // # شرط — فرع منطقي
      if (e.data.size > 0) S.voiceRecordChunks.push(e.data);
    };
    // # block — معالجة صوت/استنساخ
    S.voiceRecorder.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      const type = (S.voiceRecorder && S.voiceRecorder.mimeType) || 'audio/webm';
      S.voiceRecordBlob = new Blob(S.voiceRecordChunks, { type });
      // # شرط — فرع منطقي
      if (S.voiceRecordObjectUrl) URL.revokeObjectURL(S.voiceRecordObjectUrl);
      S.voiceRecordObjectUrl = URL.createObjectURL(S.voiceRecordBlob);
      // # block — معالجة صوت/استنساخ
      showMicrophoneRecordingPreviewUi();
    };
    S.voiceRecorder.start(250);
    document.getElementById('recIdleState').style.display = 'none';
    document.getElementById('recActiveState').style.display = 'block';
    document.getElementById('recPreviewState').style.display = 'none';
    // # block — معالجة صوت/استنساخ
    let remaining = 10;
    const countdownEl = document.getElementById('recCountdown');
    // # شرط — فرع منطقي
    if (countdownEl) countdownEl.textContent = remaining;
    S.voiceRecordTimer = setInterval(() => {
      remaining--;
      // # شرط — فرع منطقي
      if (countdownEl) countdownEl.textContent = remaining;
      // # شرط — فرع منطقي
      if (remaining <= 0) {
        clearInterval(S.voiceRecordTimer);
        S.voiceRecordTimer = null;
        stopMicrophoneVoiceCapture();
      }
    }, 1000);
  }

  // # FN stopMicrophoneVoiceCapture
  // # KW صوت,استنساخ,voice,clone,sample
  function stopMicrophoneVoiceCapture() {
    // # شرط — فرع منطقي
    if (S.voiceRecordTimer) {
      clearInterval(S.voiceRecordTimer);
      S.voiceRecordTimer = null;
    }
    // # شرط — فرع منطقي
    if (S.voiceRecorder && S.voiceRecorder.state !== 'inactive') S.voiceRecorder.stop();
  }

  // # FN showMicrophoneRecordingPreviewUi
  // # AR الصوت والاستنساخ (showMicrophoneRecordingPreviewUi)
  // # KW صوت,استنساخ,voice,clone,sample
  function showMicrophoneRecordingPreviewUi() {
    document.getElementById('recIdleState').style.display = 'none';
    document.getElementById('recActiveState').style.display = 'none';
    document.getElementById('recPreviewState').style.display = 'block';
    const audio = document.getElementById('recPreviewAudio');
    // # شرط — فرع منطقي
    if (audio && S.voiceRecordObjectUrl) audio.src = S.voiceRecordObjectUrl;
  }

  // # FN resetMicrophoneRecorderToIdleUi
  // # AR الصوت والاستنساخ (resetMicrophoneRecorderToIdleUi)
  // # KW صوت,استنساخ,voice,clone,sample
  function resetMicrophoneRecorderToIdleUi() {
    releaseVoiceRecorderResources();
    document.getElementById('recIdleState').style.display = 'block';
    document.getElementById('recActiveState').style.display = 'none';
    document.getElementById('recPreviewState').style.display = 'none';
  }

  // # FN uploadRecordedVoiceBlobAndSaveClone
  // # AR رفع recorded voice blob and حفظ clone (uploadRecordedVoiceBlobAndSaveClone)
  // # KW صوت,استنساخ,voice,clone,sample,رفع,upload,R2,storage
  async function uploadRecordedVoiceBlobAndSaveClone() {
    // # guard — شرط رفض أو خروج مبكر
    if (!S.voiceRecordBlob) {
      global.showToast?.('No recording to save', 'error');
      // # return — إرجاع النتيجة
      return;
    }
    // # guard — شرط رفض أو خروج مبكر
    if (!S.selectedMediaFile) {
      // # block — معالجة صوت/استنساخ
      global.showToast?.('Upload your video or audio first, then record a voice sample.', 'error');
      // # return — إرجاع النتيجة
      return;
    }
    // # guard — شرط رفض أو خروج مبكر
    if (S.userVoiceClonesCache.length >= 10) {
      global.showToast?.('Maximum limit reached (10 Voice Clones).', 'error');
      // # return — إرجاع النتيجة
      return;
    // # block — معالجة صوت/استنساخ
    }
    const authHeaders = getDubbingApiAuthHeaders();
    // # guard — شرط رفض أو خروج مبكر
    if (!authHeaders) {
      global.showToast?.('Please sign in first', 'error');
      // # return — إرجاع النتيجة
      return;
    }
    // # block — تحديث واجهة/DOM
    const saveBtn = document.getElementById('saveRecBtn');
    // # شرط — فرع منطقي
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.textContent = 'Uploading…';
    }
    // # try — معالجة عملية قد تفشل
    try {
      // # block — معالجة صوت/استنساخ
      const ext = (S.voiceRecordBlob.type || '').includes('webm') ? 'webm' : 'wav';
      const filename = `voice-recording-${Date.now()}.${ext}`;
      const contentType = S.voiceRecordBlob.type || 'audio/webm';
      // # HTTP — طلب إلى API
      const urlRes = await fetch(`${normalizeApiBaseUrl()}/api/upload-url`, {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        // # تسلسل JSON للطلب
        body: JSON.stringify({ filename, content_type: contentType }),
      });
      // # guard — شرط رفض أو خروج مبكر
      if (!urlRes.ok) {
        // # parse — قراءة JSON من الاستجابة
        const errData = await urlRes.json().catch(() => ({}));
        // # raise — رفع خطأ للم caller
        throw new Error(errData.error || 'Failed to get upload URL');
      }
      // # parse — قراءة JSON من الاستجابة
      const urlData = await urlRes.json();
      await DubbingApp.upload.uploadMediaFileFromUploadUrlResponse(
        urlData,
        S.voiceRecordBlob,
        authHeaders,
      );
      // # block — معالجة صوت/استنساخ
      const sampleUrl = DubbingApp.api.resolveSampleUrlFromUploadApiResponse(urlData);
      // # guard — شرط رفض أو خروج مبكر
      if (!sampleUrl) {
        // # raise — رفع خطأ للم caller
        throw new Error('Upload succeeded but no playable sample URL was returned');
      }
      global.selectedSample = sampleUrl;
      global.selectedSampleText = '';
      // # block — معالجة صوت/استنساخ
      global.usingSavedVoice = false;
      global.voiceMode = 'clone';
      global.selectedCloneSource = 'upload';
      global.forceEngine = '';
      // # شرط — فرع منطقي
      if (typeof global.selectVoiceOption === 'function') {
        global.selectVoiceOption('clone', sampleUrl, null, '', 'Recorded Sample');
      // # block — معالجة صوت/استنساخ
      }
      // # شرط — فرع منطقي
      if (document.getElementById('voiceOptClone')) {
        document.getElementById('voiceOptClone').classList.add('selected');
      }
      closeMicrophoneVoiceRecordModal();
      const recName = (document.getElementById('recVoiceName')?.value || '').trim();
      // # شرط — فرع منطقي
      if (recName) {
        const nameInput = document.getElementById('voiceCloneNameInput');
        // # شرط — فرع منطقي
        if (nameInput) nameInput.value = recName;
      }
      DubbingApp.voiceSave?.onRecordedSampleUploadedToStorage?.(sampleUrl);
    } catch (err) {
      // # block — معالجة صوت/استنساخ
      global.showToast?.(err.message || 'Save failed', 'error');
    } finally {
      // # شرط — فرع منطقي
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Upload Sample';
      }
    // # block — معالجة صوت/استنساخ
    }
  }

  DubbingApp.voiceRecorder = {
    openMicrophoneVoiceRecordModal,
    closeMicrophoneVoiceRecordModal,
  };

  global.openVoiceRecordModal = openMicrophoneVoiceRecordModal;
  global.closeVoiceRecordModal = closeMicrophoneVoiceRecordModal;
})(window);
