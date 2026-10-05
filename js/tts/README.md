# js/tts — وحدات صفحة TTS

> **فهرس:** [FRONTEND.md](../../../../../FRONTEND.md) § js/tts

> **داخل مستودع `sl-dubbing-frontend-main`**
> جميع الملفات تُضيف دوالاً إلى `window.TTSApp`.
> تُحمَّل بالترتيب في `tts.html`.

---

## الملفات

### 01-config.js
```js
window.TTSApp.CONFIG = {
  MAX_CHARS: 5000,
  SUPPORTED_FORMATS: ["mp3", "wav"],
  DEFAULT_LANG: "ar"
}
```

### 02-state.js
```js
window.TTSApp.state = {
  text: "",
  lang: "ar",
  voice_id: null,
  job_id: null,
  audio_url: null
}
```

### 03-init.js
```js
function initTTSPage()   // يُهيئ الصفحة: يُحمّل الأصوات، يُسجّل events
```

### 04-text-input.js
```js
function handleTextInput(text)      // يُحدّث الحالة + عدّاد الأحرف
function loadTextFromFile(file)     // يقرأ .txt وينقله للـ textarea
function clearText()
function getCharCount() → number
```

### 05-voice-select.js
```js
function loadVoices()               // يجلب قائمة الأصوات من API
function renderVoiceOptions(voices)
function selectVoice(voice_id)
function getSelectedVoice() → string | null
```

### 06-lang-picker.js
```js
function initLangPicker()
function selectLang(lang_code)
function getSelectedLang() → string
```

### 07-generate.js
```js
async function generateTTS()
// 1. يتحقق من الإدخال (نص + لغة + صوت)
// 2. يحجز credits: billingService.reserve()
// 3. POST /tts/generate
// 4. يُحدّث الحالة → job_id
// 5. يبدأ polling
```

### 08-job-status.js
```js
function pollTTSStatus(job_id)       // يستطلع كل 2 ثانية
function handleStatusUpdate(status)  // "processing" | "done" | "failed"
function stopPolling()
```

### 09-player.js
```js
function loadAudioPlayer(audio_url)
function playAudio()
function pauseAudio()
function seekAudio(seconds)
function getPlaybackProgress() → number
```

### 10-history.js
```js
function loadTTSHistory()            // يجلب آخر 10 مهام
function renderTTSHistory(jobs)
function downloadHistoryItem(job_id)
```

### 11-export.js
```js
function downloadAudio(audio_url, filename)   // يُحمّل الملف الصوتي
function copyAudioUrl(audio_url)              // ينسخ الرابط للحافظة
```
