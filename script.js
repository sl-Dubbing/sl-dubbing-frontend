// ==========================================
// 🚀 AI Smart Dubbing - Main Script
// ==========================================

const API_BASE = 'https://web-production-14a1.up.railway.app';
const GITHUB_USER = "sl-Dubbing"; 
const REPO_NAME = "sl-dubbing-frontend"; 

let selectedVoiceUrl = '';
let selectedVoiceId = 'source'; // الوضع الافتراضي هو الصوت الأصلي
let customBase64 = '';
let selectedLang = 'ar';
let evtSource = null;

// جميع اللغات الـ 17 المدعومة
const LANGS = [
    {c:'ar', n:'Arabic', f:'🇸🇦'}, {c:'en', n:'English', f:'🇺🇸'},
    {c:'es', n:'Spanish', f:'🇪🇸'}, {c:'fr', n:'French', f:'🇫🇷'},
    {c:'de', n:'German', f:'🇩🇪'}, {c:'it', n:'Italian', f:'🇮🇹'},
    {c:'pt', n:'Portuguese', f:'🇵🇹'}, {c:'tr', n:'Turkish', f:'🇹🇷'},
    {c:'ru', n:'Russian', f:'🇷🇺'}, {c:'nl', n:'Dutch', f:'🇳🇱'},
    {c:'cs', n:'Czech', f:'🇨🇿'}, {c:'pl', n:'Polish', f:'🇵🇱'},
    {c:'hu', n:'Hungarian', f:'🇭🇺'}, {c:'zh', n:'Chinese', f:'🇨🇳'},
    {c:'ja', n:'Japanese', f:'🇯🇵'}, {c:'ko', n:'Korean', f:'🇰🇷'},
    {c:'hi', n:'Hindi', f:'🇮🇳'}
];

// 🟢 عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', () => { 
    checkAuth(); 
    renderLangs(); 
    loadVoicesFromGitHub(); 
    setupMediaListener();
});

// 🟢 إعداد مستمع لتغير الملف المرفوع (لتحسين شكل الواجهة)
function setupMediaListener() {
    const mediaInput = document.getElementById('mediaFile');
    if (mediaInput) {
        mediaInput.addEventListener('change', function() {
            const fileTxt = document.getElementById('fileTxt');
            if (this.files.length > 0 && fileTxt) {
                fileTxt.innerHTML = `<span style="color:#065f2c;"><i class="fas fa-check-circle"></i> ${this.files[0].name}</span>`;
            }
        });
    }
}

// 🟢 رسم شبكة اللغات
function renderLangs() {
    const grid = document.getElementById('langGrid');
    if (!grid) return;
    
    grid.innerHTML = LANGS.map(l => `
        <div class="item-card ${l.c === selectedLang ? 'active' : ''}" onclick="setLang('${l.c}', this)">
            <div style="font-size:1.8rem; margin-bottom:5px;">${l.f}</div>
            <div style="font-size:0.8rem; font-weight:bold;">${l.n}</div>
        </div>
    `).join('');
}

// 🟢 اختيار اللغة
function setLang(code, el) { 
    selectedLang = code; 
    document.querySelectorAll('#langGrid .item-card').forEach(x => x.classList.remove('active')); 
    el.classList.add('active'); 
}

// 🟢 جلب الأصوات مباشرة من GitHub
async function loadVoicesFromGitHub() {
    const spkGrid = document.getElementById('spkGrid');
    if (!spkGrid) return;

    try {
        const res = await fetch(`https://api.github.com/repos/${GITHUB_USER}/${REPO_NAME}/contents/speakers`);
        if (res.ok) {
            const files = await res.json();
            files.filter(f => f.name.endsWith('.mp3')).forEach(file => {
                const name = file.name.replace('.mp3', '');
                const div = document.createElement('div'); 
                div.className = 'item-card'; 
                div.innerHTML = `<i class="fas fa-user-astronaut" style="display:block; margin-bottom:8px; font-size:1.2rem;"></i>${name}`;
                div.onclick = () => setVoice('', name, div);
                spkGrid.appendChild(div);
            });
        }
    } catch (e) {
        console.warn("Could not load voices from GitHub", e);
    }
}

// 🟢 اختيار الصوت
function setVoice(url, id, el) { 
    selectedVoiceUrl = url; 
    selectedVoiceId = id; 
    customBase64 = '';
    
    const customTxt = document.getElementById('customVoiceTxt');
    if (customTxt) customTxt.innerText = '';
    
    document.querySelectorAll('#spkGrid .item-card').forEach(x => x.classList.remove('active')); 
    if(el) el.classList.add('active'); 
}

// 🟢 معالجة عينة الصوت المخصصة (Custom Voice Clone)
function handleCustomVoice(input) {
    if(input.files.length > 0) {
        document.querySelectorAll('#spkGrid .item-card').forEach(x => x.classList.remove('active'));
        selectedVoiceUrl = ''; 
        selectedVoiceId = '';
        
        const customTxt = document.getElementById('customVoiceTxt');
        if (customTxt) customTxt.innerText = "Selected: " + input.files[0].name;
        
        const reader = new FileReader();
        reader.readAsDataURL(input.files[0]);
        reader.onload = () => { 
            customBase64 = reader.result.split(',')[1]; 
        };
    }
}

