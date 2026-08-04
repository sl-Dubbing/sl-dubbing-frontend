// # FILE frontend/sl-dubbing-frontend-main/js/tts/01-state.js
// # AR واجهة TTS
// # KW توليد_صوت,TTS
// # CONVENTION — FN/AR/KW + # block كل ~6 أسطر — FUNCTION_INDEX.md DOMAIN_INDEX.md
// =====================================================================
// 📒 فهرس وحدات TTS — js/tts/ (الترتيب في tts.html)
// ---------------------------------------------------------------------
//  01-state          — حالة الصفحة المشتركة
//  02-helpers        — أعلام اللغات وتحويل الصوت والوقت
//  03-ui-modes       — أوضاع واجهة: توليد / تحميل / مشغّل
//  04-player         — مشغّل الصوت والتحكم بالسرعة
//  05-stt            — الإملاء الصوتي (Speech-to-Text)
//  06-lang-picker    — اختيار لغة النطق
//  07-voice          — الأصوات البريميوم ونسخ الصوت
//  11-voice-save-modal — نافذة حفظ العينة في المكتبة
//  08-generate       — طلب POST /api/tts/quick
//  09-recent-works   — آخر أعمال TTS (محلي + API)
//  10-input-toolbar  — لصق / مسح / إدخال النص
//  99-init           — تشغيل الصفحة وربط الأحداث
// =====================================================================
(function (global) {
  const TtsApp = (global.TtsApp = global.TtsApp || {});

  TtsApp.constants = {
    LANG_STORAGE_KEY: 'glotix_tts_lang',
    HISTORY_STORAGE_KEY: 'glotix_tts_history',
    MAX_LOCAL_HISTORY: 7,
    MAX_DB_TTS_ITEMS: 7,
    RECENT_DISPLAY_COUNT: 4,
  };

  TtsApp.state = {
    currentLangCode: 'ar',
    currentBaseLang: 'ar',
    currentDialect: '',
    selectedVoiceId: null,
    customVoiceFile: null,
    currentAudio: null,
    generating: false,
    pendingVoiceSampleUrl: '',
    pendingVoiceSampleText: '',
    voiceSaveModalShownForUrl: '',
  };

  global.sessionTtsHistory = global.sessionTtsHistory || [];
  global.usingSavedVoice = global.usingSavedVoice || false;
  global.voiceMode = global.voiceMode || '';
})(window);
