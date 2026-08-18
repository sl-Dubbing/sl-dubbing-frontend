// # FILE frontend/sl-dubbing-frontend-main/js/tts/09-recent-works.js
// # AR واجهة TTS
// # KW توليد_صوت,TTS
// # CONVENTION — FN/AR/KW + # block كل ~6 أسطر — FUNCTION_INDEX.md DOMAIN_INDEX.md
// =====================================================================
// 📒 فهرس الدوال — js/tts/09-recent-works.js
// ---------------------------------------------------------------------
//  حفظ_في_سجل_المتصفح       → saveTtsItemToLocalHistory
//  قراءة_السجل_من_localStorage → loadTtsHistoryFromLocalStorage
//  دمج_مصادر_العرض          → mergeTtsRecentWorkItems
//  عرض_بطاقات_آخر_الأعمال   → renderRecentTtsWorksGrid
//  جلب_وعرض_آخر_الأعمال     → loadAndRenderRecentTtsWorks
//  تنظيف_زائد_قاعدة_البيانات → pruneExcessTtsFilesOnServer
// =====================================================================
(function (global) {
  const TtsApp = global.TtsApp;
  const {
    escapeHtmlForTtsUi,
    formatRelativeTimeAgo,
    normalizeTtsApiBaseUrl,
    downloadTtsAudioFile,
  } = TtsApp.helpers;
  const C = TtsApp.constants;
  let recentFilesForDownload = [];
  let recentDownloadBound = false;

  /** حفظ_في_سجل_المتصفح — حد أقصى 7 عناصر */
  // # FN saveTtsItemToLocalHistory
  // # KW توليد_صوت,TTS,synthesis,تنفيذ,local,cloud,modal,parity
  function saveTtsItemToLocalHistory({ text, url, lang }) {
    let arr = [];
    // # try — معالجة عملية قد تفشل
    try {
      // # localStorage — تخزين محلي
      arr = JSON.parse(localStorage.getItem(C.HISTORY_STORAGE_KEY) || '[]') || [];
    } catch (_) {
      arr = [];
    // # block — تحديث واجهة/DOM
    }
    // # شرط — فرع منطقي
    if (!Array.isArray(arr)) arr = [];
    arr.unshift({
      id: 'tts_' + Date.now(),
      name: 'Text-to-Speech Audio',
      text: text || '',
      // # block — توليد صوت TTS
      output_url: url || '',
      lang: lang || '',
      created_at: new Date().toISOString(),
    });
    // # شرط — فرع منطقي
    if (arr.length > C.MAX_LOCAL_HISTORY) arr = arr.slice(0, C.MAX_LOCAL_HISTORY);
    // # try — معالجة عملية قد تفشل
    try {
      // # localStorage — تخزين محلي
      localStorage.setItem(C.HISTORY_STORAGE_KEY, JSON.stringify(arr));
    } catch (e) {
      // # localStorage — تخزين محلي
      localStorage.setItem(C.HISTORY_STORAGE_KEY, JSON.stringify([arr[0]]));
    }
  }

  // # localStorage — تخزين محلي
  /** قراءة_السجل_من_localStorage — نفس مفتاح history.html */
  // # FN loadTtsHistoryFromLocalStorage
  // # AR رفع الملفات والتخزين (loadTtsHistoryFromLocalStorage)
  // # KW رفع,upload,R2,storage,توليد_صوت,TTS,synthesis,تنفيذ,local,cloud,modal,parity
  function loadTtsHistoryFromLocalStorage() {
    // # try — معالجة عملية قد تفشل
    try {
      // # localStorage — تخزين محلي
      const raw = localStorage.getItem(C.HISTORY_STORAGE_KEY);
      // # guard — شرط رفض أو خروج مبكر
      if (!raw) return [];
      const arr = JSON.parse(raw);
      // # guard — شرط رفض أو خروج مبكر
      if (!Array.isArray(arr)) return [];
      // # return — إرجاع النتيجة
      return arr.map((item) => ({
        id: item.id || 'tts_' + (item.created_at || Date.now()),
        type: 'tts',
        name: item.name || 'Text-to-Speech Audio',
        text: item.text || '',
        output_url: item.output_url || '',
        // # block — توليد صوت TTS
        lang: item.lang || '',
        created_at: item.created_at,
      }));
    } catch (_) {
      // # return — إرجاع النتيجة
      return [];
    }
  }

  /** دمج_مصادر_العرض — إزالة التكرار بالمعرّف */
  // # FN mergeTtsRecentWorkItems
  // # KW توليد_صوت,TTS,synthesis
  function mergeTtsRecentWorkItems(localItems, sessionItems, dbItems) {
    const seen = new Set();
    const merged = [];
    for (const list of [localItems, sessionItems, dbItems]) {
      for (const f of list || []) {
        const id = String(f.id || f.created_at || '');
        // # شرط — فرع منطقي
        if (!id || seen.has(id)) continue;
        seen.add(id);
        merged.push(f);
      }
    }
    // # return — إرجاع النتيجة
    return merged
      // # block — إرجاع نتيجة
      .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
      .slice(0, C.RECENT_DISPLAY_COUNT);
  }

  // # FN _ttsDownloadFilename
  // # AR Text-to-speech (_ttsDownloadFilename)
  // # KW توليد_صوت,TTS,synthesis
  function _ttsDownloadFilename(createdAt) {
    // # try — معالجة عملية قد تفشل
    try {
      const d = new Date(createdAt || Date.now());
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      // # return — إرجاع النتيجة
      return `TTS-${y}-${m}-${day}.mp3`;
    } catch (_) {
      // # return — إرجاع النتيجة
      return 'TTS-audio.mp3';
    }
  }

  // # FN deleteRecentTtsJob
  // # KW توليد_صوت,TTS,synthesis,مهمة,job,polling,celery,worker
  async function deleteRecentTtsJob(file) {
    // Remove from localStorage (covers local-only items)
    // # try — معالجة عملية قد تفشل
    try {
      // # localStorage — تخزين محلي
      const raw = localStorage.getItem(C.HISTORY_STORAGE_KEY);
      // # شرط — فرع منطقي
      if (raw) {
        const arr = JSON.parse(raw).filter(
          (i) => i.id !== file.id && i.output_url !== file.output_url
        // # block — تحديث واجهة/DOM
        );
        // # localStorage — تخزين محلي
        localStorage.setItem(C.HISTORY_STORAGE_KEY, JSON.stringify(arr));
      }
    } catch (_) {}

    // If item is server-side (id doesn't start with 'tts_'), also call the API
    // # شرط — فرع منطقي
    if (!String(file.id).startsWith('tts_')) {
      const headers =
        // # block — توليد صوت TTS
        typeof global.getApiAuthHeaders === 'function' ? global.getApiAuthHeaders() : null;
      // # شرط — فرع منطقي
      if (headers) {
        // # try — معالجة عملية قد تفشل
        try {
          const API = normalizeTtsApiBaseUrl();
          // # HTTP — طلب إلى API
          const res = await fetch(
            `${API}/api/user/files/tts/${encodeURIComponent(String(file.id))}`,
            // # block — طلب HTTP/API
            { method: 'DELETE', headers }
          );
          // # parse — قراءة JSON من الاستجابة
          const data = await res.json().catch(() => ({}));
          // # return — إرجاع النتيجة
          return res.ok && data.success !== false;
        } catch (_) {
          return false;
        // # block — parse/serialize JSON
        }
      }
    }
    // # return — إرجاع النتيجة
    return true;
  }

  // # FN bindRecentTtsDownloadButtons
  // # KW توليد_صوت,TTS,synthesis
  function bindRecentTtsDownloadButtons() {
    const grid = document.getElementById('recentTtsGrid');
    // # guard — شرط رفض أو خروج مبكر
    if (!grid || recentDownloadBound) return;
    recentDownloadBound = true;
    grid.addEventListener('click', async (e) => {
      const dlBtn = e.target.closest('.tts-download-btn');
      // # block — توليد صوت TTS
      const delBtn = e.target.closest('.rjc-del-btn');
      // # guard — شرط رفض أو خروج مبكر
      if (!dlBtn && !delBtn) return;
      e.preventDefault();
      e.stopPropagation();

      // # شرط — فرع منطقي
      if (dlBtn) {
        const idx = Number(dlBtn.getAttribute('data-idx'));
        // # block — فرع شرطي
        const file = recentFilesForDownload[idx];
        const url = file?.output_url || '';
        // # guard — شرط رفض أو خروج مبكر
        if (!url) return;
        const filename = _ttsDownloadFilename(file?.created_at);
        dlBtn.disabled = true;
        const ok = await downloadTtsAudioFile(url, filename);
        // # block — توليد صوت TTS
        dlBtn.disabled = false;
        // # شرط — فرع منطقي
        if (ok) {
          global.showToast?.('Download started', 'success');
        } else {
          global.showToast?.('Download failed — try again', 'error');
        }
      // # block — معالجة أخطاء
      }

      // # guard — شرط رفض أو خروج مبكر
      if (delBtn) {
        const idx = Number(delBtn.getAttribute('data-idx'));
        const file = recentFilesForDownload[idx];
        // # guard — شرط رفض أو خروج مبكر
        if (!file) return;
        // # guard — شرط رفض أو خروج مبكر
        if (!confirm('Permanently delete this audio? This action cannot be undone.')) return;
        // # block — فرع شرطي
        delBtn.disabled = true;
        const ok = await deleteRecentTtsJob(file);
        // # شرط — فرع منطقي
        if (ok) {
          global.showToast?.('Deleted', 'success');
          const updated = recentFilesForDownload.filter((_, i) => i !== idx);
          renderRecentTtsWorksGrid(updated);
          // # block — توليد صوت TTS
          const section = document.getElementById('recentTtsSection');
          // # شرط — فرع منطقي
          if (section && updated.length === 0) section.style.display = 'none';
        } else {
          delBtn.disabled = false;
          global.showToast?.('Delete failed — try again', 'error');
        }
      // # block — تحديث واجهة/DOM
      }
    });
  }

  const TTS_WAVEFORM_SVG = '<svg class="rjc-waveform-svg" viewBox="0 0 200 48" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg" fill="rgba(255,255,255,0.45)" aria-hidden="true"><rect x="2" y="20" width="6" height="8" rx="3"/><rect x="12" y="15" width="6" height="18" rx="3"/><rect x="22" y="10" width="6" height="28" rx="3"/><rect x="32" y="6" width="6" height="36" rx="3"/><rect x="42" y="13" width="6" height="22" rx="3"/><rect x="52" y="3" width="6" height="42" rx="3"/><rect x="62" y="8" width="6" height="32" rx="3"/><rect x="72" y="1" width="6" height="46" rx="3"/><rect x="82" y="10" width="6" height="28" rx="3"/><rect x="92" y="5" width="6" height="38" rx="3"/><rect x="102" y="14" width="6" height="20" rx="3"/><rect x="112" y="2" width="6" height="44" rx="3"/><rect x="122" y="7" width="6" height="34" rx="3"/><rect x="132" y="3" width="6" height="42" rx="3"/><rect x="142" y="11" width="6" height="26" rx="3"/><rect x="152" y="5" width="6" height="38" rx="3"/><rect x="162" y="12" width="6" height="24" rx="3"/><rect x="172" y="9" width="6" height="30" rx="3"/><rect x="182" y="15" width="6" height="18" rx="3"/><rect x="192" y="20" width="6" height="8" rx="3"/></svg>';

  /** عرض_بطاقات_آخر_الأعمال */
  // # FN renderRecentTtsWorksGrid
  // # KW توليد_صوت,TTS,synthesis
  function renderRecentTtsWorksGrid(files) {
    const grid = document.getElementById('recentTtsGrid');
    // # guard — شرط رفض أو خروج مبكر
    if (!grid) return;
    recentFilesForDownload = files || [];
    bindRecentTtsDownloadButtons();
    grid.innerHTML = files
      // # block — توليد صوت TTS
      .map((f, idx) => {
        const ago = formatRelativeTimeAgo(f.created_at);
        const url = f.output_url || '';
        const filename = escapeHtmlForTtsUi(_ttsDownloadFilename(f.created_at));
        const snippet = f.text
          ? `<div style="font-size:0.78rem;color:#9ca3af;margin-top:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">"${escapeHtmlForTtsUi((f.text || '').slice(0, 60))}"</div>`
          // # block — توليد صوت TTS
          : '';
        // # guard — شرط رفض أو خروج مبكر
        if (url) {
          // # return — إرجاع النتيجة
          return `<div class="recent-job-card">
            <button type="button" class="rjc-del-btn" data-idx="${idx}" title="Delete this audio" aria-label="Delete"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg></button>
            <div class="rjc-audio-wrap">
              ${TTS_WAVEFORM_SVG}
              <audio src="${escapeHtmlForTtsUi(url)}" controls preload="metadata" class="rjc-audio-native"></audio>
            </div>
            <div class="rjc-card-meta">
              <div class="rjc-meta-info">
                <div style="font-size:0.85rem;color:var(--text-main);font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${filename}</div>
                ${ago ? `<div style="font-size:0.75rem;color:#9ca3af;margin-top:2px;">${ago}</div>` : ''}
                ${snippet}
              </div>
              <button type="button" class="tts-download-btn" data-idx="${idx}"
                style="flex-shrink:0;display:inline-flex;align-items:center;justify-content:center;width:34px;height:34px;background:var(--accent-blue);color:#fff;border-radius:8px;border:none;cursor:pointer;font-size:0.9rem;"
                title="Download" aria-label="Download">
                <i class="fa-solid fa-download"></i>
              </button>
            </div>
          </div>`;
        }
        // # return — إرجاع النتيجة
        return `<div class="recent-job-card">
          <div style="padding:14px;">
            <div style="font-size:0.85rem;color:var(--text-muted);display:flex;align-items:center;gap:8px;">
              <i class="fa-solid fa-circle-notch fa-spin"></i> Processing…
            </div>
            ${ago ? `<div style="font-size:0.75rem;color:#9ca3af;margin-top:4px;">${ago}</div>` : ''}
          </div>
        </div>`;
      // # block — تنفيذ منطق — راجع الأسطر التالية
      })
      .join('');
  }

  // # FN pruneExcessTtsFilesOnServer
  // # AR Speech-to-text (pruneExcessTtsFilesOnServer)
  // # KW تفريغ,ASR,STT,whisper,deepgram,توليد_صوت,TTS,synthesis
  async function pruneExcessTtsFilesOnServer(headers, dbTts) {
    // # guard — شرط رفض أو خروج مبكر
    if (dbTts.length <= C.MAX_DB_TTS_ITEMS) return dbTts;
    const toDelete = dbTts
      .slice(C.MAX_DB_TTS_ITEMS)
      .map((f) => ({ type: f.type, id: String(f.id) }));
    const kept = dbTts.slice(0, C.MAX_DB_TTS_ITEMS);
    // # block — توليد صوت TTS
    const API = normalizeTtsApiBaseUrl();
    // # HTTP — طلب fetch
    fetch(`${API}/api/user/files/bulk-delete`, {
      method: 'POST',
      headers: Object.assign({}, headers, { 'Content-Type': 'application/json' }),
      // # تسلسل JSON للطلب
      body: JSON.stringify({ items: toDelete }),
    }).catch(() => {});
    // # return — إرجاع النتيجة
    return kept;
  }

  /** جلب_وعرض_آخر_الأعمال — محلي + GET /api/user/files */
  // # FN loadAndRenderRecentTtsWorks
  // # AR تحميل and عرض recent tts works (loadAndRenderRecentTtsWorks)
  // # KW توليد_صوت,TTS,synthesis
  async function loadAndRenderRecentTtsWorks() {
    const grid = document.getElementById('recentTtsGrid');
    const headers =
      typeof global.getApiAuthHeaders === 'function' ? global.getApiAuthHeaders() : null;

    let dbTts = [];
    // # شرط — فرع منطقي
    if (headers) {
      // # try — معالجة عملية قد تفشل
      try {
        const API = normalizeTtsApiBaseUrl();
        // # HTTP — طلب إلى API
        const res = await fetch(`${API}/api/user/files`, { headers });
        // # parse — قراءة JSON من الاستجابة
        const data = await res.json().catch(() => ({}));
        dbTts = ((data.success && data.files) || [])
          .filter((f) => f.type === 'tts')
          // # block — طلب HTTP/API
          .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        dbTts = await pruneExcessTtsFilesOnServer(headers, dbTts);
      } catch (err) {
        /* ignore */
      }
    }

    // # block — توليد صوت TTS
    const localHistory = loadTtsHistoryFromLocalStorage();
    const combined = mergeTtsRecentWorkItems(
      localHistory,
      global.sessionTtsHistory || [],
      dbTts,
    );

    // # شرط — فرع منطقي
    if (combined.length > 0) {
      renderRecentTtsWorksGrid(combined);
    } else if (grid) {
      grid.innerHTML =
        '<div style="grid-column:1/-1;text-align:center;padding:24px;color:#9ca3af;font-size:0.9rem;"><i class="fa-regular fa-folder-open" style="margin-right:8px;"></i>No recent TTS works yet</div>';
    }
  }

  TtsApp.recent = {
    saveTtsItemToLocalHistory,
    renderRecentTtsWorksGrid,
    loadAndRenderRecentTtsWorks,
  };
})(window);
