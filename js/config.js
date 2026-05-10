// js/config.js - الإعدادات العامة للمشروع (API & Database)

// 1️⃣ رابط سيرفر البايثون (Backend) الذي تم ربطه بمنصة Railway
window.API_BASE = "https://api.glotix.ai/api";

// 2️⃣ إعدادات قاعدة بيانات Supabase
// ملاحظة: هذا المفتاح (anon public key) مصمم ليكون في الواجهة الأمامية وهو آمن 
// بشرط تفعيل (Row Level Security - RLS) في جداول قاعدة البيانات الخاصة بك.
window.APP_CONFIG = {
    SUPABASE_URL: "https://ckjkkxrlgisjdolwddfg.supabase.co",
    SUPABASE_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNramtreHJsZ2lzamRvbHdkZGZnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0NjU0OTUsImV4cCI6MjA5MzA0MTQ5NX0.F-4TbmO6_7plPm8NBr_6djCv6gtEPpWFw9J7m8vTs6M"
};
