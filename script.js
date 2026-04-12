'use strict';

// 🌍 تأكد أن هذا الرابط هو رابط Railway الخاص بك بالضبط
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

// --- بناء شبكة اللغات الكاملة ---
function buildLangGrid() {
    const grid = document.getElementById('langGrid');
    if (!grid) return;
    grid.innerHTML = '';
    SUPPORTED_LANGS.forEach(l => {
        const box = document.createElement('div');
        box.className = 'lang-box';
        box.innerHTML = `${l.flag} <span>${l.name}</span>`;
        if (selectedLangs.includes(l.code)) box.classList.add('active');
        box.onclick = () => {
            if (selectedLangs.includes(l.code)) selectedLangs = selectedLangs.filter(c => c !== l.code);
            else selectedLangs.push(l.code);
            box.classList.toggle('active');
            checkReady();
        };
        grid.appendChild(box);
    });
}

// --- تحميل الأصوات من السيرفر ---
async function loadSpeakers() {
    const grid = document.getElementById('spkGrid');
    if (!grid) return;
    grid.innerHTML = '';
    // إضافة الخيار التلقائي دائماً
    const autoCard = document.createElement('div');
    autoCard.className = `spk-card ${activeSpeakerId === 'auto' ? 'active' : ''}`;
    autoCard.innerHTML = '<i class="fas fa-magic"></i><div class="spk-nm">تلقائي (المصدر)</div>';
    autoCard.onclick = () => {
        activeSpeakerId = 'auto';
        document.querySelectorAll('.spk-card').forEach(c => c.classList.remove('active'));
        autoCard.classList.add('active');
    };
    grid.appendChild(autoCard);

    try {
        const res = await fetch(`${API_BASE}/api/speakers`);
        if (res.ok) {
            const list = await res.json();
            list.forEach(s => {
                const card = document.createElement('div');
                card.className = 'spk-card';
                card.innerHTML = `<i class="fas fa-microphone"></i><div class="spk-nm">${s.label}</div>`;
                card.onclick = () => {
                    activeSpeakerId = s.speaker_id;
                    document.querySelectorAll('.spk-card').forEach(c => c.classList.remove('active'));
                    card.classList.add('active');
                };
                grid.appendChild(card);
            });
        }
    } catch (e) { console.log("السيرفر لا يزال أوفلاين"); }
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

function checkReady() {
    const btn = document.getElementById('startBtn');
    const isOnline = document.getElementById('dot').classList.contains('on');
    if (btn) {
        btn.disabled = !(isOnline && selectedLangs.length > 0);
        btn.style.opacity = btn.disabled ? "0.5" : "1";
        btn.innerText = isOnline ? "ابدأ الدبلجة" : "في انتظار اتصال النظام...";
    }
}

document.addEventListener('DOMContentLoaded', () => {
    buildLangGrid();
    loadSpeakers();
    setInterval(async () => {
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
    }, 5000);
});