// 🟢 بدء عملية الدبلجة
async function startDubbing() {
    const mediaInput = document.getElementById('mediaFile');
    if (!mediaInput || !mediaInput.files[0]) {
        return showToast("Please select a media file first!", "#b91c1c");
    }
    
    const file = mediaInput.files[0];
    const btn = document.getElementById('dubBtn');
    
    if (btn) btn.disabled = true;
    const progressArea = document.getElementById('progressArea');
    if (progressArea) progressArea.style.display = 'block';
    
    const resCard = document.getElementById('resCard');
    if (resCard) resCard.style.display = 'none';

    const fd = new FormData();
    fd.append('media_file', file);
    fd.append('lang', selectedLang);
    if (selectedVoiceUrl) fd.append('voice_url', selectedVoiceUrl);
    if (selectedVoiceId) fd.append('voice_id', selectedVoiceId);
    if (customBase64) fd.append('sample_b64', customBase64);

    try {
        const res = await fetch(`${API_BASE}/api/dub`, { method: 'POST', body: fd, credentials: 'include' });
        const data = await res.json();
        
        if (data.success && data.job_id) {
            startSSE(data.job_id);
        } else {
            throw new Error(data.error || "Server connection failed");
        }
    } catch(e) {
        showToast(e.message, "#b91c1c"); 
        if (btn) btn.disabled = false;
    }
}

// 🟢 الاستماع لتقدم العملية عبر SSE
function startSSE(jobId) {
    if (evtSource) evtSource.close();
    evtSource = new EventSource(`${API_BASE}/api/progress/${jobId}`, { withCredentials: true });

    evtSource.onmessage = function(event) {
        const data = JSON.parse(event.data);
        
        const progFill = document.getElementById('progFill');
        const pctTxt = document.getElementById('pctTxt');
        const statusTxt = document.getElementById('statusTxt');
        
        if (progFill) progFill.style.width = data.progress + '%';
        if (pctTxt) pctTxt.innerText = data.progress + '%';
        if (statusTxt) statusTxt.innerText = "Status: " + data.status;

        if (data.status === 'done' || data.status === 'completed') {
            evtSource.close();
            
            const resCard = document.getElementById('resCard');
            if (resCard) resCard.style.display = 'block';
            
            const dlBtn = document.getElementById('dlBtn');
            if (dlBtn) dlBtn.href = data.audio_url;

            // التفرقة بين الفيديو والصوت
            const mediaInput = document.getElementById('mediaFile');
            const isVideo = mediaInput && mediaInput.files[0] && mediaInput.files[0].type.startsWith('video');
            
            const vid = document.getElementById('dubVid');
            const aud = document.getElementById('dubAud');

            if (isVideo && vid && aud) {
                vid.style.display = 'block'; 
                vid.src = data.audio_url;
                aud.style.display = 'none';
            } else if (vid && aud) {
                aud.style.display = 'block'; 
                aud.src = data.audio_url;
                vid.style.display = 'none';
            }

            const btn = document.getElementById('dubBtn');
            if (btn) btn.disabled = false;
            
            showToast("Dubbing Complete!", "#065f2c");
            checkAuth();
            
        } else if (data.status === 'failed' || data.status === 'error') {
            evtSource.close();
            showToast("Processing Failed.", "#b91c1c");
            const btn = document.getElementById('dubBtn');
            if (btn) btn.disabled = false;
        }
    };
    
    evtSource.onerror = function() { 
        evtSource.close(); 
    };
}

// 🟢 التحقق من تسجيل الدخول وجلب الرصيد
async function checkAuth() {
    const authSection = document.getElementById('authSection');
    if (!authSection) return;

    try {
        const r = await fetch(`${API_BASE}/api/user`, { credentials: 'include' });
        const d = await r.json();
        
        if (d.success) {
            authSection.innerHTML = `
                <div style="display:flex; gap:12px; align-items:center">
                    <div style="text-align:right">
                        <div style="font-weight:700; color:#fff">${d.user.name || 'User'}</div>
                        <div style="background:rgba(255,255,255,0.1); padding:4px 10px; border-radius:8px; font-size:0.8rem; color:var(--gold-light)">
                            Balance: ${d.user.credits} 💰
                        </div>
                    </div>
                    <button onclick="logout()" style="background:var(--purple-light); color:#fff; border:none; padding:8px 15px; border-radius:10px; cursor:pointer; font-weight:bold;">Logout</button>
                </div>`;
        } else {
            authSection.innerHTML = `<a href="login.html" style="color:var(--gold); text-decoration:none; font-weight:bold;">Login</a>`;
        }
    } catch(e) { 
        authSection.innerHTML = `<a href="login.html" style="color:var(--gold); text-decoration:none; font-weight:bold;">Login</a>`; 
    }
}

// 🟢 تسجيل الخروج
window.logout = async function() {
    try { 
        await fetch(API_BASE + '/api/auth/logout', { method: 'POST', credentials: 'include' }); 
        location.reload(); 
    } catch (e) { 
        location.reload(); 
    }
};

// 🟢 إظهار التنبيهات (Toasts)
function showToast(msg, color) {
    const t = document.getElementById('toasts');
    if (!t) return;
    
    const box = document.createElement('div'); 
    box.className = 'toast'; 
    box.style.background = color || '#ef4444';
    box.innerHTML = msg;
    
    t.appendChild(box); 
    
    // إخفاء وحذف بعد 4 ثوانٍ
    setTimeout(() => { 
        box.style.opacity = '0';
        box.style.transform = 'translateY(20px)';
        setTimeout(() => box.remove(), 300);
    }, 4000);
}
