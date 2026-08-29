# js — كود JavaScript الكامل

> **فهرس المشروع:** [PROJECT_MAP.md](../../../../PROJECT_MAP.md) · [FRONTEND.md](../../../../FRONTEND.md)

> **داخل مستودع `sl-dubbing-frontend-main`**
> كل منطق التطبيق. الملفات مُرقَّمة للتحميل المتسلسل عبر `<script type="module">`.

---

## الملفات الجذرية

### config.js
```js
const APP_CONFIG = {
  API_BASE_URL: "https://api.yourdomain.com",
  SUPABASE_URL: "https://xxx.supabase.co",
  SUPABASE_ANON_KEY: "eyJ...",
  STRIPE_PUBLIC_KEY: "pk_live_..."
}
```
يُحمَّل أولاً في كل صفحة. تُعدَّله قبل النشر.

### languages.js
```js
const LANGUAGES = [
  { code: "ar", name: "العربية", flag: "🇸🇦" },
  { code: "en", name: "English", flag: "🇬🇧" },
  ...
]
```

### src-lang-picker.js
```js
function initSrcLangPicker(containerId, onChange)
function getSelectedSrcLang() → string
```
Dropdown اختيار لغة المصدر — مشترك بين صفحتي الدبلجة وTTS.

---

## المجلدات

| المجلد | عدد الملفات | يُستخدم في |
|--------|------------|-----------|
| `shared/` | 16 ملف | كل الصفحات |
| `dubbing/` | 19 ملف + wasm | `dubbing.html` |
| `tts/` | 11 ملف | `tts.html` |
| `video-creation/` | 1 ملف | `video-creation.html` |

---

## للتفاصيل

- [shared/README.md](shared/README.md)
- [dubbing/README.md](dubbing/README.md)
- [tts/README.md](tts/README.md)
- [video-creation/README.md](video-creation/README.md)
