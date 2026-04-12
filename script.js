'use strict';

// 🌍 الرابط العالمي لـ Railway (تأكد أنه مطابق تماماً لما في إعدادات Railway)
const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
    ? 'http://127.0.0.1:5000' 
    : 'https://sl-dubbing-frontend-production.up.railway.app';

let selectedLangs = [];
let srtSegments = [];
let activeSpeakerId = 'auto'; 
let jobStartTime = 0;

const SUPPORTED_LANGS = [
    { code: 'ar', name: 'العربية', flag: '🇸🇦' }, { code: 'en', name: 'English', flag: '🇺🇸' },
    { code: 'fr', name: 'French', flag: '🇫🇷' }, { code: 'de', name: 'German', flag: '🇩🇪' },
    { code: 'es', name: 'Spanish', flag: '🇪🇸' }, { code: 'it', name: 'Italian', flag: '🇮🇹' },
    { code: 'pt', name: 'Portuguese', flag: '🇵🇹' }, { code: 'tr', name: 'Turkish', flag: '🇹🇷' },
    { code: 'ru', name: 'Russian', flag: '🇷🇺' }, { code: 'zh-cn', name: 'Chinese', flag: '🇨🇳' }
];

// --- إظهار التنبيهات (Toast) ---
function showToast(msg, type = 'info') {
    const toast = document.createElement('div');
    toast.style.cssText = `
        position: fixed; bottom: 20px; right: 20px; padding: 12px 24px;
        background: ${type === 'error' ? '#ef4444' : '#0f0f10'};
        color: white; border-radius: 10px; z-index: 9999;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15); font-size: 0.9rem;
        transition: transform 0.3s ease, opacity 0.3s ease;
        transform: translateY(100px); opacity: 0;
    `;
    toast.innerText = msg;
    document.body.appendChild(toast);
    setTimeout(() => { toast.style.transform = 'translateY(0)'; toast.style.opacity = '1'; }, 100);
    setTimeout(() => {
        toast.style.transform = 'translateY(100px)'; toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// --- تحويل النص الزمني إلى ثواني (SRT & SBV) ---
function toSec(t) {
    if (!t) return 0;
    t = t.trim().replace(',', '.');
    const p = t.split(':').map(Number);
    if (p.length === 3) return p[0]*3600 + p[1]*60 + (p[2]||0);
    if (p.length === 2) return p[0]*60 + (p[1]||0);
    return p[0]||0;
}

// --- محرك تحليل ملفات الترجمة (SRT / SBV) ---
function parseSubtitle(data) {
    const segments = [];
    // تنظيف النص من الرموز الغريبة
    const cleanData = data.replace(/\r/g, '').trim();
    
    // محاولة التحليل كتنسيق SRT (00:00:00,000 --> 00:00:00,000)
    const srtRegex = /(\d{1,2}:\d{2}:\d{2}[.,]\d{1,3})\s*-->\s*(\d{1,2}:\d{2}:\d{2}[.,]\d{1,3})/g;
    // محاولة التحليل كتنسيق SBV (0:00:00.000,0:00:00.000)
    const sbvRegex = /(\d{1,2}:\d{2}:\d{2}[.,]\d{1,3}),(\d{1,2}:\d{2}:\d{2}[.,]\d{1,3})/g;

    let match;
    let lastIndex = 0;

    // نختبر النوع أولاً
    const isSrt = srtRegex.test(cleanData);
    const regex = isSrt ? srtRegex : sbvRegex;
    regex.lastIndex = 0; // إعادة التصفير للاختبار الحقيقي

    while ((match = regex.exec(cleanData)) !== null) {
        // استخراج النص الموجود بين الطوابع الزمنية
        const nextMatch = regex.exec(cleanData);
        const endOfText = nextMatch ? nextMatch.index : cleanData.length;
        const textBlob = cleanData.substring(match.index + match[0].length, endOfText).trim();
        
        // تنظيف النص من أرقام المقاطع (في SRT)
        const text = textBlob.split('\n').filter(line => !/^\d+$/.test(line.trim())).join(' ').trim();

        if (text) {
            segments.push({
                start: toSec(match[1]),
                end: toSec(match[2]),
                text: text
            });
        }
        
        if (nextMatch) regex.lastIndex = nextMatch.index; // العودة للمطابقة التالية
        else break;
    }
    return segments;
}

// --- التعامل مع رفع الملف ---
document.getElementById('srtFile').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
        const content = ev.target.result;
        const segs = parseSubtitle(content);
        
        if (segs.length > 0) {
            srtSegments = segs;
            document.getElementById('srtZone').innerHTML = `<i class="fas fa-check-circle" style="color:#059669"></i> ${file.name} (${segs.length} مقطع)`;
            showToast(`تم تحميل ${segs.length} مقطع ترجمة بنجاح!`, "success");
        } else {
            showToast("تعذر قراءة محتوى الملف. تأكد أنه بتنسيق SRT أو SBV سليم.", "error");
        }
        checkReady();
    };
    reader.readAsText(file);
});

