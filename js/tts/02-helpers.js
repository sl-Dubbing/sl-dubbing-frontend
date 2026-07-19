// # FILE frontend/sl-dubbing-frontend-main/js/tts/02-helpers.js
// # AR واجهة TTS
// # KW توليد_صوت,TTS
// # CONVENTION — FN/AR/KW + # block كل ~6 أسطر — FUNCTION_INDEX.md DOMAIN_INDEX.md
// =====================================================================
// 📒 فهرس الدوال — js/tts/02-helpers.js
// ---------------------------------------------------------------------
//  إنشاء_علم_اللغة           → createTtsFlagImg
//  تحويل_data_URL_إلى_Blob   → dataUrlToBlobUrl
//  مفتاح_تخزين_الصوت_المخصص  → getTtsUserVoiceStorageKey
//  تطبيع_رمز_لغة_TTS         → normalizeTtsLangCode
//  تنسيق_الوقت_بالدقائق      → formatAudioTimeMmSs
//  تهريب_HTML                → escapeHtmlForTtsUi
//  وقت_نسبي_للعرض            → formatRelativeTimeAgo
//  تطبيع_رابط_API            → normalizeTtsApiBaseUrl
// =====================================================================
(function (global) {
  const TtsApp = global.TtsApp;

  /** إنشاء_علم_اللغة — مثلث 5.png خلف العلم (logo.css .lang-flag-shell) */
  // # FN createTtsFlagImg
  // # AR Text-to-speech (createTtsFlagImg)
  // # KW توليد_صوت,TTS,synthesis
  function createTtsFlagImg(code) {
    let country = code.split('-')[1];
    // # شرط — فرع منطقي
    if (!country) {
      const defaultMap = global.LANG_FLAG_COUNTRY || {
        ar: 'sa', en: 'us', fr: 'fr', es: 'es', pt: 'pt', zh: 'cn',
        de: 'de', it: 'it', ru: 'ru', tr: 'tr', ja: 'jp', ko: 'kr',
        // # block — معالجة أخطاء
        hi: 'in', nl: 'nl', pl: 'pl', sv: 'se', id: 'id',
        bg: 'bg', hr: 'hr', cs: 'cz', da: 'dk', fil: 'ph', fi: 'fi',
        el: 'gr', hu: 'hu', ms: 'my', no: 'no', ro: 'ro', sk: 'sk',
        ta: 'in', uk: 'ua', vi: 'vn',
      };
      country = defaultMap[code.split('-')[0]] || 'us';
    // # block — معالجة أخطاء
    }
    // # block — تحديث واجهة/DOM
    const shell = document.createElement('span');
    shell.className = 'lang-flag-shell';
    shell.style.setProperty('--flag-size', '18px');
    const img = document.createElement('img');
    img.className = 'lang-flag';
    // # block — تحديث واجهة/DOM
    img.src = 'https://hatscripts.github.io/circle-flags/flags/' + country.toLowerCase() + '.svg';
    img.alt = '';
    shell.appendChild(img);
    // # return — إرجاع النتيجة
    return shell;
  }

  // # FN _triggerBlobDownload
  // # KW توليد_صوت,TTS,synthesis
  function _triggerBlobDownload(blob, filename) {
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = filename || 'Glotix_TTS.mp3';
    a.rel = 'noopener';
    // # block — توليد صوت TTS
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => {
      // # try — معالجة عملية قد تفشل
      try {
        // # block — معالجة أخطاء
        URL.revokeObjectURL(blobUrl);
      } catch (_) { /* ignore */ }
    }, 2000);
  }

  // # FN _dataUrlToBlob
  // # AR Text-to-speech (_dataUrlToBlob)
  // # KW توليد_صوت,TTS,synthesis
  function _dataUrlToBlob(dataUrl) {
    const arr = String(dataUrl || '').split(',');
    const mime = (arr[0].match(/:(.*?);/) || [])[1] || 'audio/mpeg';
    const raw = atob(arr[1]);
    const buf = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) buf[i] = raw.charCodeAt(i);
    // # return — إرجاع النتيجة
    return new Blob([buf], { type: mime });
  }

  /** تنزيل_ملف_الصوت — يعمل مع data: و blob: وروابط R2 عبر proxy */
  // # FN downloadTtsAudioFile
  // # KW توليد_صوت,TTS,synthesis
  async function downloadTtsAudioFile(url, filename) {
    const name = String(filename || 'Glotix_TTS_' + Date.now() + '.mp3');
    const src = String(url || '').trim();
    // # guard — شرط رفض أو خروج مبكر
    if (!src) return false;

    // # try — معالجة عملية قد تفشل
    try {
      // # guard — شرط رفض أو خروج مبكر
      if (src.startsWith('data:')) {
        // # block — توليد صوت TTS
        _triggerBlobDownload(_dataUrlToBlob(src), name);
        // # return — إرجاع النتيجة
        return true;
      }
      // # guard — شرط رفض أو خروج مبكر
      if (src.startsWith('blob:')) {
        // # HTTP — طلب إلى API
        const res = await fetch(src);
        _triggerBlobDownload(await res.blob(), name);
        // # return — إرجاع النتيجة
        return true;
      }
      // # try — معالجة عملية قد تفشل
      try {
        // # HTTP — طلب إلى API
        const direct = await fetch(src, { mode: 'cors' });
        // # guard — شرط رفض أو خروج مبكر
        if (direct.ok) {
          _triggerBlobDownload(await direct.blob(), name);
          // # return — إرجاع النتيجة
          return true;
        }
      } catch (_) { /* try API proxy */ }

      let headers =
        typeof global.refreshApiAuthHeadersFromSupabase === 'function'
          ? await global.refreshApiAuthHeadersFromSupabase()
          // # block — معالجة أخطاء
          : null;
      // # guard — شرط رفض أو خروج مبكر
      if (!headers && typeof global.getApiAuthHeaders === 'function') {
        headers = global.getApiAuthHeaders();
      }
      // # guard — شرط رفض أو خروج مبكر
      if (!headers) return false;

      const API = normalizeTtsApiBaseUrl();
      // # block — توليد صوت TTS
      const proxyUrl =
        `${API}/api/tts/download?url=${encodeURIComponent(src)}&filename=${encodeURIComponent(name)}`;
      // # HTTP — طلب إلى API
      const res = await fetch(proxyUrl, { headers });
      // # guard — شرط رفض أو خروج مبكر
      if (!res.ok) return false;
      _triggerBlobDownload(await res.blob(), name);
      // # return — إرجاع النتيجة
      return true;
    // # block — طلب HTTP/API
    } catch (e) {
      console.error('[tts] download failed:', e);
      return false;
    }
  }

  /** تحويل_data_URL_إلى_Blob — لتشغيل الصوت في المتصفح */
  // # FN dataUrlToBlobUrl
  // # KW توليد_صوت,TTS,synthesis
  function dataUrlToBlobUrl(dataUrl) {
    // # try — معالجة عملية قد تفشل
    try {
      // # return — إرجاع النتيجة
      return URL.createObjectURL(_dataUrlToBlob(dataUrl));
    } catch (e) {
      // # return — إرجاع النتيجة
      return dataUrl;
    }
  }

  // # localStorage — تخزين محلي
  /** مفتاح_تخزين_الصوت_المخصص — لكل مستخدم في localStorage */
  // # FN getTtsUserVoiceStorageKey
  // # AR الصوت والاستنساخ (getTtsUserVoiceStorageKey)
  // # KW صوت,استنساخ,voice,clone,sample,رفع,upload,R2,storage,توليد_صوت,TTS,synthesis
  function getTtsUserVoiceStorageKey() {
    // # localStorage — تخزين محلي
    const token = localStorage.getItem('token') || '';
    let uid = 'guest';
    // # شرط — فرع منطقي
    if (token && typeof global.parseJwtSub === 'function') {
      uid = global.parseJwtSub(token) || 'guest';
    } else if (token) {
      // # try — معالجة عملية قد تفشل
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        uid = payload.sub || payload.id || 'guest';
      } catch (e) { /* ignore */ }
    }
    // # return — إرجاع النتيجة
    return 'glotix_custom_voice_' + uid;
  }

  /** تطبيع_رمز_لغة_TTS — يطابق قائمة LANGUAGES */
  // # FN normalizeTtsLangCode
  // # KW توليد_صوت,TTS,synthesis,لغة,language,dialect
  function normalizeTtsLangCode(code) {
    // # guard — شرط رفض أو خروج مبكر
    if (!code || !global.LANGUAGES) return 'ar';
    // # guard — شرط رفض أو خروج مبكر
    if (global.LANGUAGES.some((l) => l.code === code)) return code;
    const base = code.split('-')[0];
    // # guard — شرط رفض أو خروج مبكر
    if (base === 'ar') return 'ar';
    const match =
      // # block — فرع شرطي
      global.LANGUAGES.find((l) => l.code === base) ||
      global.LANGUAGES.find((l) => l.base_lang === base && l.popular) ||
      global.LANGUAGES.find((l) => l.base_lang === base);
    // # return — إرجاع النتيجة
    return match ? match.code : 'ar';
  }

  /** تنسيق_الوقت_بالدقائق — مثل 1:05 */
  // # FN formatAudioTimeMmSs
  // # AR Text-to-speech (formatAudioTimeMmSs)
  // # KW توليد_صوت,TTS,synthesis
  function formatAudioTimeMmSs(sec) {
    // # guard — شرط رفض أو خروج مبكر
    if (!sec || !isFinite(sec)) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    // # return — إرجاع النتيجة
    return m + ':' + (s < 10 ? '0' : '') + s;
  }

  // # FN escapeHtmlForTtsUi
  // # AR Text-to-speech (escapeHtmlForTtsUi)
  // # KW توليد_صوت,TTS,synthesis
  function escapeHtmlForTtsUi(s) {
    // # return — إرجاع النتيجة
    return String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // # FN formatRelativeTimeAgo
  // # KW توليد_صوت,TTS,synthesis
  function formatRelativeTimeAgo(d) {
    // # guard — شرط رفض أو خروج مبكر
    if (!d) return '';
    const diff = Date.now() - new Date(d).getTime();
    const m = Math.floor(diff / 60000);
    // # guard — شرط رفض أو خروج مبكر
    if (m < 1) return 'Just now';
    // # guard — شرط رفض أو خروج مبكر
    if (m < 60) return m + 'm ago';
    // # block — فرع شرطي
    const h = Math.floor(m / 60);
    // # guard — شرط رفض أو خروج مبكر
    if (h < 24) return h + 'h ago';
    // # return — إرجاع النتيجة
    return Math.floor(h / 24) + 'd ago';
  }

  // # FN normalizeTtsApiBaseUrl
  // # AR Text-to-speech (normalizeTtsApiBaseUrl)
  // # KW توليد_صوت,TTS,synthesis
  function normalizeTtsApiBaseUrl() {
    // # return — إرجاع النتيجة
    return String(global.API_BASE || 'https://api.glotix.ai')
      .replace(/\/$/, '')
      .replace(/([^:]\/)\/+/g, '$1');
  }

  // # FN _langBaseFromCode
  // # AR Text-to-speech (_langBaseFromCode)
  // # KW توليد_صوت,TTS,synthesis,لغة,language,dialect
  function _langBaseFromCode(code) {
    const c = String(code || '').toLowerCase().split('-')[0];
    // # return — إرجاع النتيجة
    return c.startsWith('ar') ? 'ar' : c;
  }

  // # FN _resolveLangCodeFromBase
  // # AR Text-to-speech (_resolveLangCodeFromBase)
  // # KW توليد_صوت,TTS,synthesis,لغة,language,dialect
  function _resolveLangCodeFromBase(base) {
    // # guard — شرط رفض أو خروج مبكر
    if (!base) return '';
    const lang = global.LANGUAGES?.find((l) => l.code === base)
      || global.LANGUAGES?.find((l) => l.base_lang === base && l.popular)
      || global.LANGUAGES?.find((l) => l.base_lang === base);
    // # return — إرجاع النتيجة
    return lang?.code || base;
  }

  /** تخمين_لغة_النص — يعتمد على الكتابة وليس اختيار الدبلجة المحفوظ */
  // # FN detectTextBaseLang
  // # KW توليد_صوت,TTS,synthesis,لغة,language,dialect
  function detectTextBaseLang(text) {
    const sample = String(text || '').trim();
    // # guard — شرط رفض أو خروج مبكر
    if (!sample) return '';

    let ar = 0;
    let latin = 0;
    let ru = 0;
    // # block — معالجة صوت/استنساخ
    let zh = 0;
    let hi = 0;
    let he = 0;

    for (const ch of sample) {
      const c = ch.codePointAt(0);
      // # شرط — فرع منطقي
      if (c >= 0x0600 && c <= 0x06ff) ar++;
      else if (c >= 0x0400 && c <= 0x04ff) ru++;
      else if (c >= 0x4e00 && c <= 0x9fff) zh++;
      else if (c >= 0x0900 && c <= 0x097f) hi++;
      else if (c >= 0x0590 && c <= 0x05ff) he++;
      else if (/[a-zA-ZÀ-ÿ]/.test(ch)) latin++;
    }

    // # guard — شرط رفض أو خروج مبكر
    if (ar > 0) return 'ar';
    // # guard — شرط رفض أو خروج مبكر
    if (ru > 0) return 'ru';
    // # guard — شرط رفض أو خروج مبكر
    if (zh > 0) return 'zh';
    // # guard — شرط رفض أو خروج مبكر
    if (hi > 0) return 'hi';
    // # guard — شرط رفض أو خروج مبكر
    if (he > 0) return 'he';
    // # guard — شرط رفض أو خروج مبكر
    if (latin <= 0) return '';

    // # guard — شرط رفض أو خروج مبكر
    if (/[а-яА-ЯёЁ]/.test(sample)) return 'ru';
    // # guard — شرط رفض أو خروج مبكر
    if (/[ñ¿¡]/.test(sample)) return 'es';
    // # guard — شرط رفض أو خروج مبكر
    if (/[äöüß]/.test(sample)) return 'de';
    // # guard — شرط رفض أو خروج مبكر
    if (/[ąćęłńśźż]/.test(sample)) return 'pl';
    // # guard — شرط رفض أو خروج مبكر
    if (/[ığüşöçİ]/.test(sample)) return 'tr';
    // # guard — شرط رفض أو خروج مبكر
    if (/[àâäéèêëïîôùûüç]/.test(sample)) return 'fr';
    // # guard — شرط رفض أو خروج مبكر
    if (/[ãõâê]/.test(sample) && !/[ñ]/.test(sample)) return 'pt';
    // # return — إرجاع النتيجة
    return 'en';
  }

  /** textMatchesTtsLang — النص مطابق للغة النطق؟ لا حاجة للمترجم */
  // # FN textMatchesTtsLang
  // # AR Speech-to-text (textMatchesTtsLang)
  // # KW تفريغ,ASR,STT,whisper,deepgram,توليد_صوت,TTS,synthesis,لغة,language,dialect
  function textMatchesTtsLang(text, targetCode, targetBase) {
    const detectedBase = detectTextBaseLang(text);
    // # guard — شرط رفض أو خروج مبكر
    if (!detectedBase) return true;
    const tgtBase = _langBaseFromCode(targetBase || targetCode);
    // # return — إرجاع النتيجة
    return detectedBase === tgtBase;
  }

  /** resolveTtsTranslationContext — يحدد متى نترجم وما هي لغة المصدر */
  // # FN resolveTtsTranslationContext
  // # AR حل/استنتاج tts translation context (resolveTtsTranslationContext)
  // # KW مترجم,ترجمة,translate,translation,LLM,توليد_صوت,TTS,synthesis
  function resolveTtsTranslationContext(text, targetCode, targetBase, targetDialect) {
    const tgtCode = targetCode || 'ar';
    const tgtBase = _langBaseFromCode(targetBase || tgtCode);
    const detectedBase = detectTextBaseLang(text);

    let sourceCode = '';
    let sourceDialect = '';

    // # شرط — فرع منطقي
    if (detectedBase) {
      // # شرط — فرع منطقي
      if (detectedBase === tgtBase) {
        sourceCode = tgtCode;
        sourceDialect = targetDialect || '';
      } else {
        sourceCode = _resolveLangCodeFromBase(detectedBase);
        // # block — فرع شرطي
        const lang = global.LANGUAGES?.find((l) => l.code === sourceCode);
        sourceDialect = lang?.dialect || '';
      }
    } else {
      const savedCode =
        typeof global.getSelectedSourceLanguage === 'function'
          // # block — تنفيذ منطق — راجع الأسطر التالية
          ? global.getSelectedSourceLanguage()
          : '';
      const savedBase = _langBaseFromCode(savedCode);
      // # شرط — فرع منطقي
      if (savedCode && savedBase && savedBase !== tgtBase) {
        sourceCode = savedCode;
        sourceDialect =
          // # block — فرع شرطي
          typeof global.getSelectedSourceDialect === 'function'
            ? global.getSelectedSourceDialect()
            : '';
      } else {
        sourceCode = tgtCode;
        sourceDialect = targetDialect || '';
      // # block — تنفيذ منطق — راجع الأسطر التالية
      }
    }

    const translate = !textMatchesTtsLang(text, tgtCode, tgtBase);

    // # return — إرجاع النتيجة
    return { sourceCode, sourceDialect, translate };
  }

  TtsApp.helpers = {
    createTtsFlagImg,
    dataUrlToBlobUrl,
    downloadTtsAudioFile,
    getTtsUserVoiceStorageKey,
    normalizeTtsLangCode,
    formatAudioTimeMmSs,
    escapeHtmlForTtsUi,
    formatRelativeTimeAgo,
    normalizeTtsApiBaseUrl,
    detectTextBaseLang,
    textMatchesTtsLang,
    resolveTtsTranslationContext,
  };

  global.createTtsFlagImg = createTtsFlagImg;
  global.getUserVoiceKey = getTtsUserVoiceStorageKey;
})(window);
