# js/video-creation — وحدات إنشاء الفيديو

> **داخل مستودع `sl-dubbing-frontend-main`**
> منطق صفحة `video-creation.html` — إنشاء مقاطع فيديو من صور وصوت.

---

## الملفات

### 01-process.js
```js
function initVideoCreation()
function selectImages(files)               // اختيار صور المدخل
function setAudioTrack(file)               // تحديد مسار الصوت
function buildVideoFromImages(images, audio, duration) → Promise<Blob>
// يستخدم Canvas API + MediaRecorder لبناء الفيديو في المتصفح
function downloadVideo(blob, filename)
function previewVideo(blob)
```

يُنشئ فيديو من:
- سلسلة صور (slideshow)
- ملف صوت (TTS output أو رفع مخصص)
- مدة عرض كل صورة

**يعمل كلياً في المتصفح** — لا يُرسل بيانات للسيرفر.
