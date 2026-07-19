// # FILE frontend/sl-dubbing-frontend-main/js/config.js
// # AR وحدة الدبلجة — رفع، بدء مهمة، polling، أصوات
// # CONVENTION — # FN / # AR فوق كل دالة، # قبل كل خطوة — see FUNCTION_INDEX.md
// js/config.js
window.APP_CONFIG = {
    // ⚠️ للتشغيل عبر Go Gateway (sl-dubbing-gateway): USE_GO_GATEWAY=true و API_BASE=""
    // Go يخدم الواجهة + الرفع المباشر + بث الفيديو ويوجّه /api/* للباكند Python
    USE_GO_GATEWAY: false,
    API_BASE: "https://glotix-api-production.up.railway.app",
    SUPABASE_URL: "https://ckjkkxrlgisjdolwddfg.supabase.co",
    SUPABASE_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNramtreHJsZ2lzamRvbHdkZGZnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0NjU0OTUsImV4cCI6MjA5MzA0MTQ5NX0.F-4TbmO6_7plPm8NBr_6djCv6gtEPpWFw9J7m8vTs6M",
    
    // ✅ تم تفعيل هذه الميزة لتقليل الضغط على السيرفر وتسريع ظهور تقدم الدبلجة (0 إلى 100%)
    DUB_USE_SSE: true,

    // Browser + server CPU dubbing (no GPU): disabled — pipeline module not shipped.
    CPU_SITE_MODE: false,

    // Hyper-Live nano+turbo: disabled — orchestrator module not shipped.
    HYPER_LIVE_MODE: false,

    // Added to dub cost when cloning voice from the user's video (not saved/catalog samples).
    VOICE_CLONE_CREDIT_COST: 100
};
