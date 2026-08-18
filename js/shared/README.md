# js/shared — الوحدات المشتركة

> **فهرس:** [FRONTEND.md](../../../../../FRONTEND.md) § js/shared

> **داخل مستودع `sl-dubbing-frontend-main`**
> تُحمَّل في كل صفحة قبل وحدات الصفحة الخاصة.
> مرتبة بالأرقام لضمان التحميل بالترتيب الصحيح.

---

## الملفات

### 01-supabase-client.js
```js
let _supabase = null
function getSupabase() → SupabaseClient    // singleton — يُنشئ مرة واحدة
```

### 02-auth.js
```js
async function signIn(email, password) → { user, error }
async function signUp(email, password) → { user, error }
async function signOut()
async function getSession() → Session | null
function onAuthStateChange(callback)        // يُسجّل listener
async function getAccessToken() → string   // من localStorage أو Supabase
```

### 03-credits.js
```js
async function getCredits() → number
function displayCredits(amount)            // يُحدّث رصيد الـ navbar
async function reserveCredits(amount) → string    // → reservation_id
async function commitReservation(id)
async function cancelReservation(id)
```

### 04-menu.js
```js
function initNavbar()                       // يبني navbar + يتحقق من Auth
function updateNavbarAuth(user)             // يُظهر اسم المستخدم/رصيده
function initMobileMenu()                   // hamburger menu لـ mobile
```

### 05-toast.js
```js
function showToast(message, type)  // type: "success" | "error" | "info" | "warning"
function hideToast(id)
// يُظهر إشعار في الزاوية لـ 4 ثوانٍ
```

### 06-api-client.js
```js
async function apiFetch(endpoint, options = {}) → Response
// يُضيف تلقائياً: Authorization: Bearer <token>
// يُعالج 401 (انتهاء session) + 429 (rate limit)
// BASE_URL من APP_CONFIG.API_BASE_URL
```

### 07-voice-profile.js
```js
async function loadVoices() → list[Voice]          // جميع الأصوات
async function getUserVoices() → list[Voice]       // أصوات المستخدم فقط
async function getVoiceById(voice_id) → Voice
async function uploadVoiceSample(file) → Voice     // رفع صوت مخصص
```

### 08-history-api.js
```js
async function fetchDubbingHistory(limit=20) → list[Job]
async function fetchTTSHistory(limit=20) → list[TTSJob]
function renderJobCard(job) → HTMLElement
```

### 09-lang-utils.js
```js
function getLangName(code) → string    // "ar" → "العربية"
function getLangCode(name) → string    // "العربية" → "ar"
function getLangFlag(code) → string    // "ar" → "🇸🇦"
function isSupportedLang(code) → bool
```

### 10-file-utils.js
```js
function formatFileSize(bytes) → string    // 1048576 → "1 MB"
function getFileExtension(filename) → string
function isVideoFile(file) → bool
function isAudioFile(file) → bool
function validateFileSize(file, maxMB) → bool
```

### 11-time-utils.js
```js
function formatDuration(seconds) → string    // 125 → "2:05"
function formatTimestamp(iso) → string        // → "15 Jun 2026, 14:30"
function timeAgo(iso) → string               // → "3 minutes ago"
```

### 12-error-handler.js
```js
function handleApiError(response) → string    // استخراج رسالة الخطأ
function displayError(message, containerId)
function clearErrors()
```

### 13-modal.js
```js
function openModal(modalId)
function closeModal(modalId)
function closeAllModals()
function onModalClose(modalId, callback)
```

### 14-loader.js
```js
function showLoader(message="جاري التحميل...")
function hideLoader()
function showInlineLoader(elementId)
function hideInlineLoader(elementId)
```

### 15-stripe-client.js
```js
let _stripe = null
function getStripe() → Stripe    // singleton بـ STRIPE_PUBLIC_KEY
async function redirectToCheckout(sessionId)
async function createPaymentMethod(cardElement) → PaymentMethod
```

### 16-developer-api.js
```js
async function listApiKeys() → list[ApiKey]
async function createApiKey(name) → ApiKey     // → {id, key: "glx_xxx", name}
async function deleteApiKey(key_id)
async function getApiUsage(key_id) → UsageStats
```
