// # FILE frontend/sl-dubbing-frontend-main/js/tts/07-voice.js
// # AR واجهة TTS
// # KW صوت,استنساخ,توليد_صوت,TTS
// # CONVENTION — FN/AR/KW + # block كل ~6 أسطر — FUNCTION_INDEX.md DOMAIN_INDEX.md
// =====================================================================
// 📒 فهرس الدوال — js/tts/07-voice.js
// ---------------------------------------------------------------------
//  فتح_رفع_عينة_الصوت      → triggerTtsVoiceUploadDialog
//  معالجة_ملف_الصوت_المخصص → processCustomVoiceUploadFile
//  اختيار_صوت_بريميوم       → selectTtsPremiumVoice
//  جلب_أصوات_بريميوم        → loadTtsPremiumVoicesFromSupabase
//  ربط_لوحة_الأصوات         → bindTtsVoicePanelUi
// =====================================================================
(function (global) {
  const TtsApp = global.TtsApp;
  const S = TtsApp.state;
  const { getTtsUserVoiceStorageKey } = TtsApp.helpers;

  // # FN _showVoiceCloneNote
  // # AR الصوت والاستنساخ (_showVoiceCloneNote)
  // # KW صوت,استنساخ,voice,clone,sample,توليد_صوت,TTS,synthesis
  function _showVoiceCloneNote(show) {
    let note = document.getElementById('voiceCloneNote');
    // # شرط — فرع منطقي
    if (show) {
      // # شرط — فرع منطقي
      if (!note) {
        note = document.createElement('div');
        note.id = 'voiceCloneNote';
        // # block — معالجة صوت/استنساخ
        note.style.cssText = 'font-size:0.72rem;color:#f59e0b;margin-top:4px;display:flex;align-items:center;gap:4px;padding:0 4px;';
        note.innerHTML = '<i class="fa-solid fa-circle-info"></i> Cloned / premium voices use ElevenLabs — use ⚡ Quick for Edge TTS';
        document.querySelector('.editor-controls')?.appendChild(note);
      }
      note.style.display = 'flex';
    } else if (note) {
      // # block — توليد صوت TTS
      note.style.display = 'none';
    }
  }

  /** تفعيل_ملاحظة_الاستنساخ — دالة عامة لاستخدامها من 99-init.js */
  // # FN showVoiceCloneNotePublic
  // # AR الصوت والاستنساخ (showVoiceCloneNotePublic)
  // # KW صوت,استنساخ,voice,clone,sample,توليد_صوت,TTS,synthesis
  function showVoiceCloneNotePublic(show) { _showVoiceCloneNote(show); }

  /** اختيار_صوت_بريميوم */
  // # FN selectTtsPremiumVoice
  // # KW صوت,استنساخ,voice,clone,sample,توليد_صوت,TTS,synthesis
  function selectTtsPremiumVoice(id, name, sampleUrl, sampleText) {
    S.selectedVoiceId = id;
    global.currentSampleUrl = sampleUrl || '';
    global.selectedSample = sampleUrl || '';
    global.currentSampleText = (sampleText || '').trim();
    global.usingSavedVoice = true;  // Premium voices are system voices — never prompt to save
    // # block — معالجة صوت/استنساخ
    global.voiceMode = 'clone';
    S.customVoiceFile = null;
    _showVoiceCloneNote(true);
    const nameEl = document.getElementById('currentVoiceName');
    // # شرط — فرع منطقي
    if (nameEl) nameEl.textContent = name;

    const savedKey = getTtsUserVoiceStorageKey();
    // # localStorage — تخزين محلي
    const saved = localStorage.getItem(savedKey);
    // # شرط — فرع منطقي
    if (!saved || sampleUrl !== saved) {
      const cloneLabel = document.getElementById('cloneLabel');
      const cloneIcon = document.getElementById('cloneIcon');
      // # شرط — فرع منطقي
      if (cloneLabel) cloneLabel.textContent = 'Clone';
      // # شرط — فرع منطقي
      if (cloneIcon) {
        // # block — معالجة صوت/استنساخ
        cloneIcon.className = 'fa-solid fa-plus';
        cloneIcon.style.color = '#6b7280';
      }
    }

    document.getElementById('voicePanel')?.classList.remove('active');
    document.getElementById('ttsVoicesGrid')?.querySelectorAll('.v-avatar-card').forEach((c) => {
      // # block — معالجة صوت/استنساخ
      c.classList.toggle('selected', c.dataset.voiceId === id);
    });
    document.getElementById('cloneCard')?.classList.remove('selected');
  }

  /** معالجة_ملف_الصوت_المخصص — تحويل إلى WAV 16kHz وحفظ محلياً */
  // # FN processCustomVoiceUploadFile
  // # KW صوت,استنساخ,voice,clone,sample,رفع,upload,R2,storage,توليد_صوت,TTS,synthesis
  async function processCustomVoiceUploadFile(file) {
    global.showToast?.('Processing audio...', 'info');
    const ctx = new (global.AudioContext || global.webkitAudioContext)({ sampleRate: 16000 });
    const arrayBuffer = await file.arrayBuffer();
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);

    // # شرط — فرع منطقي
    if (audioBuffer.duration > 8.0) {
      // # block — معالجة صوت/استنساخ
      global.showToast?.('Voice sample trimmed to 8 seconds for best cloning quality.', 'info');
    }
    const duration = Math.min(audioBuffer.duration, 8.0);
    const length = Math.floor(duration * ctx.sampleRate);
    const offlineCtx = new OfflineAudioContext(1, length, ctx.sampleRate);
    const source = offlineCtx.createBufferSource();
    // # block — معالجة صوت/استنساخ
    source.buffer = audioBuffer;
    source.connect(offlineCtx.destination);
    source.start(0);
    const renderedBuffer = await offlineCtx.startRendering();

    const result = new Float32Array(renderedBuffer.length);
    renderedBuffer.copyFromChannel(result, 0);
    // # block — تنفيذ منطق — راجع الأسطر التالية
    const bufferSize = result.length * 2;
    const wavBuffer = new ArrayBuffer(44 + bufferSize);
    const view = new DataView(wavBuffer);

    // # FN writeStr
    // # KW صوت,استنساخ,voice,clone,sample,توليد_صوت,TTS,synthesis
    const writeStr = (offset, str) => {
      for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
    };
    // # block — حلقة/تكرار
    writeStr(0, 'RIFF');
    view.setUint32(4, 36 + bufferSize, true);
    writeStr(8, 'WAVE');
    // # block — حلقة/تكرار
    writeStr(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    // # block — تنفيذ منطق — راجع الأسطر التالية
    view.setUint16(22, 1, true);
    view.setUint32(24, 16000, true);
    view.setUint32(28, 16000 * 2, true);
    // # block — تنفيذ منطق — راجع الأسطر التالية
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeStr(36, 'data');
    // # block — تنفيذ منطق — راجع الأسطر التالية
    view.setUint32(40, bufferSize, true);

    let offset = 44;
    for (let i = 0; i < result.length; i++, offset += 2) {
      let s = Math.max(-1, Math.min(1, result[i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    }

    // # block — حلقة/تكرار
    let binary = '';
    const bytes = new Uint8Array(wavBuffer);
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
    }
    // # block — حلقة/تكرار
    const base64Audio = 'data:audio/wav;base64,' + btoa(binary);

    // # localStorage — تخزين محلي
    localStorage.setItem(getTtsUserVoiceStorageKey(), base64Audio);
    global.currentSampleUrl = base64Audio;
    global.selectedSample = base64Audio;
    global.usingSavedVoice = false;
    global.voiceMode = 'clone';
    // # block — معالجة صوت/استنساخ
    S.customVoiceFile = file;
    S.selectedVoiceId = 'custom_clone';

    const currentVoiceName = document.getElementById('currentVoiceName');
    const cloneLabel = document.getElementById('cloneLabel');
    const cloneIcon = document.getElementById('cloneIcon');
    // # شرط — فرع منطقي
    if (currentVoiceName) currentVoiceName.textContent = 'My Voice';
    // # شرط — فرع منطقي
    if (cloneLabel) cloneLabel.textContent = 'My Voice';
    // # شرط — فرع منطقي
    if (cloneIcon) {
      cloneIcon.className = 'fa-solid fa-microphone-lines';
      cloneIcon.style.color = 'var(--accent-blue)';
    }
    document.querySelectorAll('.v-avatar-card').forEach((c) => c.classList.remove('selected'));
    // # block — معالجة صوت/استنساخ
    document.getElementById('cloneCard')?.classList.add('selected');
    document.getElementById('voicePanel').classList.remove('active');

    _showVoiceCloneNote(true);
    global.showToast?.('Voice sample saved securely to your browser!', 'success');
  }

  // # FN triggerTtsVoiceUploadDialog
  // # AR الصوت والاستنساخ (triggerTtsVoiceUploadDialog)
  // # KW صوت,استنساخ,voice,clone,sample,رفع,upload,R2,storage,توليد_صوت,TTS,synthesis
  function triggerTtsVoiceUploadDialog() {
    document.getElementById('voiceUploadInput')?.click();
  }

  /** جلب_أصوات_بريميوم — من جدول Supabase voices */
  // # FN loadTtsPremiumVoicesFromSupabase
  // # KW صوت,استنساخ,voice,clone,sample,توليد_صوت,TTS,synthesis,مصادقة,auth,JWT,supabase
  async function loadTtsPremiumVoicesFromSupabase() {
    const grid = document.getElementById('ttsVoicesGrid');
    const supa = global.getSupabase?.();
    // # guard — شرط رفض أو خروج مبكر
    if (!supa || !grid) return;
    // # try — معالجة عملية قد تفشل
    try {
      const { data } = await supa.from('voices').select('*').order('created_at');
      // # شرط — فرع منطقي
      if (data && data.length > 0) {
        grid.replaceChildren();
        data.forEach((v) => {
          const card = document.createElement('div');
          card.className =
            'v-avatar-card' + (S.selectedVoiceId === v.id ? ' selected' : '');
          // # block — معالجة صوت/استنساخ
          card.dataset.voiceId = v.id;
          card.addEventListener('click', () =>
            selectTtsPremiumVoice(v.id, v.name, v.sample_url, v.sample_text),
          );
          const wrap = document.createElement('div');
          wrap.className = 'v-img-wrapper';
          // # block — معالجة صوت/استنساخ
          const img = document.createElement('img');
          img.src = v.avatar_url || '';
          img.alt = '';
          wrap.appendChild(img);
          card.appendChild(wrap);
          const nameEl = document.createElement('div');
          // # block — تنفيذ منطق — راجع الأسطر التالية
          nameEl.className = 'v-name';
          nameEl.textContent = v.name || '';
          card.appendChild(nameEl);
          grid.appendChild(card);
        });
        // Prefer Quick ⚡ by default so Generate works without ElevenLabs/sample setup.
        // User can still pick a premium/clone voice from the panel.
        // # شرط
        if (!S.selectedVoiceId && !S.customVoiceFile && !global.currentSampleUrl) {
          // # block — معالجة صوت/استنساخ
          selectQuickEdgeVoice();
        }
      }
    } catch (err) {
      /* ignore */
    }
  }

  /** اختيار_الوضع_السريع — Edge TTS مباشرة */
  // # FN selectQuickEdgeVoice
  // # AR الصوت والاستنساخ (selectQuickEdgeVoice)
  // # KW صوت,استنساخ,voice,clone,sample,توليد_صوت,TTS,synthesis
  function selectQuickEdgeVoice() {
    S.selectedVoiceId = 'quick_edge';
    global.currentSampleUrl = '';
    global.selectedSample = '';
    global.usingSavedVoice = false;
    global.voiceMode = 'quick';
    // # block — معالجة صوت/استنساخ
    S.customVoiceFile = null;
    _showVoiceCloneNote(false);

    const nameEl = document.getElementById('currentVoiceName');
    // # شرط — فرع منطقي
    if (nameEl) nameEl.textContent = 'Quick';

    document.getElementById('voicePanel')?.classList.remove('active');
    document.querySelectorAll('.v-avatar-card').forEach(c => c.classList.remove('selected'));
    // # block — معالجة صوت/استنساخ
    document.getElementById('quickVoiceCard')?.classList.add('selected');
    document.getElementById('cloneCard')?.classList.remove('selected');
  }

  /** إضافة_بطاقة_Quick — في أعلى لوحة الأصوات */
  // # FN addQuickVoiceCard
  // # KW صوت,استنساخ,voice,clone,sample,توليد_صوت,TTS,synthesis
  function addQuickVoiceCard() {
    const grid = document.getElementById('voicePanel')?.querySelector('.premium-grid');
    // # guard — شرط رفض أو خروج مبكر
    if (!grid || document.getElementById('quickVoiceCard')) return;
    const card = document.createElement('div');
    card.className = 'v-avatar-card';
    card.id = 'quickVoiceCard';
    // # block — معالجة صوت/استنساخ
    card.title = 'Fast Edge TTS — half the credits';
    card.innerHTML = `
      <div class="v-img-wrapper" style="background:linear-gradient(135deg,#f59e0b,#f97316);">
        <i class="fa-solid fa-bolt" style="color:#fff;font-size:1rem;"></i>
      </div>
      <div class="v-name">Quick</div>`;
    // # block — معالجة صوت/استنساخ
    card.addEventListener('click', selectQuickEdgeVoice);
    grid.insertBefore(card, grid.firstChild);
  }

  /** اختيار_عينة_محفوظة — من مكتبة المستخدم */
  // # FN selectTtsUserCloneVoice
  // # AR الصوت والاستنساخ (selectTtsUserCloneVoice)
  // # KW صوت,استنساخ,voice,clone,sample,توليد_صوت,TTS,synthesis
  function selectTtsUserCloneVoice(id, name, sampleUrl, sampleText) {
    S.selectedVoiceId = `clone_${id}`;
    global.currentSampleUrl = sampleUrl || '';
    global.selectedSample = sampleUrl || '';
    global.currentSampleText = (sampleText || '').trim();
    global.usingSavedVoice = true;
    // # block — معالجة صوت/استنساخ
    global.voiceMode = 'clone';
    S.customVoiceFile = null;
    _showVoiceCloneNote(true);

    const nameEl = document.getElementById('currentVoiceName');
    // # شرط — فرع منطقي
    if (nameEl) nameEl.textContent = name || 'My Voice';

    document.getElementById('voicePanel')?.classList.remove('active');
    // # block — معالجة صوت/استنساخ
    document.querySelectorAll('.v-avatar-card').forEach(c => c.classList.remove('selected'));
    document.querySelector(`[data-voice-id="clone_${id}"]`)?.classList.add('selected');
    document.getElementById('cloneCard')?.classList.remove('selected');
  }

  /** تحميل_عينات_المستخدم_المحفوظة — من /api/user/voice-clones */
  // # FN loadUserVoiceClonesIntoTtsPanel
  // # KW صوت,استنساخ,voice,clone,sample,توليد_صوت,TTS,synthesis
  async function loadUserVoiceClonesIntoTtsPanel() {
    const { normalizeTtsApiBaseUrl } = TtsApp.helpers;
    const API = normalizeTtsApiBaseUrl();
    const headers =
      typeof global.refreshApiAuthHeadersFromSupabase === 'function'
        ? await global.refreshApiAuthHeadersFromSupabase()
        // # block — توليد صوت TTS
        : typeof global.getApiAuthHeaders === 'function'
          ? global.getApiAuthHeaders()
          : null;
    // # guard — شرط رفض أو خروج مبكر
    if (!headers) return;

    // # try — معالجة عملية قد تفشل
    try {
      // # HTTP — طلب إلى API
      const res = await fetch(`${API}/api/user/voice-clones`, { headers });
      // # parse — قراءة JSON من الاستجابة
      const data = await res.json().catch(() => ({}));
      // # guard — شرط رفض أو خروج مبكر
      if (!res.ok || !data.success || !Array.isArray(data.clones) || data.clones.length === 0) return;

      let section = document.getElementById('ttsUserClonesSection');
      // # guard — شرط رفض أو خروج مبكر
      if (!section) {
        const panel = document.getElementById('voicePanel');
        // # guard — شرط رفض أو خروج مبكر
        if (!panel) return;
        // # block — معالجة صوت/استنساخ
        section = document.createElement('div');
        section.id = 'ttsUserClonesSection';
        section.style.cssText = 'margin-bottom:10px;border-bottom:1px solid #f3f4f6;padding-bottom:10px;';
        section.innerHTML = '<div style="font-size:0.65rem;font-weight:700;color:#9ca3af;margin-bottom:6px;letter-spacing:0.5px;">MY SAVED VOICES</div><div class="premium-grid" id="ttsUserClonesGrid"></div>';
        panel.insertBefore(section, panel.firstChild);
      }

      // # block — معالجة صوت/استنساخ
      const grid = document.getElementById('ttsUserClonesGrid');
      // # guard — شرط رفض أو خروج مبكر
      if (!grid) return;
      grid.replaceChildren();

      data.clones.forEach((clone) => {
        const card = document.createElement('div');
        card.className = 'v-avatar-card' + (S.selectedVoiceId === `clone_${clone.id}` ? ' selected' : '');
        // # block — معالجة صوت/استنساخ
        card.dataset.voiceId = `clone_${clone.id}`;
        const initial = (clone.name || 'V').trim().charAt(0).toUpperCase();
        card.innerHTML = `
          <div class="v-img-wrapper" style="background:linear-gradient(135deg,#8b5cf6,#6366f1);">
            <span style="color:#fff;font-weight:800;font-size:1rem;">${initial}</span>
          </div>
          // # block — معالجة صوت/استنساخ
          <div class="v-name">${(clone.name || 'Voice').slice(0, 12)}</div>`;
        card.addEventListener('click', () =>
          selectTtsUserCloneVoice(clone.id, clone.name, clone.sample_url, clone.sample_text)
        );
        grid.appendChild(card);
      });
    // # block — معالجة صوت/استنساخ
    } catch (_) {}
  }

  // # FN bindTtsVoicePanelUi
  // # AR bind tts voice panel ui (bindTtsVoicePanelUi)
  // # KW صوت,استنساخ,voice,clone,sample,توليد_صوت,TTS,synthesis
  function bindTtsVoicePanelUi() {
    global.triggerVoiceUpload = triggerTtsVoiceUploadDialog;
    addQuickVoiceCard();

    document.getElementById('voiceUploadInput')?.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      // # guard — شرط رفض أو خروج مبكر
      if (!file) return;
      // # try — معالجة عملية قد تفشل
      try {
        await processCustomVoiceUploadFile(file);
      } catch (err) {
        console.error('Audio processing failed', err);
        global.showToast?.('Failed to process audio. Try a different file.', 'error');
      }
    // # block — معالجة صوت/استنساخ
    });

    document.getElementById('voiceToggle')?.addEventListener('click', (e) => {
      e.stopPropagation();
      const panel = document.getElementById('voicePanel');
      const opening = !panel?.classList.contains('active');
      global.closeAllSiteDropdowns?.();
      // # شرط
      if (opening) panel?.classList.add('active');
    });
  }

  TtsApp.voice = {
    selectTtsPremiumVoice,
    selectTtsUserCloneVoice,
    selectQuickEdgeVoice,
    addQuickVoiceCard,
    processCustomVoiceUploadFile,
    loadTtsPremiumVoicesFromSupabase,
    loadUserVoiceClonesIntoTtsPanel,
    bindTtsVoicePanelUi,
    triggerTtsVoiceUploadDialog,
    showVoiceCloneNote: showVoiceCloneNotePublic,
  };

  global.selectTtsVoice = selectTtsPremiumVoice;
  global.triggerVoiceUpload = triggerTtsVoiceUploadDialog;
})(window);
