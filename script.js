// ============================================================
// script.js — sl-Dubbing Frontend (DYNAMIC & ENHANCED)
// ============================================================

// ═══════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════

const CONFIG = {
    // رابط السيرفر على Railway
    API_BASE: 'https://web-production-14a1.up.railway.app',
    
    // إعدادات جيت هب للأصوات الديناميكية
    GITHUB_USER: "abd19", 
    REPO_NAME: "sl-dubbing-frontend-main",

    LANGS: [
        {c:'ar', n:'العربية', f:'🇸🇦'},
        {c:'en', n:'English', f:'🇺🇸'},
        {c:'es', n:'Español', f:'🇪🇸'},
        {c:'fr', n:'Français', f:'🇫🇷'},
        {c:'de', n:'Deutsch', f:'🇩🇪'},
        {c:'it', n:'Italiano', f:'🇮🇹'},
        {c:'ru', n:'Русский', f:'🇷🇺'},
        {c:'tr', n:'Türkçe', f:'🇹🇷'},
        {c:'zh', n:'中文', f:'🇨🇳'},
        {c:'hi', n:'हिन्दी', f:'🇮🇳'},
        {c:'fa', n:'فارسی', f:'🇮🇷'}
    ]
};

const STATE = {
    lang: 'ar',
    voiceMode: 'source',
    srtData: [],
    rawSRT: '',
    selectedVoice: 'source', // القيمة الافتراضية
    currentUser: null,
    currentCredits: 0,
};

// ════════════════════════════════════════════════════
// NETWORK HELPERS (Updated to use fetch with credentials)
// ════════════════════════════════════════════════════

async function apiGet(path) {
    return fetch(CONFIG.API_BASE + path, {
        method: 'GET',
        credentials: 'include' // مهم جداً لنقل الـ Cookies بين السيرفر والواجهة
    });
}

async function apiPost(path, data) {
    return fetch(CONFIG.API_BASE + path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        credentials: 'include'
    });
}

// ════════════════════════════════════════════════════
// DYNAMIC VOICES FROM GITHUB
// ════════════════════════════════════════════════════

async function loadVoicesFromGithub() {
    const spkGrid = document.getElementById('spkGrid');
    if (!spkGrid) return;
    
    spkGrid.innerHTML = ''; // تنظيف الشبكة
    
    // إضافة خيار صوت المصدر يدوياً كخيار أول دائماً
    createVoiceCard('source', 'صوت المصدر');

    try {
        const githubApiUrl = `https://api.github.com/repos/${CONFIG.GITHUB_USER}/${CONFIG.REPO_NAME}/contents/samples?t=${Date.now()}`;
        const response = await fetch(githubApiUrl);
        
        if (!response.ok) throw new Error("Could not fetch samples");
        
        const files = await response.json();
        const audioFiles = files.filter(file => file.name.toLowerCase().endsWith('.mp3'));

        audioFiles.forEach(file => {
            const voiceName = file.name.replace(/\.[^/.]+$/, ""); // حذف .mp3
            createVoiceCard(voiceName, voiceName);
        });
    } catch (error) {
        console.error("خطأ في جلب العينات:", error);
        // خيارات احتياطية في حال الفشل (يمكنك تركها فارغة أو إضافة أصوات افتراضية)
        createVoiceCard('muhamed', 'Muhamed');
    }
}

function createVoiceCard(id, displayName) {
    const spkGrid = document.getElementById('spkGrid');
    const card = document.createElement('div');
    card.className = 'spk-card' + (id === STATE.selectedVoice ? ' active' : '');
    card.innerText = displayName;
    card.onclick = () => selectVoice(id, card);
    spkGrid.appendChild(card);
}

function selectVoice(id, el) {
    STATE.selectedVoice = id;
    STATE.voiceMode = (id === 'source') ? 'source' : 'xtts';
    
    document.querySelectorAll('.spk-card').forEach(c => c.classList.remove('active'));
    el.classList.add('active');

    // تشغيل معاينة الصوت من مجلد samples
    if (id !== 'source') {
        const audio = new Audio(`samples/${id}.mp3`);
        audio.play().catch(e => console.log("العينة الصوتية غير متوفرة بعد"));
    }
    console.log('🎤 Voice selected:', id);
}

// ════════════════════════════════════════════════════
// SRT & UI HELPERS
// ════════════════════════════════════════════════════

function showToast(msg, color='#0f0f10') {
    let t = document.getElementById('toast');
    if (!t) {
        t = document.createElement('div');
        t.id = 'toast';
        t.className = 'toast';
        document.body.appendChild(t);
    }
    t.style.background = color;
    t.innerText = msg;
    t.classList.add('show');
    setTimeout(() => { t.classList.remove('show'); }, 3500);
}

function parseSRT(content) {
    STATE.srtData = [];
    let cur = null;
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) { if (cur) STATE.srtData.push(cur); cur = null; continue; }
        if (/^\d+$/.test(line)) { if (cur) STATE.srtData.push(cur); cur = {i: parseInt(line), t: '', x: ''}; }
        else if (line.includes('-->')) { if (cur) cur.t = line; }
        else if (cur) { cur.x += line + ' '; }
    }
    if (cur) STATE.srtData.push(cur);
}