// --- فحص الجاهزية وتفعيل الزر ---
function checkReady() {
    const isOnline = document.getElementById('dot').classList.contains('on');
    const btn = document.getElementById('startBtn');
    if (!btn) return;

    if (srtSegments.length > 0 && selectedLangs.length > 0) {
        if (isOnline) {
            btn.style.opacity = '1';
            btn.style.cursor = 'pointer';
            btn.disabled = false;
        } else {
            btn.style.opacity = '0.5';
            btn.innerText = "في انتظار اتصال النظام...";
            btn.disabled = true;
        }
    } else {
        btn.style.opacity = '0.5';
        btn.disabled = true;
    }
}

// --- بقية الوظائف الأساسية ---
function buildLangGrid() {
    const grid = document.getElementById('langGrid');
    if (!grid) return;
    grid.innerHTML = '';
    SUPPORTED_LANGS.forEach(l => {
        const box = document.createElement('div');
        box.className = 'lang-box';
        box.innerHTML = `${l.flag} <span>${l.name}</span>`;
        box.onclick = () => {
            const idx = selectedLangs.indexOf(l.code);
            if (idx > -1) { selectedLangs.splice(idx, 1); box.classList.remove('active'); } 
            else { selectedLangs.push(l.code); box.classList.add('active'); }
            checkReady();
        };
        grid.appendChild(box);
    });
}

function createSpeakerCard(s) {
    const card = document.createElement('div');
    card.className = `spk-card ${activeSpeakerId === s.speaker_id ? 'active' : ''}`;
    let icon = s.is_auto ? '<i class="fas fa-magic"></i>' : (s.is_add ? '<i class="fas fa-plus"></i>' : '<i class="fas fa-microphone"></i>');
    card.innerHTML = `<i class="fas fa-check-circle chk"></i><div class="spk-av">${icon}</div><div class="spk-nm">${s.label}</div>`;
    card.onclick = () => {
        if (s.is_add) document.getElementById('spkFile').click();
        else {
            activeSpeakerId = s.speaker_id;
            document.querySelectorAll('.spk-card').forEach(c => c.classList.remove('active'));
            card.classList.add('active');
        }
    };
    return card;
}

async function loadSpeakers() {
    const grid = document.getElementById('spkGrid');
    if (!grid) return;
    grid.innerHTML = '';
    grid.appendChild(createSpeakerCard({ speaker_id: 'auto', label: 'تلقائي (المصدر)', is_auto: true }));
    try {
        const res = await fetch(`${API_BASE}/api/speakers`);
        if (res.ok) {
            const list = await res.json();
            list.forEach(s => grid.appendChild(createSpeakerCard(s)));
        }
    } catch (e) {}
    grid.appendChild(createSpeakerCard({ speaker_id: 'add', label: 'استنساخ صوت', is_add: true }));
}

// --- مراقبة الحالة (Heartbeat) ---
document.addEventListener('DOMContentLoaded', () => {
    buildLangGrid();
    loadSpeakers();
    setInterval(async () => {
        try {
            const res = await fetch(`${API_BASE}/api/status`);
            if (res.ok) {
                document.getElementById('dot').classList.add('on');
                document.getElementById('dotLbl').innerText = "System Online";
            } else { throw new Error(); }
        } catch (e) {
            document.getElementById('dot').classList.remove('on');
            document.getElementById('dotLbl').innerText = "System Offline";
        }
        checkReady();
    }, 5000);
});

// --- زر البدء الفعلي ---
async function start() {
    if (srtSegments.length === 0 || selectedLangs.length === 0) return;
    
    document.getElementById('loader').style.display = 'flex';
    const ytUrl = document.getElementById('ytUrl').value;
    
    for (const lang of selectedLangs) {
        try {
            const res = await fetch(`${API_BASE}/api/dub`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    segments: srtSegments,
                    lang: lang,
                    url: ytUrl,
                    speaker_id: activeSpeakerId !== 'auto' ? activeSpeakerId : null
                })
            });
            const data = await res.json();
            // هنا يمكنك إضافة منطق متابعة المهمة كما في الإصدارات السابقة
            showToast(`تم إرسال المهمة للغة ${lang}...`, "info");
        } catch (e) { showToast("خطأ في الاتصال بالسيرفر", "error"); }
    }
    document.getElementById('loader').style.display = 'none';
}
