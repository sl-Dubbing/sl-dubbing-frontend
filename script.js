'use strict';

// 🌍 الرابط العالمي لـ Railway
const API_BASE = 'https://sl-dubbing-frontend-production.up.railway.app';

let selectedLangs = [];
let srtSegments = [];
let activeSpeakerId = 'auto';

const SUPPORTED_LANGS = [
    { code: 'ar', name: 'العربية', flag: '🇸🇦' },
    { code: 'en', name: 'English', flag: '🇺🇸' },
    { code: 'fr', name: 'French', flag: '🇫🇷' },
    { code: 'de', name: 'German', flag: '🇩🇪' },
    { code: 'es', name: 'Spanish', flag: '🇪🇸' },
    { code: 'it', name: 'Italian', flag: '🇮🇹' },
    { code: 'pt', name: 'Portuguese', flag: '🇵🇹' },
    { code: 'tr', name: 'Turkish', flag: '🇹🇷' },
    { code: 'ru', name: 'Russian', flag: '🇷🇺' },
    { code: 'zh-cn', name: 'Chinese', flag: '🇨🇳' }
];

// --- محرك تنظيف وتحليل الوقت ---
function toSec(t) {
    if (!t) return 0;
    let parts = t.trim().replace(',', '.').split(':');
    if (parts.length === 3) {
        return parseFloat(parts[0]) * 3600 + parseFloat(parts[1]) * 60 + parseFloat(parts[2]);
    } else if (parts.length === 2) {
        return parseFloat(parts[0]) * 60 + parseFloat(parts[1]);
    }
    return parseFloat(parts[0]) || 0;
}

// --- محرك تحليل الملفات الشامل (SRT / SBV / VTT) ---
function parseSubtitle(data) {
    const segments = [];
    const lines = data.replace(/\r/g, '').split('\n');
    
    // Regex مرن جداً للتعرف على التوقيتات في أي صيغة
    const timeRegex = /(\d+:?\d*:\d+[.,]\d+)\s*(-->|,)\s*(\d+:?\d*:\d+[.,]\d+)/;

    let currentSegment = null;

    lines.forEach(line => {
        const match = timeRegex.exec(line);
        if (match) {
            if (currentSegment) segments.push(currentSegment);
            currentSegment = {
                start: toSec(match[1]),
                end: toSec(match[3]),
                text: ""
            };
        } else if (currentSegment && line.trim() !== "" && !/^\d+$/.test(line.trim())) {
            currentSegment.text += line.trim() + " ";
        }
    });

    if (currentSegment) segments.push(currentSegment);
    return segments.map(s => ({ ...s, text: s.text.trim() })).filter(s => s.text.length > 0);
}

// --- التعامل مع رفع الملف ---
document.getElementById('srtFile').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
        const segs = parseSubtitle(ev.target.result);
        if (segs.length > 0) {
            srtSegments = segs;
            document.getElementById('srtZone').innerHTML = `✅ ${file.name} (${segs.length} مقطع)`;
            checkReady();
        } else {
            alert("فشل قراءة الملف. تأكد أن الملف يحتوي على توقيتات ونصوص واضحة.");
        }
    };
    // نقرأ الملف بترميز UTF-8 لضمان دعم اللغة العربية
    reader.readAsText(file, 'UTF-8');
});

// --- تحديث حالة النظام ---
async function updateStatus() {
    try {
        const res = await fetch(`${API_BASE}/api/status`);
        const data = await res.json();
        if (data.status === 'online') {
            document.getElementById('dot').classList.add('on');
            document.getElementById('dotLbl').innerText = "System Online";
        }
    } catch (e) {
        document.getElementById('dot').classList.remove('on');
        document.getElementById('dotLbl').innerText = "System Offline";
    }
    checkReady();
}

// --- فحص جاهزية الزر ---
function checkReady() {
    const btn = document.getElementById('startBtn');
    const isOnline = document.getElementById('dot').classList.contains('on');
    const hasSrt = srtSegments.length > 0;
    const hasLang = selectedLangs.length > 0;

    if (btn) {
        btn.disabled = !(isOnline && hasSrt && hasLang);
        btn.style.opacity = btn.disabled ? "0.5" : "1";
        
        if (!isOnline) btn.innerText = "في انتظار اتصال النظام...";
        else if (!hasSrt) btn.innerText = "يرجى رفع ملف الترجمة";
        else if (!hasLang) btn.innerText = "اختر لغة الدبلجة";
        else btn.innerText = "ابدأ الدبلجة الآن 🚀";
    }
}

// --- وظيفة يوتيوب ---
window.onUrl = function(url) {
    const ytInfo = document.getElementById('ytInfo');
    const ytThumb = document.getElementById('ytThumb');
    if (!url.includes('youtu')) { if(ytInfo) ytInfo.style.display = 'none'; return; }
    const vid = (url.split('v=')[1]||'').split('&')[0] || url.split('.be/')[1] || '';
    if (vid && ytThumb) {
        ytThumb.src = `https://img.youtube.com/vi/${vid}/mqdefault.jpg`;
        if(ytInfo) ytInfo.style.display = 'flex';
    }
};

// --- تشغيل النظام عند التحميل ---
document.addEventListener('DOMContentLoaded', () => {
    // بناء شبكة اللغات
    const grid = document.getElementById('langGrid');
    SUPPORTED_LANGS.forEach(l => {
        const box = document.createElement('div');
        box.className = 'lang-box';
        box.innerHTML = `${l.flag} <span>${l.name}</span>`;
        box.onclick = () => {
            if (selectedLangs.includes(l.code)) selectedLangs = selectedLangs.filter(c => c !== l.code);
            else selectedLangs.push(l.code);
            box.classList.toggle('active');
            checkReady();
        };
        grid.appendChild(box);
    });

    // تحديث الحالة كل 5 ثوانٍ
    updateStatus();
    setInterval(updateStatus, 5000);
});

// --- إرسال المهمة ---
async function start() {
    const btn = document.getElementById('startBtn');
    btn.disabled = true;
    btn.innerText = "جاري الإرسال...";
    
    const ytUrl = document.getElementById('ytUrl').value;
    
    try {
        const res = await fetch(`${API_BASE}/api/dub`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                segments: srtSegments,
                lang: selectedLangs[0], // نأخذ أول لغة مختارة كمثال
                url: ytUrl,
                speaker_id: activeSpeakerId
            })
        });
        const data = await res.json();
        alert("تم إرسال المهمة بنجاح! راقب جهازك في المنزل.");
    } catch (e) {
        alert("حدث خطأ أثناء الإرسال للسيرفر.");
    }
    btn.disabled = false;
    checkReady();
}
