// # FILE frontend/sl-dubbing-frontend-main/js/dubbing/01-state.js
// # AR واجهة الدبلجة — رفع، Start، polling، أصوات
// # KW عام,general
// # CONVENTION — FN/AR/KW + # block كل ~6 أسطر — FUNCTION_INDEX.md DOMAIN_INDEX.md
// =====================================================================
// 📒 فهرس وحدات الدبلجة — js/dubbing/ (الترتيب في dubbing.html)
// ---------------------------------------------------------------------
//  01-state          — حالة الصفحة المشتركة
//  01-state … 99-init — modules load order from dubbing.html
//  02-api-config     — رابط API والمصادقة
//  03-api-fetch      — طلبات HTTP مع إعادة المحاولة
//  05-voice-payload  — بناء حمولة الصوت للطلب
//  06-voice-html     — بطاقات الأصوات في الواجهة
//  07-voice-api      — جلب الأصوات المحفوظة والنسخ
//  08-voice-save     — نافذة حفظ بصمة الصوت
//  09-voice-recorder — تسجيل صوت من الميكروفون
//  04-job-status     — متابعة حالة مهمة الدبلجة
//  10-ui-progress    — شريط التقدّم ونتائج السينما
//  11-upload-r2      — رفع الملف إلى R2
//  12-start-dubbing  — بدء الدبلجة (العملية الكاملة)
//  13-recent-jobs    — آخر أعمال الدبلجة
//  14-media-input    — اختيار ملف الفيديو/الصوت
//  15-lang-attention — تنبيه أحمر لأزرار اللغة بعد الرفع
//  99-init           — تشغيل الصفحة عند التحميل
// =====================================================================
(function (global) {
  const DubbingApp = (global.DubbingApp = global.DubbingApp || {});

  DubbingApp.state = {
    cinemaResults: {},
    mediaInputInitialized: false,
    activeWavesurfer: null,
    workAbortController: null,
    progressPercentMonotonic: 50,
    selectedMediaFile: null,
    startButtonLocked: false,
    pendingVoiceSampleUrl: '',
    pendingVoiceSampleText: '',
    voiceSaveModalShownForUrl: '',
    voiceSaveModalMode: 'immediate',
    voiceSaveIntentActive: false,
    voiceSaveIntentName: '',
    voiceSaveIntentFulfilled: false,
    voiceSaveIntentModalOffered: false,
    pendingRecordedSampleUrl: '',
    premiumVoicesCache: [],
    userVoiceClonesCache: [],
    voiceRecorder: null,
    voiceRecordChunks: [],
    voiceRecordTimer: null,
    voiceRecordBlob: null,
    voiceRecordObjectUrl: null,
    mediaPreviewObjectUrl: null,
    selectedMediaDurationSec: 0,
    scriptSegments: [],
    srtPreviewFileKey: '',
  };

  global.savedVoiceProfile = global.savedVoiceProfile || null;
  global.usingSavedVoice = global.usingSavedVoice || false;
  global.lastExtractedVocalsUrl = global.lastExtractedVocalsUrl || '';
})(window);
