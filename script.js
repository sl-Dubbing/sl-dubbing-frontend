'use strict';

// 🌍 الرابط العالمي لـ Railway
const API_BASE = 'https://sl-dubbing-frontend-production.up.railway.app';

let selectedLangs = [];
let srtSegments = [];
let activeSpeakerId = 'auto';

const SUPPORTED_LANGS = [
    { code: 'ar', name: 'العربية', flag: '🇸🇦' }, { code: 'en', name: 'English', flag: '🇺🇸' },
    { code: 'fr', name: 'French', flag: '🇫🇷' }, { code: 'de', name: 'German', flag: '🇩🇪' },
    { code: 'es', name: 'Spanish', flag: '🇪🇸' }, { code: 'it', name: 'Italian', flag: '🇮🇹' },
    { code: 'pt', name: 'Portuguese', flag: '🇵🇹' }, { code: 'tr', name: 'Turkish', flag: '🇹🇷' },
    { code: 'ru', name: 'Russian', flag: '🇷🇺' }, { code: 'zh-cn', name: 'Chinese', flag: '🇨🇳' }
];

// --- 🎙️ بناء بطاقة المتحدث ---
function createSpeakerCard(s) {
    const card = document.createElement('div');
    card.className = `spk-card ${activeSpeakerId === s.speaker_id ? 'active' : ''}`;
    card.setAttribute('data-id', s.speaker_id);
    
    let iconClass = s.icon || 'fa-microphone';
    
    card.innerHTML = `
        <i class="fas fa-check-circle chk"></i>
        <div class="spk-av"><i class="fas ${iconClass}"></i></div>
        <div class="spk-nm">${s.label}</div>
    `;
    
    card.onclick = () => {
        if (s.isAdd) {
            document.getElementById('spkFile').click();
        } else {
            activeSpeakerId = s.speaker_id;
            document.querySelectorAll('.spk-card').forEach(c => c.classList.remove('active'));
            card.classList.add('active');
        }
    };
    return card;
}

// --- 🎙️ تحميل الأصوات (تم تعديله لضمان الظهور الفوري) ---
async function loadSpeakers() {
    const grid = document.getElementById('spkGrid');
    if (!grid) return;
    
    // 1. مسح وإضافة الخيارات الأساسية "فورًا" لكي لا تظهر الخانة فارغة
    grid.innerHTML = '';
    grid.appendChild(createSpeakerCard({ speaker_id: 'auto', label: 'تلقائي (المصدر)', icon: 'fa-magic' }));
    grid.appendChild(createSpeakerCard({ speaker_id: 'add', label: 'استنساخ صوت', icon: 'fa-plus', isAdd: true }));

    // 2. محاولة جلب الأصوات المرفوعة من السيرفر وإضافتها "بين" الخيارين السابقين
    try {
        const res = await fetch(`${API_BASE}/api/speakers`);
        if (res.ok) {
            const list = await res.json();
            const addButton = grid.lastChild; // حفظ زر الإضافة
            list.forEach(s => {
                // نمنع التكرار إذا كان الصوت موجوداً بالفعل
                if (!document.querySelector(`[data-id="${s.speaker_id}"]`)) {
                    const card = createSpeakerCard({ speaker_id: s.speaker_id, label: s.label, icon: 'fa-microphone' });
                    grid.insertBefore(card, addButton);
                }
            });
        }
    } catch (e) { console.log("السيرفر لا يرسل أصواتًا حاليًا"); }
}

// --- 🌐 إدارة حالة النظام واللغات ---
function buildLangGrid() {
    const grid = document.getElementById('langGrid');
    if (!grid) return;
    grid.innerHTML = '';
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
}

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

// --- 📁 معالجة ملفات الترجمة ---
function toSec(t) {
    if (!t) return 0;
    let parts = t.trim().replace(',', '.').split(':');
    if (parts.length === 3) return parseFloat(parts[0]) * 3600 + parseFloat(parts[1]) * 60 + parseFloat(parts[2]);
    if (parts.length === 2) return parseFloat(parts[0]) * 60 + parseFloat(parts[1]);
    return parseFloat(parts[0]) || 0;
}

function parseSubtitle(data) {
    const segments = [];
    const lines = data.replace(/\r/g, '').split('\n');
    const timeRegex = /(\d+:?\d*:\d+[.,]\d+)\s*(-->|,)\s*(\d+:?\d*:\d+[.,]\d+)/;
    let current = null;
    lines.forEach(line => {
        const match = timeRegex.exec(line);
        if (match) {
            if (current) segments.push(current);
            current = { start: toSec(match[1]), end: toSec(match[3]), text: "" };
        } else if (current && line.trim() !== "" && !/^\d+$/.test(line.trim())) {
            current.text += line.trim() + " ";
        }
    });
    if (current) segments.push(current);
    return segments.filter(s => s.text.trim().length > 0);
}

document.getElementById('srtFile').addEventListener('change', (e) => {
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onload = (ev) => {
        srtSegments = parseSubtitle(ev.target.result);
        if (srtSegments.length > 0) {
            document.getElementById('srtZone').innerHTML = `<i class="fas fa-check-circle" style="color:#22c55e"></i> ${file.name} (${srtSegments.length} مقطع)`;
            checkReady();
        }
    };
    reader.readAsText(file, 'UTF-8');
});

function checkReady() {
    const btn = document.getElementById('startBtn');
    const isOnline = document.getElementById('dot').classList.contains('on');
    if (btn) {
        btn.disabled = !(isOnline && srtSegments.length > 0 && selectedLangs.length > 0);
        btn.style.opacity = btn.disabled ? "0.5" : "1";
        if (!isOnline) btn.innerText = "في انتظار اتصال النظام...";
        else if (srtSegments.length === 0) btn.innerText = "يرجى رفع ملف الترجمة";
        else if (selectedLangs.length === 0) btn.innerText = "اختر لغة الدبلجة";
        else btn.innerText = "ابدأ الدبلجة الآن 🚀";
    }
}

// --- 🚀 بدء العملية ---
async function start() {
    const btn = document.getElementById('startBtn');
    btn.disabled = true;
    btn.innerText = "جاري الإرسال للسحاب...";
    
    try {
        const res = await fetch(`${API_BASE}/api/dub`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                segments: srtSegments,
                lang: selectedLangs[0],
                url: document.getElementById('ytUrl').value,
                speaker_id: activeSpeakerId
            })
        });
        if (res.ok) alert("تم إرسال المهمة بنجاح! راقب جهازك في المنزل.");
        else alert("فشل الإرسال.");
    } catch (e) { alert("خطأ في الاتصال."); }
    
    btn.disabled = false;
    checkReady();
}

// --- رفع عينة صوت ---
document.getElementById('spkFile').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    fd.append('label', file.name.split('.')[0]);
    try {
        const res = await fetch(`${API_BASE}/api/upload_speaker`, { method: 'POST', body: fd });
        if (res.ok) { await loadSpeakers(); alert("تم رفع العينة بنجاح!"); }
    } catch (e) { alert("فشل رفع العينة"); }
});

document.addEventListener('DOMContentLoaded', () => {
    buildLangGrid();
    loadSpeakers();
    updateStatus();
    setInterval(updateStatus, 5000);
});
