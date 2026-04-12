'use strict';

const API_BASE = 'https://sl-dubbing-backend-production.up.railway.app';

let selectedLangs = [];
let srtSegments = [];
let activeSpeakerId = 'muhammad';

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

function createSpeakerCard(s) {
    const card = document.createElement('div');
    card.className = `spk-card ${activeSpeakerId === s.speaker_id ? 'active' : ''}`;
    card.setAttribute('data-id', s.speaker_id);
    card.innerHTML = `
        <i class="fas fa-check-circle chk"></i>
        <div class="spk-av">${s.label[0].toUpperCase()}</div>
        <div class="spk-nm">${s.label}</div>
        ${s.isDefault ? '<div class="def-badge">افتراضي</div>' : ''}
    `;
    card.onclick = function() {
        activeSpeakerId = s.speaker_id;
        document.querySelectorAll('.spk-card').forEach(c => c.classList.remove('active'));
        card.classList.add('active');
    };
    return card;
}

async function loadSpeakers() {
    const grid = document.getElementById('spkGrid');
    if (!grid) return;
    grid.innerHTML = '';
    grid.appendChild(createSpeakerCard({ speaker_id: 'muhammad', label: 'محمد', isDefault: true }));
    const addCard = document.createElement('div');
    addCard.className = 'spk-card add-card';
    addCard.innerHTML = `<i class="fas fa-plus"></i><span>استنساخ صوت</span>`;
    addCard.onclick = function() { document.getElementById('spkFile').click(); };
    grid.appendChild(addCard);
}

function buildLangGrid() {
    const grid = document.getElementById('langGrid');
    if (!grid) return;
    grid.innerHTML = '';
    SUPPORTED_LANGS.forEach(l => {
        const box = document.createElement('div');
        box.className = 'lang-box';
        box.innerHTML = `${l.flag} <span>${l.name}</span>`;
        box.onclick = function() {
            selectedLangs = [l.code];
            document.querySelectorAll('.lang-box').forEach(b => b.classList.remove('active'));
            box.classList.add('active');
            checkReady();
        };
        grid.appendChild(box);
    });
}

document.getElementById('srtFile').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(ev) {
        srtSegments = parseSRT(ev.target.result);
        const zone = document.getElementById('srtZone');
        zone.className = 'srt-zone ok';
        zone.innerHTML = `<i class="fas fa-check-circle"></i><div class="srt-lbl">تم رفع ${file.name}</div>`;
        checkReady();
    };
    reader.readAsText(file);
});

function parseSRT(data) {
    const segments = [];
    const blocks = data.trim().split(/\n\s*\n/);
    blocks.forEach(block => {
        const lines = block.split('\n');
        if (lines.length >= 3) {
            const text = lines.slice(2).join(' ').trim();
            if (text) segments.push({ text: text });
        }
    });
    return segments;
}

async function start() {
    const btn = document.getElementById('startBtn');
    if (btn.style.cursor === 'not-allowed') return;

    btn.style.display = 'none';
    document.getElementById('progressArea').style.display = 'block';
    document.getElementById('loader').style.display = 'flex';

    try {
        const payload = {
            segments: srtSegments,
            lang: selectedLangs[0],
            speaker_id: activeSpeakerId,
            yt_url: document.getElementById('ytUrl').value
        };

        const res = await fetch(`${API_BASE}/dub`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await res.json();
        if (data.task_id) {
            pollStatus(data.task_id);
        } else {
            alert("فشل في بدء المهمة");
            resetUI();
        }
    } catch (e) {
        alert("فشل الاتصال بالسيرفر");
        resetUI();
    }
}

function pollStatus(taskId) {
    const progBar = document.getElementById('progBar');
    const statusTxt = document.getElementById('statusTxt');
    const pctTxt = document.getElementById('pctTxt');

    const interval = setInterval(async () => {
        try {
            const res = await fetch(`${API_BASE}/status/${taskId}`);
            const data = await res.json();

            if (data.status === 'done') {
                clearInterval(interval);
                showResult(data.audio_url);
            } else if (data.status === 'processing' && data.percent) {
                progBar.style.width = data.percent + '%';
                pctTxt.innerText = data.percent + '%';
                statusTxt.innerText = data.msg;
            } else if (data.status === 'error') {
                clearInterval(interval);
                alert("خطأ من السيرفر: " + data.message);
                resetUI();
            }
        } catch (e) {
            console.error("Polling error", e);
        }
    }, 4000);
}

function showResult(url) {
    document.getElementById('progressArea').style.display = 'none';
    const resCard = document.getElementById('resCard');
    resCard.style.display = 'block';
    const resList = document.getElementById('resList');
    resList.innerHTML = `
        <div class="res-item">
            <div class="res-hd">
                <span class="res-lang">الدبلجة جاهزة (${selectedLangs[0]})</span>
                <a href="${url}" target="_blank" class="btn2">تحميل</a>
            </div>
            <audio controls src="${url}"></audio>
        </div>
    `;
    resCard.scrollIntoView({ behavior: 'smooth' });
}

function resetUI() {
    document.getElementById('startBtn').style.display = 'flex';
    document.getElementById('progressArea').style.display = 'none';
}

function checkReady() {
    const btn = document.getElementById('startBtn');
    const isReady = srtSegments.length > 0 && selectedLangs.length > 0;
    btn.style.opacity = isReady ? "1" : "0.5";
    btn.style.cursor = isReady ? "pointer" : "not-allowed";
}

async function updateStatus() {
    try {
        const res = await fetch(`${API_BASE}/api/status`);
        const data = await res.json();
        const dot = document.getElementById('dot');
        const dotLbl = document.getElementById('dotLbl');
        if (data.status === 'online') {
            dot.classList.add('on');
            dotLbl.innerText = "System Online";
        } else {
            dot.classList.remove('on');
            dotLbl.innerText = "System Offline";
        }
    } catch (e) {
        document.getElementById('dot').classList.remove('on');
        document.getElementById('dotLbl').innerText = "System Offline";
    }
}

function onUrl(val) {}

document.addEventListener('DOMContentLoaded', function() {
    buildLangGrid();
    loadSpeakers();
    updateStatus();
    setInterval(updateStatus, 10000);
});
