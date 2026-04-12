'use strict';

// الرابط العالمي لـ Railway
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

// --- إظهار التنبيهات ---
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

// --- بناء شبكة اللغات ---
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

// --- بناء بطاقة المتحدث ---
function createSpeakerCard(s) {
    const card = document.createElement('div');
    card.className = `spk-card ${activeSpeakerId === s.speaker_id ? 'active' : ''}`;
    
    let icon = s.is_auto ? '<i class="fas fa-magic"></i>' : (s.is_add ? '<i class="fas fa-plus"></i>' : '<i class="fas fa-microphone"></i>');
    
    card.innerHTML = `
        <i class="fas fa-check-circle chk"></i>
        <div class="spk-av">${icon}</div>
        <div class="spk-nm">${s.label}</div>
    `;
    
    card.onclick = () => {
        if (s.is_add) {
            document.getElementById('spkFile').click();
        } else {
            activeSpeakerId = s.speaker_id;
            document.querySelectorAll('.spk-card').forEach(c => c.classList.remove('active'));
            card.classList.add('active');
        }
    };
    return card;
}

// --- تحميل قائمة الأصوات ---
async function loadSpeakers() {
    const grid = document.getElementById('spkGrid');
    if (!grid) return;
    grid.innerHTML = '';

    // دائماً نبدأ بخيار التلقائي
    grid.appendChild(createSpeakerCard({ speaker_id: 'auto', label: 'تلقائي (المصدر)', is_auto: true }));

    try {
        const res = await fetch(`${API_BASE}/api/speakers`);
        if (res.ok) {
            const list = await res.json();
            list.forEach(s => grid.appendChild(createSpeakerCard(s)));
        }
    } catch (e) { console.log("لا يوجد أصوات سحابية حالياً"); }

    // دائماً ننهي بزر الاستنساخ
    grid.appendChild(createSpeakerCard({ speaker_id: 'add', label: 'استنساخ صوت', is_add: true }));
}

// --- رفع عينة صوت للاستنساخ ---
document.getElementById('spkFile').addEventListener('change', async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    showToast("جاري رفع واستنساخ الصوت...");
    
    const fd = new FormData();
    fd.append('file', f);
    fd.append('label', f.name.replace(/\.[^.]+$/, ''));
    
    try {
        const r = await fetch(API_BASE + '/api/upload_speaker', { method: 'POST', body: fd });
        const d = await r.json();
        if (r.ok) {
            activeSpeakerId = d.speaker_id;
            await loadSpeakers();
            showToast("تم الاستنساخ! يمكنك استخدامه الآن", "success");
        }
    } catch (err) { showToast("فشل الاستنساخ", "error"); }
});

// --- بقية وظائف المعالجة (SRT, ETA, Monitor) ---
function toSec(t) {
    t = String(t).trim().replace(/[\u0660-\u0669]/g, d => d.charCodeAt(0) - 0x0660).replace(',', '.');
    const p = t.split(':').map(Number);
    if (p.length === 3) return p[0]*3600 + p[1]*60 + (p[2]||0);
    if (p.length === 2) return p[0]*60 + (p[1]||0);
    return p[0]||0;
}

function parseSRT(data) {
    const segments = [];
    const blocks = data.replace(/\r/g, '').split(/\n\n+/);
    blocks.forEach(block => {
        const lines = block.split('\n').filter(Boolean);
        if (lines.length >= 2) {
            const timeMatch = lines[1].match(/(\d+:\d+:\d+,\d+)\s*-->\s*(\d+:\d+:\d+,\d+)/);
            if (timeMatch) {
                segments.push({
                    start: toSec(timeMatch[1]),
                    end: toSec(timeMatch[2]),
                    text: lines.slice(2).join(' ')
                });
            }
        }
    });
    return segments;
}

document.getElementById('srtFile').addEventListener('change', (e) => {
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onload = (ev) => {
        srtSegments = parseSRT(ev.target.result);
        if (srtSegments.length > 0) {
            document.getElementById('srtZone').innerHTML = `✅ ${file.name}`;
            showToast(`تم تحميل ${srtSegments.length} مقطع ترجمة`);
            checkReady();
        }
    };
    reader.readAsText(file);
});

function checkReady() {
    const isOnline = document.getElementById('dot').classList.contains('on');
    const btn = document.getElementById('startBtn');
    if (isOnline && srtSegments.length > 0 && selectedLangs.length > 0) {
        btn.style.opacity = '1'; btn.style.cursor = 'pointer';
    } else {
        btn.style.opacity = '0.5'; btn.style.cursor = 'not-allowed';
    }
}

// --- مراقبة المهمة ---
function monitorJob(jobId, label) {
    return new Promise((resolve, reject) => {
        const poll = setInterval(async () => {
            try {
                const res = await fetch(`${API_BASE}/api/job/${jobId}`);
                const data = await res.json();
                if (data.status === 'done') {
                    clearInterval(poll);
                    addResult(data.audio_url, label);
                    resolve();
                } else if (data.status === 'error') {
                    clearInterval(poll); reject(data.error);
                }
            } catch (e) { clearInterval(poll); }
        }, 3000);
    });
}

// --- زر البدء ---
async function start() {
    const url = document.getElementById('ytUrl').value;
    if (selectedLangs.length === 0) return showToast("اختر لغة واحدة على الأقل", "error");
    
    document.getElementById('loader').style.display = 'flex';
    
    for (const lang of selectedLangs) {
        try {
            const res = await fetch(`${API_BASE}/api/dub`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text: srtSegments.map(s => s.text).join(' '), // تجريبي للـ TTS
                    lang: lang,
                    speaker_id: activeSpeakerId !== 'auto' ? activeSpeakerId : null
                })
            });
            const { job_id } = await res.json();
            await monitorJob(job_id, lang);
        } catch (e) { showToast("خطأ في الطلب", "error"); }
    }
    document.getElementById('loader').style.display = 'none';
}

function addResult(url, label) {
    const resList = document.getElementById('resList');
    document.getElementById('resCard').style.display = 'block';
    const div = document.createElement('div');
    div.className = 'res-item';
    div.innerHTML = `<span>${label}</span> <audio controls src="${url}"></audio>`;
    resList.appendChild(div);
}

// --- الحالة والتهيئة ---
document.addEventListener('DOMContentLoaded', () => {
    buildLangGrid();
    loadSpeakers();
    setInterval(async () => {
        try {
            const res = await fetch(`${API_BASE}/api/status`);
            if (res.ok) {
                document.getElementById('dot').classList.add('on');
                document.getElementById('dotLbl').innerText = "System Online";
            }
        } catch (e) {
            document.getElementById('dot').classList.remove('on');
            document.getElementById('dotLbl').innerText = "System Offline";
        }
        checkReady();
    }, 5000);
});
