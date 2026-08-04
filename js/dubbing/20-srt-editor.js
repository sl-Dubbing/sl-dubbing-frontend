// # FILE frontend/sl-dubbing-frontend-main/js/dubbing/20-srt-editor.js
// # AR محرر SRT — تفريغ سريع + ترجمة حرفية فورية بعد اختيار اللغة ثم إرسال
// # KW تفريغ,srt,مترجم,ترجمة
(function (global) {
  const DubbingApp = global.DubbingApp;
  const S = DubbingApp.state;

  S.scriptSegments = S.scriptSegments || [];
  S.sourceScriptSegments = S.sourceScriptSegments || [];
  S.translatedByLang = S.translatedByLang || {};
  S.srtPreviewFileKey = S.srtPreviewFileKey || '';
  S.srtFontScale = S.srtFontScale || 1;
  S.preTranslatedLang = S.preTranslatedLang || '';
  let _translateDebounce = null;
  let _translateSeq = 0;

  const SRT_ZOOM_MIN = 0.75;
  const SRT_ZOOM_MAX = 1.85;
  const SRT_ZOOM_STEP = 0.1;

  // # FN applySrtFontScale
  // # AR تطبيق تكبير/تصغير نص قائمة SRT
  // # KW عام,general
  function applySrtFontScale(scale) {
    const next = Math.min(SRT_ZOOM_MAX, Math.max(SRT_ZOOM_MIN, Number(scale) || 1));
    S.srtFontScale = Math.round(next * 100) / 100;
    const list = document.getElementById('srtSegmentList');
    // # شرط
    if (list) list.style.setProperty('--srt-font-scale', String(S.srtFontScale));
    const label = document.getElementById('srtZoomLabel');
    // # شرط
    if (label) label.textContent = Math.round(S.srtFontScale * 100) + '%';
  }

  // # FN bumpSrtFontScale
  // # KW عام,general
  function bumpSrtFontScale(delta) {
    applySrtFontScale((S.srtFontScale || 1) + delta);
  }

  // # FN bindSrtListZoomAndScroll
  // # AR Ctrl+عجلة الماوس لتكبير النص؛ التمرير العادي للقائمة
  // # KW عام,general
  function bindSrtListZoomAndScroll() {
    const list = document.getElementById('srtSegmentList');
    const panel = document.getElementById('srtEditorPanel');
    // # guard — رفض/خروج
    if (!list || list.dataset.zoomBound === '1') return;
    list.dataset.zoomBound = '1';
    list.addEventListener(
      // # block — تحديث واجهة/DOM
      'wheel',
      (e) => {
        // Ctrl/Cmd + wheel → zoom text; plain wheel → native scroll
        // # guard — رفض/خروج
        if (!(e.ctrlKey || e.metaKey)) return;
        e.preventDefault();
        const dir = e.deltaY > 0 ? -SRT_ZOOM_STEP : SRT_ZOOM_STEP;
        bumpSrtFontScale(dir);
      // # block — فرع شرطي
      },
      { passive: false },
    );
    // Also allow zoom when wheel over panel chrome with Ctrl
    panel?.addEventListener(
      'wheel',
      (e) => {
        // # guard — رفض/خروج
        if (!(e.ctrlKey || e.metaKey)) return;
        // # guard — رفض/خروج
        if (e.target === list || list.contains(e.target)) return;
        e.preventDefault();
        const dir = e.deltaY > 0 ? -SRT_ZOOM_STEP : SRT_ZOOM_STEP;
        bumpSrtFontScale(dir);
      },
      // # block — فرع شرطي
      { passive: false },
    );
  }

  // # FN formatSrtTimestamp
  // # KW عام,general
  function formatSrtTimestamp(sec) {
    const t = Math.max(0, Number(sec) || 0);
    const h = Math.floor(t / 3600);
    const m = Math.floor((t % 3600) / 60);
    const s = Math.floor(t % 60);
    const ms = Math.round((t - Math.floor(t)) * 1000);
    // # FN pad
    // # AR دالة pad (pad)
    // # KW عام,general
    const pad = (n, w) => String(n).padStart(w, '0');
    return pad(h, 2) + ':' + pad(m, 2) + ':' + pad(s, 2) + ',' + pad(ms, 3);
  }

  // # FN parseSrtTimestamp
  // # KW عام,general
  function parseSrtTimestamp(raw) {
    const m = String(raw || '')
      .trim()
      .match(/^(\d{1,2}):(\d{2}):(\d{2})[,.](\d{1,3})$/);
    // # guard — رفض/خروج
    if (!m) return 0;
    const ms = parseInt((m[4] + '000').slice(0, 3), 10);
    // # block — فرع شرطي
    return (
      parseInt(m[1], 10) * 3600 +
      parseInt(m[2], 10) * 60 +
      parseInt(m[3], 10) +
      ms / 1000
    );
  }

  // # FN parseSrtText
  // # AR تحويل نص SRT إلى مقاطع
  // # KW عام,general
  function parseSrtText(text) {
    const blocks = String(text || '')
      .replace(/\r\n/g, '\n')
      .split(/\n\s*\n/);
    const out = [];
    blocks.forEach((block, i) => {
      // # block — حلقة/تكرار
      const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
      // # guard — رفض/خروج
      if (lines.length < 2) return;
      let idx = 0;
      // # شرط
      if (/^\d+$/.test(lines[0])) idx = 1;
      const timeLine = lines[idx] || '';
      const tm = timeLine.match(
        // # block — فرع شرطي
        /(\d{1,2}:\d{2}:\d{2}[,.]\d{1,3})\s*-->\s*(\d{1,2}:\d{2}:\d{2}[,.]\d{1,3})/,
      );
      // # guard — رفض/خروج
      if (!tm) return;
      const body = lines.slice(idx + 1).join('\n').trim();
      // # guard — رفض/خروج
      if (!body) return;
      out.push({
        // # block — فرع شرطي
        id: i,
        start: parseSrtTimestamp(tm[1]),
        end: parseSrtTimestamp(tm[2]),
        text: body,
        speaker: 0,
      });
    // # block — تنفيذ منطق — راجع الأسطر التالية
    });
    return out;
  }

  // # FN syncStartDubbingButtonPhaseUi
  // # AR Extract Script vs Start Dubbing label from cue count
  // # KW تفريغ,asr,srt,مهمة,job
  function syncStartDubbingButtonPhaseUi() {
    const dubBtn = document.getElementById('dubBtn');
    // # guard — شرط رفض أو خروج مبكر
    if (!dubBtn) return;
    // # guard — لا تكتب فوق تعطيل رصيد صفر
    if (dubBtn.getAttribute('aria-disabled') === 'true') return;
    // # guard — أثناء القفل لا تغيّر النص
    if (S.startButtonLocked) return;
    // # block — لا تستدعِ getScriptSegmentsForDub هنا (تسبب recursion مع syncSegmentsFromDom)
    const n = (S.scriptSegments || []).filter((s) => (String(s.text || '').trim())).length;
    // # block — تحديث واجهة/DOM
    const ready = n > 0;
    dubBtn.dataset.phase = ready ? 'dub' : 'extract';
    dubBtn.textContent = ready ? 'Start Dubbing' : 'Extract Script';
    dubBtn.title = ready
      ? 'Start the dubbing job with the reviewed script'
      : 'Extract SRT from the media, review cues, then start';
  }

  // # FN setSrtStatus
  // # KW حالة,webhook,SSE,status
  function setSrtStatus(msg) {
    const el = document.getElementById('srtStatus');
    // # شرط
    if (el) el.textContent = msg || '';
  }

  // # FN cloneScriptSegments
  // # KW صوت,استنساخ,voice,clone,sample
  function cloneScriptSegments(segments) {
    return (Array.isArray(segments) ? segments : []).map((s, i) => ({
      id: s.id != null ? s.id : i,
      start: Number(s.start) || 0,
      end: Number(s.end) || 0,
      text: String(s.text || '').trim(),
      // # block — حلقة/تكرار
      speaker: s.speaker != null ? s.speaker : 0,
    }));
  }

  // # FN rememberSourceScriptSegments
  // # AR حفظ نص المصدر بعد التفريغ/تحميل SRT (قبل الترجمة الحرفية)
  // # KW عام,general
  function rememberSourceScriptSegments(segments) {
    S.sourceScriptSegments = cloneScriptSegments(segments).filter((s) => s.text);
    S.translatedByLang = {};
    S.preTranslatedLang = '';
  }

  // # FN resolveSourceLangBase
  // # KW لغة,language,dialect
  function resolveSourceLangBase() {
    const sourceLang =
      typeof global.getSelectedSourceLanguage === 'function'
        ? global.getSelectedSourceLanguage()
        : '';
    return String(sourceLang || '')
      // # block — إرجاع نتيجة
      .split('-')[0]
      .toLowerCase();
  }

  // # FN resolveTargetLangBase
  // # KW لغة,language,dialect
  function resolveTargetLangBase(langCode) {
    const info = global.LANGUAGES?.find((l) => l.code === langCode);
    return String(info?.base_lang || String(langCode || '').split('-')[0] || '')
      .toLowerCase();
  }

  // # FN translateSegmentsLiteralApi
  // # AR ترجمة حرفية فورية عبر /api/dub/translate-segments
  // # KW مترجم,ترجمة
  async function translateSegmentsLiteralApi(segments, targetLanguage) {
    let authHeaders =
      typeof global.refreshApiAuthHeadersFromSupabase === 'function'
        ? await global.refreshApiAuthHeadersFromSupabase()
        : DubbingApp.api.getDubbingApiAuthHeaders();
    // # guard — رفض/خروج
    if (!authHeaders) authHeaders = DubbingApp.api.getDubbingApiAuthHeaders();
    // # guard — رفض/خروج
    if (!authHeaders) throw new Error('Please sign in first');
    const { normalizeApiBaseUrl } = DubbingApp.api;
    // # HTTP — طلب API
    const res = await fetch(`${normalizeApiBaseUrl()}/api/dub/translate-segments`, {
      method: 'POST',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        // # block — طلب HTTP/API
        segments,
        target_language: targetLanguage,
        style: 'literal',
      }),
    });
    const data = await res.json().catch(() => ({}));
    // # guard — رفض/خروج
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Literal translate failed');
    }
    return cloneScriptSegments(data.segments || []).filter((s) => s.text);
  }

  // # FN getSegmentsReadyForDub
  // # AR مقاطع جاهزة للإرسال: ترجمة حرفية إن لزم ثم translate=false على Modal
  // # KW مترجم,ترجمة,srt
  async function getSegmentsReadyForDub(langCode) {
    syncSegmentsFromDom();
    // # شرط
    if (!S.sourceScriptSegments?.length && S.scriptSegments?.length) {
      rememberSourceScriptSegments(S.scriptSegments);
    }
    const source = cloneScriptSegments(S.sourceScriptSegments || S.scriptSegments || []).filter(
      // # block — معالجة صوت/استنساخ
      (s) => s.text,
    );
    // # guard — رفض/خروج
    if (!source.length) return [];

    const srcBase = resolveSourceLangBase();
    const tgtBase = resolveTargetLangBase(langCode);
    // # guard — رفض/خروج
    if (srcBase && tgtBase && srcBase === tgtBase) {
      // # block — خطوة ترجمة (مترجم)
      S.preTranslatedLang = langCode;
      return source;
    }

    const cacheKey = String(langCode || tgtBase || '');
    // # guard — رفض/خروج
    if (cacheKey && Array.isArray(S.translatedByLang[cacheKey]) && S.translatedByLang[cacheKey].length) {
      return cloneScriptSegments(S.translatedByLang[cacheKey]);
    // # block — خطوة ترجمة (مترجم)
    }

    setSrtStatus('');
    const translated = await translateSegmentsLiteralApi(source, tgtBase || langCode);
    // # guard — رفض/خروج
    if (cacheKey) S.translatedByLang[cacheKey] = translated;
    S.preTranslatedLang = langCode;
    return translated;
  }

  // # FN onTargetLanguagesChanged
  // # AR بعد اختيار لغة الدبلجة: ترجمة حرفية في الخفاء وتحديث المحرر
  // # KW مترجم,ترجمة
  function onTargetLanguagesChanged() {
    clearTimeout(_translateDebounce);
    _translateDebounce = setTimeout(() => {
      void refreshLiteralTranslationForSelection();
    }, 200);
  }

  // # FN refreshLiteralTranslationForSelection
  // # KW مترجم,ترجمة,translate,translation,LLM
  async function refreshLiteralTranslationForSelection() {
    syncSegmentsFromDom();
    // Prefer frozen source text; if user edited source before any translate, refresh source.
    // # guard — رفض/خروج
    if (!S.sourceScriptSegments?.length) {
      // # guard — رفض/خروج
      if (!(S.scriptSegments || []).some((s) => (s.text || '').trim())) return;
      rememberSourceScriptSegments(S.scriptSegments);
    } else if (!S.preTranslatedLang) {
      // # block — خطوة ترجمة (مترجم)
      rememberSourceScriptSegments(S.scriptSegments);
    }

    const selected = global.selectedLangs;
    // # guard — رفض/خروج
    if (!selected || !selected.size) return;

    const codes = [...selected];
    const seq = ++_translateSeq;

    // # شرط
    if (codes.length > 1) {
      // Multi-target: keep source visible; translate per lang on Start.
      renderSrtEditor(S.sourceScriptSegments);
      S.preTranslatedLang = '';
      setSrtStatus('');
      return;
    }

    // # block — خطوة ترجمة (مترجم)
    const langCode = codes[0];
    const srcBase = resolveSourceLangBase();
    const tgtBase = resolveTargetLangBase(langCode);
    // # شرط
    if (srcBase && tgtBase && srcBase === tgtBase) {
      renderSrtEditor(S.sourceScriptSegments);
      S.preTranslatedLang = langCode;
      // # block — خطوة ترجمة (مترجم)
      setSrtStatus('');
      return;
    }

    // # try — عملية قد تفشل
    try {
      setSrtStatus('');
      const segs = await getSegmentsReadyForDub(langCode);
      // # guard — رفض/خروج
      if (seq !== _translateSeq) return;
      renderSrtEditor(segs);
      setSrtStatus('');
      // Silent — no toast
    } catch (err) {
      // # guard — رفض/خروج
      if (seq !== _translateSeq) return;
      console.warn('[srt] silent literal translate failed:', err);
      // # block — خطوة ترجمة (مترجم)
      setSrtStatus('');
    }
  }

  // # FN getScriptSegmentsForDub
  // # AR قراءة المقاطع الحالية لإرسالها مع /api/dub
  // # KW عام,general
  function getScriptSegmentsForDub() {
    syncSegmentsFromDom();
    return (S.scriptSegments || [])
      .filter((s) => (s.text || '').trim())
      .map((s, i) => ({
        id: i,
        // # block — حلقة/تكرار
        start: Number(s.start) || 0,
        end: Number(s.end) || 0,
        text: String(s.text || '').trim(),
        speaker: s.speaker != null ? s.speaker : 0,
      }));
  }

  // # FN syncSegmentsFromDom
  // # KW عام,general
  function syncSegmentsFromDom() {
    const list = document.getElementById('srtSegmentList');
    // # guard — رفض/خروج
    if (!list) return;
    const cues = list.querySelectorAll('.srt-cue');
    const next = [];
    cues.forEach((cue, i) => {
      // # block — تحديث واجهة/DOM
      const startEl = cue.querySelector('[data-field="start"]');
      const endEl = cue.querySelector('[data-field="end"]');
      const textEl = cue.querySelector('[data-field="text"]');
      const text = (textEl && textEl.value) || '';
      next.push({
        id: i,
        // # block — تنفيذ منطق — راجع الأسطر التالية
        start: parseFloat(startEl && startEl.value) || 0,
        end: parseFloat(endEl && endEl.value) || 0,
        text: text,
        speaker: 0,
      });
    });
    // # block — تنفيذ منطق — راجع الأسطر التالية
    S.scriptSegments = next;
    const countEl = document.getElementById('srtCueCount');
    // # شرط
    if (countEl) countEl.textContent = next.length + ' cue' + (next.length === 1 ? '' : 's');
    syncStartDubbingButtonPhaseUi();
  }

  // # FN renderSrtEditor
  // # AR رسم قائمة المقاطع في اللوحة اليسرى
  // # KW عام,general
  function renderSrtEditor(segments) {
    S.scriptSegments = Array.isArray(segments) ? segments.slice() : [];
    const list = document.getElementById('srtSegmentList');
    const empty = document.getElementById('srtEmpty');
    const countEl = document.getElementById('srtCueCount');
    // # guard — رفض/خروج
    if (!list) return;
    // # block — تحديث واجهة/DOM
    list.innerHTML = '';
    // # شرط
    if (!S.scriptSegments.length) {
      list.innerHTML =
        '<div class="srt-empty" id="srtEmpty">No cues yet — press Extract Script / Start, or load an .srt file.</div>';
      // # guard — رفض/خروج
      if (countEl) countEl.textContent = '0 cues';
      syncStartDubbingButtonPhaseUi();
      // # block — فرع شرطي
      return;
    }
    S.scriptSegments.forEach((seg, i) => {
      const card = document.createElement('div');
      card.className = 'srt-cue';
      card.dataset.index = String(i);
      // # block — تنفيذ منطق — راجع الأسطر التالية
      card.innerHTML =
        '<div class="srt-cue-meta">' +
        '<span class="srt-cue-idx">#' +
        (i + 1) +
        '</span>' +
        '<input data-field="start" type="number" step="0.01" min="0" value="' +
        // # block — تنفيذ منطق — راجع الأسطر التالية
        (Number(seg.start) || 0).toFixed(2) +
        '" title="Start (sec)">' +
        '<span style="color:#9ca3af;font-size:0.7rem;">→</span>' +
        '<input data-field="end" type="number" step="0.01" min="0" value="' +
        (Number(seg.end) || 0).toFixed(2) +
        '" title="End (sec)">' +
        // # block — تنفيذ منطق — راجع الأسطر التالية
        '<button type="button" class="srt-cue-remove" data-remove="' +
        i +
        '" title="Remove"><i class="fa-solid fa-xmark"></i></button>' +
        '</div>' +
        '<textarea data-field="text" rows="2">' +
        String(seg.text || '')
          // # block — تنفيذ منطق — راجع الأسطر التالية
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;') +
        '</textarea>';
      list.appendChild(card);
    });
    // # شرط
    if (countEl) {
      countEl.textContent =
        S.scriptSegments.length + ' cue' + (S.scriptSegments.length === 1 ? '' : 's');
    }
    list.querySelectorAll('[data-field]').forEach((el) => {
      el.addEventListener('change', syncSegmentsFromDom);
      // # block — تنفيذ منطق — راجع الأسطر التالية
      el.addEventListener('input', syncSegmentsFromDom);
    });
    list.querySelectorAll('[data-remove]').forEach((btn) => {
      btn.addEventListener('click', () => {
        syncSegmentsFromDom();
        const idx = parseInt(btn.getAttribute('data-remove'), 10);
        // # block — تنفيذ منطق — راجع الأسطر التالية
        S.scriptSegments.splice(idx, 1);
        renderSrtEditor(S.scriptSegments);
      });
    });
    syncStartDubbingButtonPhaseUi();
  }

  // # FN clearSrtEditor
  // # KW عام,general
  function clearSrtEditor() {
    S.scriptSegments = [];
    S.sourceScriptSegments = [];
    S.translatedByLang = {};
    S.preTranslatedLang = '';
    S.srtPreviewFileKey = '';
    S.srtAudioFileKey = '';
    S.srtVideoFileKey = '';
    S.videoUploadPromise = null;
    S.fastPathMode = '';
    // # block — خطوة ترجمة (مترجم)
    renderSrtEditor([]);
    setSrtStatus('');
  }

  // # FN showSrtWorkspace
  // # KW عام,general
  function showSrtWorkspace(visible) {
    const row = document.getElementById('dubMediaRow');
    // # guard — رفض/خروج
    if (!row) return;
    row.classList.toggle('is-visible', !!visible);
  }

  // # FN ensureMediaUploadedForSrt
  // # AR Fast path: extract compressed audio, upload it for ASR, and start video upload in parallel
  // # KW رفع,upload,R2,storage,تفريغ,سرعة
  async function ensureMediaUploadedForSrt(authHeaders) {
    const file = S.selectedMediaFile || document.getElementById('mediaFile')?.files?.[0];
    // # guard — رفض/خروج
    if (!file) throw new Error('Select a media file first');
    // # guard — رفض/خروج
    if (S.srtAudioFileKey || S.srtPreviewFileKey) {
      return S.srtAudioFileKey || S.srtPreviewFileKey;
    }

    const quality = String(global.dubbingQuality || 'fast').toLowerCase();
    const lipsync = !!global.enableLipsync;
    const useFastAudio =
      quality === 'fast' &&
      !lipsync &&
      DubbingApp.browserAudio?.shouldExtractAudioForFastPath?.(file, {
        enableLipsync: lipsync,
      });

    if (!useFastAudio) {
      const urlData = await DubbingApp.upload.uploadMediaFileResumableToR2(file, authHeaders);
      S.srtPreviewFileKey = urlData.file_key;
      S.srtVideoFileKey = urlData.file_key;
      S.srtAudioFileKey = '';
      S.fastPathMode = 'original';
      return S.srtPreviewFileKey;
    }

    setSrtStatus('Extracting audio locally…');
    const prepared = await DubbingApp.browserAudio.prepareFastPathMedia(file, {
      enableLipsync: lipsync,
      onStatus: (message) => setSrtStatus(message),
      onProgress: (event) => {
        const ratio = Math.max(0, Math.min(1, Number(event?.progress) || 0));
        DubbingApp.ui?.updateDubbingProgressBarUi?.(
          'Extracting audio locally…',
          5 + ratio * 15,
        );
      },
    });

    if (prepared.mode !== 'audio-first' || !prepared.audioFile) {
      const urlData = await DubbingApp.upload.uploadMediaFileResumableToR2(file, authHeaders);
      S.srtPreviewFileKey = urlData.file_key;
      S.srtVideoFileKey = urlData.file_key;
      S.srtAudioFileKey = '';
      S.fastPathMode = 'original';
      return S.srtPreviewFileKey;
    }

    setSrtStatus('Uploading extracted audio…');
    const audioGrant = await DubbingApp.upload.uploadMediaFileResumableToR2(
      prepared.audioFile,
      authHeaders,
      {
        contentType: 'audio/mpeg',
        progressLabel: 'Uploading extracted audio…',
        onProgress: (ratio) => {
          DubbingApp.ui?.updateDubbingProgressBarUi?.(
            'Uploading extracted audio…',
            20 + ratio * 25,
          );
        },
      },
    );
    S.srtAudioFileKey = audioGrant.file_key;
    S.srtPreviewFileKey = audioGrant.file_key;
    S.fastPathMode = 'audio-first';

    // Background video upload — do not block ASR
    S.videoUploadPromise = DubbingApp.upload
      .uploadMediaFileResumableToR2(file, authHeaders, {
        progressLabel: 'Background video upload…',
        onProgress: (ratio) => {
          DubbingApp.ui?.updateDubbingProgressBarUi?.(
            'Background video upload…',
            45 + ratio * 10,
          );
        },
      })
      .then((grant) => {
        S.srtVideoFileKey = grant.file_key;
        return grant;
      })
      .catch((error) => {
        console.error('[fast-path] background video upload failed', error);
        S.videoUploadPromise = null;
        throw error;
      });

    return S.srtAudioFileKey;
  }

  // # FN extractScriptFromMedia
  // # AR تفريغ المقطع لمعاينة SRT قبل الدبلجة
  // # KW تفريغ,asr,srt
  async function extractScriptFromMedia() {
    const btn = document.getElementById('srtExtractBtn');
    const dubBtn = document.getElementById('dubBtn');
    let authHeaders =
      typeof global.refreshApiAuthHeadersFromSupabase === 'function'
        ? await global.refreshApiAuthHeadersFromSupabase()
        // # block — تحديث واجهة/DOM
        : DubbingApp.api.getDubbingApiAuthHeaders();
    // # شرط
    if (!authHeaders) authHeaders = DubbingApp.api.getDubbingApiAuthHeaders();
    // # guard — شرط رفض أو خروج مبكر
    if (!authHeaders) {
      global.showToast?.('Please sign in first', 'error');
      // # return — إرجاع النتيجة
      return false;
    }
    // # block — فرع شرطي
    const sourceLang =
      typeof global.getSelectedSourceLanguage === 'function'
        ? global.getSelectedSourceLanguage()
        : '';
    // # guard — شرط رفض أو خروج مبكر
    if (!sourceLang) {
      global.showToast?.('Select original video language first', 'error');
      // # block — تحديث واجهة/DOM
      document.getElementById('srcLangTrigger')?.classList.add('invalid', 'active');
      // # return — إرجاع النتيجة
      return false;
    }

    // # شرط
    if (btn) btn.disabled = true;
    // # شرط
    if (dubBtn) {
      dubBtn.disabled = true;
      // # block — فرع شرطي
      dubBtn.textContent = 'Extracting…';
    }
    setSrtStatus('Uploading & extracting script…');
    // # try — معالجة عملية قد تفشل
    try {
      const fileKey = await ensureMediaUploadedForSrt(authHeaders);
      const { normalizeApiBaseUrl } = DubbingApp.api;
      // # HTTP — طلب إلى API
      const transcribeBody = {
        source_language: sourceLang,
      };
      if (S.srtAudioFileKey && S.fastPathMode === 'audio-first') {
        transcribeBody.audio_file_key = S.srtAudioFileKey;
        transcribeBody.file_key = S.srtAudioFileKey;
      } else {
        transcribeBody.file_key = fileKey;
      }
      const res = await fetch(`${normalizeApiBaseUrl()}/api/dub/transcribe`, {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify(transcribeBody),
      });
      // # parse — قراءة JSON من الاستجابة
      const data = await res.json().catch(() => ({}));
      // # guard — شرط رفض أو خروج مبكر
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Transcript preview failed');
      }
      // # block — parse/serialize JSON
      const segs = Array.isArray(data.segments) ? data.segments : [];
      rememberSourceScriptSegments(segs);
      renderSrtEditor(segs);
      setSrtStatus('');
      // Keep source-language cues in the UI; literal translate runs when user picks target lang.
      // # شرط — فرع منطقي
      if (segs.length) {
        global.showToast?.(
          // # block — فرع شرطي
          `Loaded ${segs.length} cue(s)`,
          'success',
        );
      } else {
        global.showToast?.('No speech cues found', 'info');
      }
      // # return — إرجاع النتيجة
      return segs.length > 0;
    } catch (err) {
      console.error(err);
      setSrtStatus('');
      global.showToast?.(err.message || 'Extract failed', 'error');
      // # return — إرجاع النتيجة
      return false;
    // # block — معالجة أخطاء
    } finally {
      // # شرط
      if (btn) btn.disabled = false;
      // # شرط
      if (dubBtn) dubBtn.disabled = false;
      syncStartDubbingButtonPhaseUi();
    }
  }

  // # FN addEmptySrtCue
  // # KW عام,general
  function addEmptySrtCue() {
    syncSegmentsFromDom();
    const last = S.scriptSegments[S.scriptSegments.length - 1];
    const start = last ? Number(last.end) || 0 : 0;
    S.scriptSegments.push({
      id: S.scriptSegments.length,
      // # block — تنفيذ منطق — راجع الأسطر التالية
      start,
      end: start + 2,
      text: '',
      speaker: 0,
    });
    renderSrtEditor(S.scriptSegments);
  }

  // # FN onSrtFileSelected
  // # KW عام,general
  function onSrtFileSelected(file) {
    // # guard — رفض/خروج
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const segs = parseSrtText(String(reader.result || ''));
      // # guard — رفض/خروج
      if (!segs.length) {
        // # block — فرع شرطي
        global.showToast?.('Could not parse SRT file', 'error');
        return;
      }
      renderSrtEditor(segs);
      rememberSourceScriptSegments(segs);
      setSrtStatus('');
      // # block — تنفيذ منطق — راجع الأسطر التالية
      global.showToast?.(`Loaded ${segs.length} cue(s) from SRT`, 'success');
      // Do not auto-translate — wait until user selects/changes target language.
    };
    reader.onerror = () => global.showToast?.('Failed to read SRT', 'error');
    reader.readAsText(file);
  }

  // # FN initSrtEditor
  // # KW عام,general
  function initSrtEditor() {
    // Strip legacy hint / cost UI left from cached HTML
    document.querySelectorAll('.srt-hint').forEach((el) => el.remove());
    document.getElementById('charCostEstimate')?.remove();
    const panel = document.getElementById('srtEditorPanel');
    // # شرط
    if (panel) {
      panel.querySelectorAll('p').forEach((p) => {
        // # block — تحديث واجهة/DOM
        const t = (p.textContent || '').toLowerCase();
        // # شرط
        if (t.includes('extract or load') || t.includes('translation skipped') || t.includes('music-only')) {
          p.remove();
        }
      });
    }
    // # block — خطوة ترجمة (مترجم)
    document.getElementById('srtExtractBtn')?.addEventListener('click', extractScriptFromMedia);
    document.getElementById('srtClearBtn')?.addEventListener('click', () => {
      clearSrtEditor();
      global.showToast?.('Script cleared', 'info');
    });
    document.getElementById('srtAddCueBtn')?.addEventListener('click', addEmptySrtCue);
    // # block — تحديث واجهة/DOM
    document.getElementById('srtFileInput')?.addEventListener('change', (e) => {
      onSrtFileSelected(e.target.files && e.target.files[0]);
      e.target.value = '';
    });
    document.getElementById('srtZoomInBtn')?.addEventListener('click', () => bumpSrtFontScale(SRT_ZOOM_STEP));
    document.getElementById('srtZoomOutBtn')?.addEventListener('click', () => bumpSrtFontScale(-SRT_ZOOM_STEP));
    // # block — تحديث واجهة/DOM
    bindSrtListZoomAndScroll();
    applySrtFontScale(S.srtFontScale || 1);
    renderSrtEditor(S.scriptSegments || []);
  }

  DubbingApp.srtEditor = {
    initSrtEditor,
    renderSrtEditor,
    clearSrtEditor,
    showSrtWorkspace,
    getScriptSegmentsForDub,
    getSegmentsReadyForDub,
    onTargetLanguagesChanged,
    rememberSourceScriptSegments,
    syncSegmentsFromDom,
    parseSrtText,
    formatSrtTimestamp,
    setSrtStatus,
    ensureMediaUploadedForSrt,
    extractScriptFromMedia,
    syncStartDubbingButtonPhaseUi,
    applySrtFontScale,
    bumpSrtFontScale,
  };

  global.getDubbingScriptSegments = getScriptSegmentsForDub;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSrtEditor);
  } else {
    initSrtEditor();
  }
})(window);
