'use strict';

const API_BASE = 'https://sl-dubbing-frontend-production.up.railway.app';

let selectedLangs = [];
let srtSegments = [];
let activeSpeakerId = 'auto';

// --- وظيفة معالجة رابط يوتيوب (التي كانت ناقصة) ---
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

function showToast(msg, type = 'info') {
    const toast = document.createElement('div');
    toast.style.cssText = `position:fixed;bottom:20px;right:20px;padding:12px 24px;background:${type==='error'?'#ef4444':'#0f0f10'};color:white;border-radius:10px;z-index:9999;`;
    toast.innerText = msg;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
}

// بناء اللغات
function buildLangGrid() {
    const grid = document.getElementById('langGrid');
    const langs = [{code:'ar', name:'العربية', flag:'🇸🇦'}, {code:'en', name:'English', flag:'🇺🇸'}];
    if (!grid) return;
    grid.innerHTML = '';
    langs.forEach(l => {
        const box = document.createElement('div');
        box.className = 'lang-box';
        box.innerHTML = `${l.flag} <span>${l.name}</span>`;
        box.onclick = () => {
            if (selectedLangs.includes(l.code)) selectedLangs = selectedLangs.filter(c => c!==l.code);
            else selectedLangs.push(l.code);
            box.classList.toggle('active');
            checkReady();
        };
        grid.appendChild(box);
    });
}

async function loadSpeakers() {
    const grid = document.getElementById('spkGrid');
    if (!grid) return;
    grid.innerHTML = '<div class="spk-card active" onclick="activeSpeakerId=\'auto\'">تلقائي</div>';
    try {
        const res = await fetch(`${API_BASE}/api/speakers`);
        const list = await res.json();
        list.forEach(s => {
            const card = document.createElement('div');
            card.className = 'spk-card';
            card.innerText = s.label;
            card.onclick = () => activeSpeakerId = s.speaker_id;
            grid.appendChild(card);
        });
    } catch (e) { console.log("خطأ تحميل الأصوات"); }
}

function checkReady() {
    const btn = document.getElementById('startBtn');
    const isOnline = document.getElementById('dot').classList.contains('on');
    if (btn) {
        btn.disabled = !(isOnline && selectedLangs.length > 0);
        btn.style.opacity = btn.disabled ? "0.5" : "1";
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
