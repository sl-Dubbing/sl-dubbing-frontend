// # FILE frontend/sl-dubbing-frontend-main/js/video-creation/01-process.js
// # AR Image Studio: تقدير تكلفة + توليد فيديو حديث (ElevenLabs + Wav2Lip)
// # KW صورة,فيديو,نقاط,credits,elevenlabs
(function (global) {
  const STORAGE_KEY = 'glotix_image_studio_results';
  let _estimateTimer = null;

  // # FN apiBase
  // # AR API base URL
  // # KW عام,general
  function apiBase() {
    return String(global.API_BASE || 'https://api.glotix.ai')
      .replace(/\/$/, '')
      .replace(/([^:]\/)\/+/g, '$1');
  }

  // # FN escapeHtml
  // # KW عام,general
  function escapeHtml(text) {
    return String(text || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // # FN formatTime
  // # KW عام,general
  function formatTime(iso) {
    // # try — عملية قد تفشل
    try {
      return new Date(iso).toLocaleString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        day: 'numeric',
        // # block — معالجة أخطاء
        month: 'short',
      });
    } catch (_) {
      return '';
    }
  }

  // # FN loadResults
  // # KW عام,general
  function loadResults() {
    // # try — عملية قد تفشل
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
      // # block — تحديث واجهة/DOM
      return [];
    }
  }

  // # FN saveResults
  // # KW عام,general
  function saveResults(items) {
    // # try — عملية قد تفشل
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, 50)));
    } catch (_) {}
  }

  // # FN setCostHint
  // # KW عام,general
  function setCostHint(text) {
    const el = document.getElementById('costEstimate');
    // # guard — رفض/خروج
    if (!el) return;
    el.textContent = text || '';
  }

  // # FN renderResultsList
  // # AR عرض قائمة النتائج (فيديو أو نص)
  // # KW عام,general
  function renderResultsList() {
    const list = document.getElementById('resultsList');
    const empty = document.getElementById('resultsEmpty');
    // # guard — رفض/خروج
    if (!list) return;

    const items = loadResults();
    // # شرط
    if (empty) empty.style.display = items.length ? 'none' : 'block';
    // # block — تحديث واجهة/DOM
    list.innerHTML = '';

    items.forEach(function (item) {
      const card = document.createElement('article');
      card.className = 'result-item';
      const credits =
        item.creditsCharged != null
          // # block — نقاط/credits
          ? '<span class="result-credits">' +
            escapeHtml(String(item.creditsCharged)) +
            ' credits</span>'
          : '';
      let bodyHtml = '';
      // # شرط
      if (item.videoUrl) {
        // # block — نقاط/credits
        bodyHtml =
          '<video class="result-video" controls playsinline src="' +
          escapeHtml(item.videoUrl) +
          '"></video>' +
          '<p class="result-speech">' +
          escapeHtml(item.speechText || item.prompt || '') +
          // # block — تنفيذ منطق — راجع الأسطر التالية
          '</p>' +
          (item.videoUrl
            ? '<a class="result-download" href="' +
              escapeHtml(item.videoUrl) +
              '" target="_blank" rel="noopener">Download video</a>'
            : '');
      // # block — تنفيذ منطق — راجع الأسطر التالية
      } else {
        bodyHtml = escapeHtml(item.response || '');
      }
      card.innerHTML =
        '<div class="result-head">' +
        '<img class="result-thumb" src="' +
        // # block — تنفيذ منطق — راجع الأسطر التالية
        escapeHtml(item.imageDataUrl) +
        '" alt="">' +
        '<div class="result-meta">' +
        '<span class="result-time">' +
        escapeHtml(formatTime(item.createdAt)) +
        '</span>' +
        // # block — نقاط/credits
        credits +
        '<p class="result-prompt">' +
        escapeHtml(item.prompt) +
        '</p>' +
        '</div>' +
        '</div>' +
        // # block — تنفيذ منطق — راجع الأسطر التالية
        '<div class="result-body">' +
        bodyHtml +
        '</div>';
      list.appendChild(card);
    });
  }

  // # FN addResultToList
  // # KW عام,general
  function addResultToList(entry) {
    const items = loadResults();
    items.unshift(entry);
    saveResults(items);
    renderResultsList();
  }

  // # FN previewImage
  // # KW عام,general
  function previewImage(event) {
    const file = event.target.files && event.target.files[0];
    // # guard — رفض/خروج
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function () {
      const preview = document.getElementById('imagePreview');
      // # guard — رفض/خروج
      if (!preview) return;
      preview.src = reader.result;
      preview.style.display = 'block';
    };
    reader.readAsDataURL(file);
    scheduleCostEstimate();
  }

  // # FN clearResultsList
  // # KW عام,general
  function clearResultsList() {
    // # guard — رفض/خروج
    if (!confirm('Clear all results from the list?')) return;
    saveResults([]);
    renderResultsList();
  }

  // # FN authHeaders
  // # KW مصادقة,auth,JWT,supabase
  async function authHeaders() {
    // # guard — رفض/خروج
    if (typeof global.refreshApiAuthHeadersFromSupabase === 'function') {
      return global.refreshApiAuthHeadersFromSupabase();
    }
    // # guard — رفض/خروج
    if (typeof global.getApiAuthHeaders === 'function') {
      return global.getApiAuthHeaders();
    // # block — فرع شرطي
    }
    return null;
  }

  // # FN scheduleCostEstimate
  // # KW عام,general
  function scheduleCostEstimate() {
    // # شرط
    if (_estimateTimer) clearTimeout(_estimateTimer);
    _estimateTimer = setTimeout(refreshCostEstimate, 450);
  }

  // # FN refreshCostEstimate
  // # AR تحديث عرض التكلفة من /api/image/to-video/estimate
  // # KW عام,general
  async function refreshCostEstimate() {
    const promptInput = document.getElementById('videoPrompt');
    const prompt = promptInput ? promptInput.value.trim() : '';
    // # guard — رفض/خروج
    if (!prompt) {
      setCostHint('Estimated cost appears after you enter speech text.');
      return;
    // # block — تحديث واجهة/DOM
    }
    const headers = await authHeaders();
    // # guard — رفض/خروج
    if (!headers) {
      setCostHint('Log in to see credit estimate.');
      return;
    }
    // # try — عملية قد تفشل
    try {
      // # HTTP — طلب API
      const res = await fetch(apiBase() + '/api/image/to-video/estimate', {
        method: 'POST',
        headers: Object.assign({ 'Content-Type': 'application/json' }, headers),
        body: JSON.stringify({ prompt: prompt }),
      });
      // # block — طلب HTTP/API
      const data = await res.json().catch(function () {
        return {};
      });
      // # guard — رفض/خروج
      if (!res.ok || !data.success) {
        // # guard — رفض/خروج
        if (res.status === 401) {
          setCostHint('Log in to see credit estimate.');
          // # block — نقاط/credits
          return;
        }
        setCostHint((data && data.error) || 'Could not estimate cost.');
        return;
      }
      const tts = data.elevenlabs_tts_credits != null ? data.elevenlabs_tts_credits : '?';
      // # block — نقاط/credits
      const lip = data.lipsync_credits != null ? data.lipsync_credits : '?';
      const total = data.credits != null ? data.credits : '?';
      const markup =
        data.profit_markup != null
          ? ' (+' + Math.round((Number(data.profit_markup) - 1) * 100) + '% Glotix margin)'
          : '';
      // # block — نقاط/credits
      setCostHint(
        'Est. ' +
          total +
          ' credits — ElevenLabs TTS ' +
          tts +
          ' + lipsync ' +
          // # block — نقاط/credits
          lip +
          markup
      );
    } catch (e) {
      setCostHint('Could not estimate cost.');
    }
  }

  // # FN processImageToVideo
  // # AR رفع صورة + برومبت → فيديو حديث مع خصم كريدت
  // # KW عام,general
  async function processImageToVideo() {
    const imageInput = document.getElementById('imageInput');
    const promptInput = document.getElementById('videoPrompt');
    const btn = document.getElementById('generateBtn');
    const loading = document.getElementById('loading');

    const imageFile = imageInput && imageInput.files && imageInput.files[0];
    // # block — تحديث واجهة/DOM
    const prompt = promptInput ? promptInput.value.trim() : '';

    // # guard — رفض/خروج
    if (!imageFile) {
      alert('Please upload an image first.');
      return;
    }
    // # guard — رفض/خروج
    if (!prompt) {
      // # block — رفع أو تخزين ملف
      alert('Please enter what the person should say (or a quoted line).');
      return;
    }

    const headers = await authHeaders();
    // # guard — رفض/خروج
    if (!headers) {
      alert('Please log in to use this feature.');
      // # guard — رفض/خروج
      if (typeof global.location !== 'undefined') global.location.href = '/login';
      return;
    }

    btn.disabled = true;
    // # شرط
    if (loading) {
      loading.style.display = 'block';
      // # block — تحديث واجهة/DOM
      loading.textContent = 'Generating speech (ElevenLabs) and talking video — this may take a minute…';
    }

    const imageDataUrl = await new Promise(function (resolve, reject) {
      const reader = new FileReader();
      reader.onload = function () {
        resolve(reader.result);
      // # block — تنفيذ منطق — راجع الأسطر التالية
      };
      reader.onerror = reject;
      reader.readAsDataURL(imageFile);
    });

    const form = new FormData();
    form.append('image', imageFile);
    // # block — تنفيذ منطق — راجع الأسطر التالية
    form.append('prompt', prompt);

    // # try — عملية قد تفشل
    try {
      // # HTTP — طلب API
      const res = await fetch(apiBase() + '/api/image/to-video', {
        method: 'POST',
        headers: headers,
        body: form,
      // # block — طلب HTTP/API
      });

      const data = await res.json().catch(function () {
        return {};
      });

      // # شرط
      if (!res.ok || !data.success) {
        // # شرط
        if (res.status === 402 || data.error === 'INSUFFICIENT_CREDITS') {
          // # block — نقاط/credits
          const msg =
            'Not enough credits. Required: ' +
            (data.required != null ? data.required : '?') +
            ' (balance: ' +
            (data.balance != null ? data.balance : '?') +
            ').';
          // # شرط
          if (typeof global.showCreditsModal === 'function') {
            global.showCreditsModal(msg);
          } else {
            alert(msg);
          }
          throw new Error(msg);
        // # block — نقاط/credits
        }
        const msg =
          (data && data.error) ||
          (typeof global.parseApiErrorMessage === 'function'
            ? global.parseApiErrorMessage(data, res.status)
            : null) ||
          // # block — تنفيذ منطق — راجع الأسطر التالية
          'Talking video generation failed.';
        throw new Error(msg);
      }

      const videoUrl = (data.video_url || data.url || '').trim();
      addResultToList({
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
        // # block — معالجة أخطاء
        createdAt: new Date().toISOString(),
        prompt: prompt,
        speechText: data.speech_text || prompt,
        videoUrl: videoUrl,
        creditsCharged: data.credits_charged,
        response: videoUrl ? '' : data.response || '',
        // # block — نقاط/credits
        imageDataUrl: imageDataUrl,
      });

      // # شرط
      if (promptInput) promptInput.value = '';
      setCostHint('Estimated cost appears after you enter speech text.');
      // # شرط
      if (loading) loading.style.display = 'none';

      const section = document.getElementById('resultsSection');
      // # شرط
      if (section) section.scrollIntoView({ behavior: 'smooth', block: 'start' });

      // # شرط
      if (typeof global.refreshCreditsDisplay === 'function') {
        // # try — عملية قد تفشل
        try {
          global.refreshCreditsDisplay();
        } catch (_) {}
      }
    // # block — نقاط/credits
    } catch (error) {
      console.error('Image to video error:', error);
      alert(error.message || 'Processing failed. Please try again.');
      // # شرط
      if (loading) loading.style.display = 'none';
    } finally {
      btn.disabled = false;
    // # block — تحديث واجهة/DOM
    }
  }

  // # FN processImagePrompt
  // # AR مسار Gemini النصي (اختياري — Ask about photo)
  // # KW عام,general
  async function processImagePrompt() {
    const imageInput = document.getElementById('imageInput');
    const promptInput = document.getElementById('videoPrompt');
    const loading = document.getElementById('loading');

    const imageFile = imageInput && imageInput.files && imageInput.files[0];
    const prompt = promptInput ? promptInput.value.trim() : '';

    // # guard — رفض/خروج
    if (!imageFile) {
      alert('Please upload an image first.');
      return;
    }
    // # guard — رفض/خروج
    if (!prompt) {
      alert('Please enter a prompt or instruction.');
      // # block — رفع أو تخزين ملف
      return;
    }

    const headers = await authHeaders();
    // # guard — رفض/خروج
    if (!headers) {
      alert('Please log in to use this feature.');
      // # guard — رفض/خروج
      if (typeof global.location !== 'undefined') global.location.href = '/login';
      // # block — فرع شرطي
      return;
    }

    // # شرط
    if (loading) {
      loading.style.display = 'block';
      loading.textContent = 'Asking Glotix AI about your image…';
    }

    // # block — تحديث واجهة/DOM
    const imageDataUrl = await new Promise(function (resolve, reject) {
      const reader = new FileReader();
      reader.onload = function () {
        resolve(reader.result);
      };
      reader.onerror = reject;
      // # block — تنفيذ منطق — راجع الأسطر التالية
      reader.readAsDataURL(imageFile);
    });

    const form = new FormData();
    form.append('image', imageFile);
    form.append('prompt', prompt);

    // # try — عملية قد تفشل
    try {
      // # HTTP — طلب API
      const res = await fetch(apiBase() + '/api/image/process', {
        method: 'POST',
        headers: headers,
        body: form,
      });

      const data = await res.json().catch(function () {
        // # block — parse/serialize JSON
        return {};
      });

      // # شرط
      if (!res.ok || !data.success) {
        const msg =
          (data && data.error) ||
          (typeof global.parseApiErrorMessage === 'function'
            // # block — فرع شرطي
            ? global.parseApiErrorMessage(data, res.status)
            : null) ||
          'Something went wrong while processing your image.';
        throw new Error(msg);
      }

      addResultToList({
        // # block — معالجة أخطاء
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
        createdAt: new Date().toISOString(),
        prompt: prompt,
        response: (data.response || '').trim(),
        imageDataUrl: imageDataUrl,
      });

      // # شرط
      if (loading) loading.style.display = 'none';
      const section = document.getElementById('resultsSection');
      // # شرط
      if (section) section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (error) {
      console.error('Image process error:', error);
      alert(error.message || 'Processing failed. Please try again.');
      // # شرط
      if (loading) loading.style.display = 'none';
    }
  }

  // # FN initResultsList
  // # KW عام,general
  function initResultsList() {
    renderResultsList();
    const promptInput = document.getElementById('videoPrompt');
    // # شرط
    if (promptInput) {
      promptInput.addEventListener('input', scheduleCostEstimate);
    }
    // # block — تحديث واجهة/DOM
    setCostHint('Estimated cost appears after you enter speech text.');
  }

  global.previewImage = previewImage;
  global.processImageToVideo = processImageToVideo;
  global.processImagePrompt = processImagePrompt;
  global.clearResultsList = clearResultsList;
  global.initImageStudioResults = initResultsList;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initResultsList);
  } else {
    initResultsList();
  }
})(window);
