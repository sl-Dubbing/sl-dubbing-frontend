// # FILE frontend/sl-dubbing-frontend-main/js/dubbing/13-recent-jobs.js
// # AR واجهة الدبلجة — رفع، Start، polling، أصوات
// # KW مهمة,job
// # CONVENTION — FN/AR/KW + # block كل ~6 أسطر — FUNCTION_INDEX.md DOMAIN_INDEX.md
// dubbing/13-recent-jobs.js — Recent dubbing works grid on dubbing page
(function (global) {
  const DubbingApp = global.DubbingApp;
  const { normalizeApiBaseUrl, getDubbingApiAuthHeaders } = DubbingApp.api;

  let recentJobsForDownload = [];
  let recentDownloadBound = false;
  let recentPollTimer = null;

  // # FN dubbingJobIsStillProcessing
  // # KW مهمة,job,polling,celery,worker
  function dubbingJobIsStillProcessing(job) {
    const status = DubbingApp.jobStatus.normalizeDubbingJobStatus(job?.status);
    return ['pending', 'processing', 'queued'].includes(status);
  }

  // # FN scheduleRecentJobsPollingIfNeeded
  // # AR schedule recent jobs polling if needed (scheduleRecentJobsPollingIfNeeded)
  // # KW مهمة,job,polling,celery,worker
  function scheduleRecentJobsPollingIfNeeded(jobs) {
    // # guard — شرط رفض أو خروج مبكر
    if (recentPollTimer) clearInterval(recentPollTimer);
    // # guard — شرط رفض أو خروج مبكر
    if (!(jobs || []).some(dubbingJobIsStillProcessing)) return;
    
    // التعديل: تقليل الوقت إلى 3 ثوانٍ لاستجابة أسرع
    recentPollTimer = setInterval(() => loadAndRenderRecentDubbingJobs(), 3000);
  }

  // # FN formatRelativeTimeAgoLabel
  // # AR مهام المعالجة (formatRelativeTimeAgoLabel)
  // # KW مهمة,job,polling,celery,worker
  function formatRelativeTimeAgoLabel(dateStr) {
    const t = new Date(dateStr).getTime();
    // # guard — شرط رفض أو خروج مبكر
    if (!dateStr || isNaN(t)) return '';
    const diff = Date.now() - t;
    const mins = Math.floor(diff / 60000);
    // # guard — شرط رفض أو خروج مبكر
    if (mins < 1) return 'Just now';
    // # guard — شرط رفض أو خروج مبكر
    if (mins < 60) return mins + 'm ago';
    const hours = Math.floor(mins / 60);
    // # guard — شرط رفض أو خروج مبكر
    if (hours < 24) return hours + 'h ago';
    // # return — إرجاع النتيجة
    return Math.floor(hours / 24) + 'd ago';
  }

  // # FN formatCreationDateLabel
  // # KW مهمة,job,polling,celery,worker
  function formatCreationDateLabel(dateStr) {
    // # try — معالجة عملية قد تفشل
    try {
      const d = new Date(dateStr || Date.now());
      // # guard — شرط رفض أو خروج مبكر
      if (isNaN(d.getTime())) return 'Dubbed video';
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      // # block — معالجة أخطاء
      const day = String(d.getDate()).padStart(2, '0');
      // # return — إرجاع النتيجة
      return `Dub-${y}-${m}-${day}`;
    } catch (_) {
      // # return — إرجاع النتيجة
      return 'Dubbed video';
    }
  }

  // # FN downloadFilenameForJob
  // # AR مهام المعالجة (downloadFilenameForJob)
  // # KW مهمة,job,polling,celery,worker
  function downloadFilenameForJob(job) {
    const url = job?.output_url || '';
    const extMatch = url.split('?')[0].match(/\.(mp4|mov|webm|mkv|wav|mp3|m4a)(\?|$)/i);
    const ext = extMatch ? extMatch[1].toLowerCase() : 'mp4';
    return formatCreationDateLabel(job?.created_at) + '.' + ext;
  }

  // # FN downloadDubbingFile
  // # AR مهام المعالجة (downloadDubbingFile)
  // # KW مهمة,job,polling,celery,worker
  async function downloadDubbingFile(url, filename) {
    const src = String(url || '').trim();
    // # guard — شرط رفض أو خروج مبكر
    if (!src) return false;
    const name = filename || 'glotix-dub.mp4';

    // # FN triggerBlob
    // # KW مهمة,job,polling,celery,worker
    function triggerBlob(blob) {
      const blobUrl = URL.createObjectURL(blob);
      // # block — فرع شرطي
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = name;
      a.rel = 'noopener';
      // # block — تحديث واجهة/DOM
      a.style.display = 'none';
      document.body.appendChild(a);
      // # block — تحديث واجهة/DOM
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(blobUrl), 2000);
    }

    // # try — معالجة عملية قد تفشل
    try {
      // # guard — شرط رفض أو خروج مبكر
      if (src.startsWith('blob:') || src.startsWith('data:')) {
        // # HTTP — طلب إلى API
        const res = await fetch(src);
        triggerBlob(await res.blob());
        // # return — إرجاع النتيجة
        return true;
      }
      // # try — معالجة عملية قد تفشل
      try {
        // # HTTP — طلب إلى API
        const direct = await fetch(src, { mode: 'cors' });
        // # guard — شرط رفض أو خروج مبكر
        if (direct.ok) {
          triggerBlob(await direct.blob());
          // # return — إرجاع النتيجة
          return true;
        }
      } catch (_) { /* proxy fallback */ }

      const headers = getDubbingApiAuthHeaders();
      // # guard — شرط رفض أو خروج مبكر
      if (!headers) return false;
      const API = normalizeApiBaseUrl();
      const proxyUrl =
        `${API}/api/tts/download?url=${encodeURIComponent(src)}&filename=${encodeURIComponent(name)}`;
      // # HTTP — طلب إلى API
      const res = await fetch(proxyUrl, { headers });
      // # guard — شرط رفض أو خروج مبكر
      if (!res.ok) return false;
      // # block — طلب HTTP/API
      triggerBlob(await res.blob());
      // # return — إرجاع النتيجة
      return true;
    } catch (e) {
      console.warn('[dubbing] download failed:', e);
      return false;
    }
  }

  // # FN deleteRecentDubbingJob
  // # AR مهام المعالجة (deleteRecentDubbingJob)
  // # KW مهمة,job,polling,celery,worker
  async function deleteRecentDubbingJob(job) {
    const headers = getDubbingApiAuthHeaders();
    // # guard — شرط رفض أو خروج مبكر
    if (!headers) return false;
    const API = normalizeApiBaseUrl();
    // # try — معالجة عملية قد تفشل
    try {
      // # HTTP — طلب إلى API
      const res = await fetch(
        // # block — طلب HTTP/API
        `${API}/api/user/files/${encodeURIComponent(job.type || 'dubbing')}/${encodeURIComponent(String(job.id))}`,
        { method: 'DELETE', headers }
      );
      // # parse — قراءة JSON من الاستجابة
      const data = await res.json().catch(() => ({}));
      // # return — إرجاع النتيجة
      return res.ok && data.success !== false;
    } catch (_) {
      // # block — parse/serialize JSON
      return false;
    }
  }

  // # FN reuseRecentDubbingJobIntoStudio
  // # AR تحميل فيديو من Recent Works أعلى الصفحة لدبلجته بلغة ثانية
  // # KW مهمة,job,polling,celery,worker
  async function reuseRecentDubbingJobIntoStudio(job, btn) {
    const src = String(job?.media_url || job?.output_url || '').trim();
    // # guard — رفض/خروج
    if (!src) {
      global.showToast?.('No media available to reuse', 'error');
      return;
    }
    // # شرط
    if (btn) btn.disabled = true;
    // # try — عملية قد تفشل
    try {
      let blob = null;
      // # try — عملية قد تفشل
      try {
        // # HTTP — طلب API
        const direct = await fetch(src, { mode: 'cors' });
        // # شرط
        if (direct.ok) blob = await direct.blob();
      // # block — طلب HTTP/API
      } catch (_) { /* proxy fallback */ }
      // # guard — رفض/خروج
      if (!blob) {
        const headers = getDubbingApiAuthHeaders();
        // # guard — رفض/خروج
        if (!headers) throw new Error('Please sign in first');
        const API = normalizeApiBaseUrl();
        const proxyUrl =
          // # block — توليد صوت TTS
          `${API}/api/tts/download?url=${encodeURIComponent(src)}&filename=${encodeURIComponent('reuse.mp4')}`;
        // # HTTP — طلب API
        const res = await fetch(proxyUrl, { headers });
        // # guard — رفض/خروج
        if (!res.ok) throw new Error('Could not load media for reuse');
        blob = await res.blob();
      }
      const type = (blob.type || '').trim() || 'video/mp4';
      // # block — طلب HTTP/API
      const extMatch = src.split('?')[0].match(/\.(mp4|mov|webm|mkv|wav|mp3|m4a)$/i);
      const ext = extMatch ? extMatch[1].toLowerCase() : (type.startsWith('audio/') ? 'mp3' : 'mp4');
      const file = new File([blob], `reuse-${String(job.id || 'media').slice(0, 8)}.${ext}`, { type });
      DubbingApp.mediaInput?.applySelectedMediaFileToPreviewUi?.(file);
      const studio = document.getElementById('dropZone') || document.querySelector('.controls-row') || document.body;
      studio?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
      // # block — تحديث واجهة/DOM
      global.showToast?.(
        'Video loaded for reuse — pick another language and start dubbing',
        'success',
      );
    } catch (err) {
      console.warn('[dubbing] reuse failed:', err);
      // # block — معالجة أخطاء
      global.showToast?.(err?.message || 'Reuse failed — try again', 'error');
    } finally {
      // # شرط
      if (btn) btn.disabled = false;
    }
  }

  // # FN bindRecentDubDownloadButtons
  // # KW مهمة,job,polling,celery,worker
  function bindRecentDubDownloadButtons() {
    const grid = document.getElementById('recentJobsGrid');
    // # guard — شرط رفض أو خروج مبكر
    if (!grid || recentDownloadBound) return;
    recentDownloadBound = true;
    grid.addEventListener('click', async (e) => {
      const dlBtn = e.target.closest('.dub-download-btn');
      // # block — تحديث واجهة/DOM
      const delBtn = e.target.closest('.rjc-del-btn');
      const reuseBtn = e.target.closest('.rjc-reuse-btn');
      // # guard — شرط رفض أو خروج مبكر
      if (!dlBtn && !delBtn && !reuseBtn) return;
      e.preventDefault();
      e.stopPropagation();

      // # شرط — فرع منطقي
      if (dlBtn) {
        // # block — فرع شرطي
        const idx = Number(dlBtn.getAttribute('data-idx'));
        // # block — فرع شرطي
        const job = recentJobsForDownload[idx];
        const url = job?.output_url || '';
        // # guard — شرط رفض أو خروج مبكر
        if (!url) return;
        dlBtn.disabled = true;
        const ok = await downloadDubbingFile(url, downloadFilenameForJob(job));
        // # block — فرع شرطي
        dlBtn.disabled = false;
        // # شرط — فرع منطقي
        if (ok) global.showToast?.('Download started', 'success');
        else global.showToast?.('Download failed — try again', 'error');
      }

      // # guard — رفض/خروج
      if (reuseBtn) {
        const idx = Number(reuseBtn.getAttribute('data-idx'));
        // # block — معالجة أخطاء
        const job = recentJobsForDownload[idx];
        // # guard — رفض/خروج
        if (!job) return;
        await reuseRecentDubbingJobIntoStudio(job, reuseBtn);
      }

      // # guard — شرط رفض أو خروج مبكر
      if (delBtn) {
        const idx = Number(delBtn.getAttribute('data-idx'));
        // # block — فرع شرطي
        const job = recentJobsForDownload[idx];
        // # guard — شرط رفض أو خروج مبكر
        if (!job) return;
        // # guard — شرط رفض أو خروج مبكر
        if (!confirm('Permanently delete this project? This action cannot be undone.')) return;
        delBtn.disabled = true;
        const ok = await deleteRecentDubbingJob(job);
        // # شرط — فرع منطقي
        if (ok) {
          // # block — فرع شرطي
          global.showToast?.('Deleted', 'success');
          // # block — فرع شرطي
          const updated = recentJobsForDownload.filter((_, i) => i !== idx);
          renderRecentDubbingJobsGrid(updated);
          const section = document.getElementById('recentJobsSection');
          // # شرط — فرع منطقي
          if (section && updated.length === 0) section.style.display = 'none';
        } else {
          // # block — تحديث واجهة/DOM
          delBtn.disabled = false;
          // # block — تحديث واجهة/DOM
          global.showToast?.('Delete failed — try again', 'error');
        }
      }
    });
  }

  const WAVEFORM_SVG = '<svg class="rjc-waveform-svg" viewBox="0 0 200 48" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg" fill="rgba(255,255,255,0.45)" aria-hidden="true"><rect x="2" y="20" width="6" height="8" rx="3"/><rect x="12" y="15" width="6" height="18" rx="3"/><rect x="22" y="10" width="6" height="28" rx="3"/><rect x="32" y="6" width="6" height="36" rx="3"/><rect x="42" y="13" width="6" height="22" rx="3"/><rect x="52" y="3" width="6" height="42" rx="3"/><rect x="62" y="8" width="6" height="32" rx="3"/><rect x="72" y="1" width="6" height="46" rx="3"/><rect x="82" y="10" width="6" height="28" rx="3"/><rect x="92" y="5" width="6" height="38" rx="3"/><rect x="102" y="14" width="6" height="20" rx="3"/><rect x="112" y="2" width="6" height="44" rx="3"/><rect x="122" y="7" width="6" height="34" rx="3"/><rect x="132" y="3" width="6" height="42" rx="3"/><rect x="142" y="11" width="6" height="26" rx="3"/><rect x="152" y="5" width="6" height="38" rx="3"/><rect x="162" y="12" width="6" height="24" rx="3"/><rect x="172" y="9" width="6" height="30" rx="3"/><rect x="182" y="15" width="6" height="18" rx="3"/><rect x="192" y="20" width="6" height="8" rx="3"/></svg>';

  // # FN renderRecentDubbingJobsGrid
  // # KW مهمة,job,polling,celery,worker
  function renderRecentDubbingJobsGrid(jobs) {
    const container = document.getElementById('recentJobsGrid');
    // # guard — شرط رفض أو خروج مبكر
    if (!container) return;
    const escape = DubbingApp.voiceHtml.escapeHtmlForVoiceCardLabels;
    recentJobsForDownload = jobs || [];
    bindRecentDubDownloadButtons();

    // # block — معالجة صوت/استنساخ
    container.innerHTML = jobs
      .map((job, idx) => {
        const status = DubbingApp.jobStatus.normalizeDubbingJobStatus(job.status);
        const dateLabel = escape(formatCreationDateLabel(job.created_at));
        const timeAgo = formatRelativeTimeAgoLabel(job.created_at);
        const url = job.output_url || '';

        // # شرط — فرع منطقي
        if (status === 'completed' && url) {
          const isAudio = /\.(wav|mp3|m4a|aac|ogg)(\?|$)/i.test(url);
          let mediaHtml = '';
          const dlOverlay = `<button type="button" class="dub-download-btn" data-idx="${idx}" title="Download" aria-label="Download"><i class="fa-solid fa-download"></i></button>`;
          // # شرط — فرع منطقي
          if (isAudio) {
            mediaHtml = `<div class="rjc-audio-wrap">${dlOverlay}${WAVEFORM_SVG}<audio src="${escape(url)}" controls crossorigin="anonymous" preload="metadata" class="rjc-audio-native"></audio></div>`;
          // # block — فرع شرطي
          } else {
            // # block — فرع شرطي
            const skelId = `sk-${idx}`;
            const hideSkel = `var s=document.getElementById('${skelId}');if(s)s.remove()`;
            mediaHtml = `<div class="rjc-video-wrap"><div class="rjc-skeleton" id="${skelId}"></div>${dlOverlay}<video src="${escape(url)}" controls controlsList="nodownload" crossorigin="anonymous" preload="metadata" onloadeddata="${hideSkel}" onerror="${hideSkel}"></video></div>`;
          }
          // # return — إرجاع النتيجة
          return `<div class="recent-job-card">
            <button type="button" class="rjc-del-btn" data-idx="${idx}" title="Delete this project" aria-label="Delete"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg></button>
            ${mediaHtml}
            <div class="recent-job-meta">
              <div class="recent-job-meta-info">
                <div class="recent-job-date">${dateLabel}</div>
                ${timeAgo ? `<div class="recent-job-ago">${escape(timeAgo)}</div>` : ''}
              </div>
              <button type="button" class="rjc-reuse-btn" data-idx="${idx}" title="Reuse this video to dub in another language" aria-label="Reuse">
                <i class="fa-solid fa-rotate-right" aria-hidden="true"></i> Reuse
              </button>
            </div>
          </div>`;
        // # block — تنفيذ منطق — راجع الأسطر التالية
        }

        // # return — إرجاع النتيجة
        return `<div class="recent-job-card">
          <div class="recent-job-status">
            <i class="fa-solid fa-circle-notch fa-spin"></i>
            <span>${escape(status)}</span>
          </div>
          <div class="recent-job-date" style="margin-top:8px;">${dateLabel}</div>
          ${timeAgo ? `<div class="recent-job-ago">${escape(timeAgo)}</div>` : ''}
        </div>`;
      })
      .join('');

    const section = document.getElementById('recentJobsSection');
    // # شرط — فرع منطقي
    if (section) section.style.display = 'block';
  }

  // # FN loadAndRenderRecentDubbingJobs
  // # KW مهمة,job,polling,celery,worker
  async function loadAndRenderRecentDubbingJobs(retryCount = 0) {
    // Ephemeral dubbing: no Recent Works / history grid (session cinema only).
    // # شرط
    if (DubbingApp.api?.isEphemeralDubbingEnabled?.()) {
      // # شرط
      if (recentPollTimer) clearInterval(recentPollTimer);
      recentPollTimer = null;
      recentJobsForDownload = [];
      const section = document.getElementById('recentJobsSection');
      // # guard — رفض/خروج
      if (section) section.style.display = 'none';
      return;
    }
    const grid = document.getElementById('recentJobsGrid');
    const headers = getDubbingApiAuthHeaders();
    // # guard — شرط رفض أو خروج مبكر
    if (!headers) {
      // # guard — شرط رفض أو خروج مبكر
      if (retryCount < 6) {
        setTimeout(() => loadAndRenderRecentDubbingJobs(retryCount + 1), 1500);
        // # return — إرجاع النتيجة
        return;
      }
      // # شرط — فرع منطقي
      if (grid) {
        grid.innerHTML =
          // # block — معالجة أخطاء
          '<div style="grid-column:1/-1;text-align:center;padding:24px;">Sign in to see recent works</div>';
      }
      // # return — إرجاع النتيجة
      return;
    }
    // # try — معالجة عملية قد تفشل
    try {
      // # HTTP — طلب إلى API
      const res = await fetch(`${normalizeApiBaseUrl()}/api/user/files`, { headers });
      // # parse — قراءة JSON من الاستجابة
      const data = await res.json().catch(() => ({}));
      const files = data.success && Array.isArray(data.files) ? data.files : [];
      // # block — طلب HTTP/API
      let dubFiles = files
        .filter((f) => f.type === 'dubbing')
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      // # شرط — فرع منطقي
      if (dubFiles.length > 5) {
        // # block — فرع شرطي
        const toDelete = dubFiles.slice(5).map((f) => ({ type: f.type, id: String(f.id) }));
        dubFiles = dubFiles.slice(0, 5);
        // # HTTP — طلب fetch
        fetch(`${normalizeApiBaseUrl()}/api/user/files/bulk-delete`, {
          method: 'POST',
          headers: { ...headers, 'Content-Type': 'application/json' },
          // # تسلسل JSON للطلب
          body: JSON.stringify({ items: toDelete }),
        // # block — طلب HTTP/API
        }).catch(() => {});
      }
      // # block — parse/serialize JSON
      const toRender = dubFiles.slice(0, 5);
      // # شرط — فرع منطقي
      if (toRender.length > 0) {
        renderRecentDubbingJobsGrid(toRender);
        scheduleRecentJobsPollingIfNeeded(toRender);
      // # block — فرع شرطي
      } else if (grid) {
        grid.innerHTML =
          // # block — فرع شرطي
          '<div style="grid-column:1/-1;text-align:center;padding:24px;color:#9ca3af;">No recent dubbing works yet</div>';
      }
    } catch (err) {
      console.warn('[dubbing] recent jobs load failed', err);
      // # شرط — فرع منطقي
      if (grid) {
        grid.innerHTML =
          // # block — معالجة أخطاء
          '<div style="grid-column:1/-1;text-align:center;padding:24px;">Could not load recent works</div>';
      }
    }
  }

  // Optimistically prepend a just-completed job before the API indexes it.
  // Prevents the 1.5–4s window where the user sees stale history.
  // # FN prependCompletedJobToGrid
  // # AR prepend completed job to grid (prependCompletedJobToGrid)
  // # KW مهمة,job,polling,celery,worker
  function prependCompletedJobToGrid(job) {
    // # guard — رفض/خروج
    if (DubbingApp.api?.isEphemeralDubbingEnabled?.()) return;
    // # guard — شرط رفض أو خروج مبكر
    if (!job || !job.output_url) return;
    // Deduplicate: don't add the same URL twice if called multiple times
    const alreadyPresent = recentJobsForDownload.some((j) => j.output_url === job.output_url);
    // # guard — شرط رفض أو خروج مبكر
    if (alreadyPresent) return;
    const updated = [job, ...recentJobsForDownload].slice(0, 5);
    // # block — فرع شرطي
    renderRecentDubbingJobsGrid(updated);
  }

  DubbingApp.recentJobs = { loadAndRenderRecentDubbingJobs, prependCompletedJobToGrid };
  global.getRelativeTime = formatRelativeTimeAgoLabel;
  global.renderRecentJobs = renderRecentDubbingJobsGrid;
  global.loadRecentDubbingJobs = loadAndRenderRecentDubbingJobs;
})(window);