// ════════════════════════════════════════════════════
// AUTH & SESSION
// ════════════════════════════════════════════════════

async function checkAuth() {
    try {
        const res = await apiGet('/api/user');
        const data = await res.json();
        if (res.ok && data.success) {
            STATE.currentUser = data.user;
            STATE.currentCredits = data.user.credits;
            renderProfile(data.user);
        } else {
            renderAuthBtn();
        }
    } catch (err) { renderAuthBtn(); }
}

function renderProfile(user) {
    const sec = document.getElementById('authSection');
    sec.innerHTML = `
    <div style="display:flex;gap:10px;align-items:center">
        <div style="text-align:right">
            <div style="font-weight:700">${user.name}</div>
            <div style="background:rgba(255,255,255,0.06);padding:6px;border-radius:8px">رصيد: ${user.credits}</div>
        </div>
        <button class="auth-btn" onclick="logout()">خروج</button>
    </div>`;
}

function renderAuthBtn() {
    document.getElementById('authSection').innerHTML = '<button class="auth-btn" onclick="openLogin()">تسجيل / دخول</button>';
}

function openLogin() { document.getElementById('loginModal').style.display = 'flex'; }
function closeLogin() { document.getElementById('loginModal').style.display = 'none'; }

function logout() {
    apiPost('/api/auth/logout', {}).then(() => {
        window.location.reload();
    });
}

// ════════════════════════════════════════════════════
// MAIN DUBBING PROCESS
// ════════════════════════════════════════════════════

async function startDubbing() {
    const btn = document.getElementById('startBtn');
    if (!STATE.currentUser) { showToast('يرجى تسجيل الدخول أولاً', '#b91c1c'); openLogin(); return; }
    
    const srtInput = document.getElementById('srtFile');
    if (!srtInput.files.length) { showToast('يرجى رفع ملف SRT أولاً', '#b91c1c'); return; }
    
    const file = srtInput.files[0];
    STATE.rawSRT = await file.text();
    parseSRT(STATE.rawSRT);

    btn.disabled = true;
    btn.innerText = 'جاري الإرسال...';
    document.getElementById('progressArea').style.display = 'block';

    const payload = {
        srt: STATE.rawSRT,
        lang: STATE.lang,
        voice_mode: STATE.voiceMode,
        voice_id: STATE.selectedVoice === 'source' ? '' : STATE.selectedVoice
    };

    try {
        const res = await apiPost('/api/dub', payload);
        const data = await res.json();
        
        if (!res.ok) throw new Error(data.error || 'خطأ في السيرفر');

        currentJobId = data.job_id;
        pollInterval = setInterval(() => pollJob(currentJobId), 2000);
    } catch (err) {
        showToast(err.message, '#b91c1c');
        btn.disabled = false;
        btn.innerText = 'ابدأ معالجة الدبلجة';
    }
}

async function pollJob(jobId) {
    try {
        const res = await apiGet('/api/job/' + jobId);
        const data = await res.json();
        const progBar = document.getElementById('progBar');
        
        if (data.status === 'processing') {
            let cur = parseInt(progBar.style.width) || 10;
            progBar.style.width = Math.min(95, cur + 5) + '%';
        } else if (data.status === 'completed') {
            clearInterval(pollInterval);
            progBar.style.width = '100%';
            showResult(data.audio_url);
            checkAuth(); // تحديث الرصيد
        } else if (data.status === 'failed') {
            clearInterval(pollInterval);
            showToast('فشلت المعالجة', '#b91c1c');
            document.getElementById('startBtn').disabled = false;
        }
    } catch (e) { console.error(e); }
}

function showResult(url) {
    document.getElementById('resCard').style.display = 'block';
    document.getElementById('dubAud').src = url;
    document.getElementById('dlBtn').href = url;
    document.getElementById('progressArea').style.display = 'none';
    document.getElementById('startBtn').disabled = false;
    document.getElementById('startBtn').innerText = 'ابدأ معالجة الدبلجة';
}

// ════════════════════════════════════════════════════
// INITIALIZATION
// ════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {
    // بناء شبكة اللغات
    const langGrid = document.getElementById('langGrid');
    CONFIG.LANGS.forEach(l => {
        const box = document.createElement('div');
        box.className = 'lang-box' + (l.c === STATE.lang ? ' active' : '');
        box.innerHTML = `<span>${l.f}</span><br>${l.n}`;
        box.onclick = () => {
            document.querySelectorAll('.lang-box').forEach(b => b.classList.remove('active'));
            box.classList.add('active');
            STATE.lang = l.c;
        };
        langGrid.appendChild(box);
    });

    // مراقبة ملف الـ SRT
    document.getElementById('srtFile').onchange = (e) => {
        if (e.target.files[0]) document.getElementById('srtZone').innerText = e.target.files[0].name;
    };

    loadVoicesFromGithub();
    checkAuth();
});

function initLangs() {} // تم دمجها في DOMContentLoaded
