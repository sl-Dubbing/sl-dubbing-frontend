const API_BASE = 'https://web-production-14a1.up.railway.app';
const GITHUB_USER = "sl-Dubbing"; 
const REPO_NAME = "sl-dubbing-frontend"; // 🟢 مسار المستودع الصحيح

let selectedVoice = 'source';
let selectedLang = 'ar'; 
let currentJobId = null;
let pollInterval = null;

document.addEventListener('DOMContentLoaded', () => {
    loadVoices();
    checkAuth();
    
    const langGrid = document.getElementById('langGrid');
    if (langGrid) {
        const langs = ['en','ar','es','fr','de','it','pt','tr','ru','zh','ja','ko','hi'];
        langGrid.innerHTML = '';
        langs.forEach(l => {
            const el = document.createElement('div');
            el.className = 'lang-box' + (l === selectedLang ? ' active' : '');
            el.innerText = l.toUpperCase();
            el.onclick = () => {
                document.querySelectorAll('.lang-box').forEach(n => n.classList.remove('active'));
                el.classList.add('active');
                selectedLang = l;
            };
            langGrid.appendChild(el);
        });
    }

    const mediaFile = document.getElementById('mediaFile');
    const mediaZone = document.getElementById('mediaZone');
    if (mediaFile && mediaZone) {
        mediaFile.addEventListener('change', () => {
            if (mediaFile.files.length > 0) {
                const file = mediaFile.files[0];
                mediaZone.innerHTML = `
                    <i class="fas fa-file-check fa-beat" style="font-size:2rem; margin-bottom:10px; color:#065f2c; display:block;"></i>
                    <span style="font-weight:bold; color:#065f2c;">File Ready!</span><br>
                    <span style="font-size:0.85rem; color:#111827;">${file.name}</span>
                `;
                mediaZone.style.borderColor = '#065f2c';
                mediaZone.style.background = '#f0fdf4';
            }
        });
    }
});

// 🟢 الإصلاح الأول: جلب الأصوات تلقائياً من جيتهاب من مجلد speakers
async function loadVoices() {
    const spkGrid = document.getElementById('spkGrid');
    if (!spkGrid) return;
    spkGrid.innerHTML = '';

    const sourceCard = document.createElement('div');
    sourceCard.className = 'spk-card active';
    sourceCard.innerHTML = `
        <i class="fas fa-check-circle chk"></i>
        <div class="voice-ai-icon"><i class="fas fa-microphone"></i></div>
        <div class="spk-nm">Keep Original Voice</div>`;
    sourceCard.onclick = () => selectVoice('source', sourceCard);
    spkGrid.appendChild(sourceCard);

    try {
        const res = await fetch(`https://api.github.com/repos/${GITHUB_USER}/${REPO_NAME}/contents/speakers`);
        if (res.ok) {
            const files = await res.json();
            files.filter(f => f.name.endsWith('.mp3')).forEach(file => {
                const name = file.name.replace('.mp3', '');
                const card = document.createElement('div');
                card.className = 'spk-card';
                card.innerHTML = `
                    <i class="fas fa-check-circle chk"></i>
                    <div class="spk-av"><i class="fas fa-user"></i></div>
                    <div class="spk-nm">${name}</div>`;
                card.onclick = () => selectVoice(name, card);
                spkGrid.appendChild(card);
            });
        }
    } catch (e) {
        console.warn("Could not load voices from GitHub");
    }
}

function selectVoice(id, el) {
    selectedVoice = id;
    document.querySelectorAll('.spk-card').forEach(c => c.classList.remove('active'));
    el.classList.add('active');
}

window.startDubbing = async function() {
    const btn = document.getElementById('startBtn');
    const mediaFile = document.getElementById('mediaFile').files[0];
    if (!mediaFile) { showToast("Please select a video or audio file first", "#b91c1c"); return; }

    btn.disabled = true;
    btn.classList.add('loading');
    
    const formData = new FormData();
    formData.append('lang', selectedLang);
    // 🟢 الإصلاح الثاني: تمرير اسم الصوت فقط (السيرفر سيتولى البحث عنه)
    formData.append('voice_mode', selectedVoice); 
    formData.append('voice_url', ''); 
    formData.append('media_file', mediaFile);

    try {
        const res = await fetch(API_BASE + '/api/dub', { method: 'POST', body: formData, credentials: 'include' });
        const data = await res.json();
        if (data.success) {
            currentJobId = data.job_id;
            document.getElementById('progressArea').style.display = 'block';
            document.getElementById('statusTxt').innerText = 'Sending to AI Factory...';
            // الاعتماد على الـ Polling كما صممتِه بذكاء
            pollInterval = setInterval(() => pollJob(currentJobId), 2000); 
        } else { 
            showToast(data.error || "Error starting dubbing", "#b91c1c"); 
            btn.disabled = false; btn.classList.remove('loading');
        }
    } catch (e) { 
        showToast("Connection to server failed", "#b91c1c"); 
        btn.disabled = false; btn.classList.remove('loading');
    }
};

async function pollJob(jobId) {
    try {
        const res = await fetch(API_BASE + '/api/job/' + jobId, { credentials: 'include' });
        const data = await res.json();
        const btn = document.getElementById('startBtn');
        
        if (data.status === 'processing') {
            document.getElementById('statusTxt').innerText = 'AI is Dubbing (This takes 2-5 mins)...';
            let bar = document.getElementById('progBar');
            let cur = parseInt(bar.style.width) || 5;
            cur = Math.min(95, cur + 1); 
            bar.style.width = cur + '%';
            document.getElementById('pctTxt').innerText = cur + '%';
        } else if (data.status === 'completed') {
            clearInterval(pollInterval);
            document.getElementById('statusTxt').innerText = 'Success!';
            document.getElementById('progBar').style.width = '100%';
            document.getElementById('pctTxt').innerText = '100%';
            
            document.getElementById('resCard').style.display = 'block';
            document.getElementById('dlBtn').href = data.audio_url;
            
            // 🟢 الإصلاح الثالث: التفرقة بين الفيديو والصوت في العرض
            const isVideo = document.getElementById('mediaFile').files[0].type.startsWith('video');
            if (isVideo) {
                const vid = document.getElementById('dubVid');
                if(vid) { vid.style.display = 'block'; vid.src = data.audio_url; }
                const aud = document.getElementById('dubAud');
                if(aud) { aud.style.display = 'none'; }
            } else {
                const aud = document.getElementById('dubAud');
                if(aud) { aud.style.display = 'block'; aud.src = data.audio_url; }
                const vid = document.getElementById('dubVid');
                if(vid) { vid.style.display = 'none'; }
            }

            btn.disabled = false; btn.classList.remove('loading');
            showToast("Media Dubbing Complete!", "#065f2c");
            checkAuth();
        } else if (data.status === 'failed' || data.status === 'error') {
            clearInterval(pollInterval);
            btn.disabled = false; btn.classList.remove('loading');
            document.getElementById('statusTxt').innerText = 'Process Failed!';
            document.getElementById('progBar').style.background = '#ef4444';
            showToast("Dubbing failed! Please check if the audio is clear.", "#b91c1c");
            checkAuth();
        }
    } catch (e) { console.error(e); }
}

async function checkAuth() {
    try {
        const res = await fetch(API_BASE + '/api/user', { credentials: 'include' });
        const data = await res.json();
        if (data.success) {
            document.getElementById('authSection').innerHTML = `
                <div style="display:flex; gap:12px; align-items:center">
                    <div style="text-align:right">
                        <div style="font-weight:700; color:#fff">${data.user.name || 'User'}</div>
                        <div style="background:rgba(255,255,255,0.1); padding:4px 10px; border-radius:8px; font-size:0.8rem; color:#a4fec4">
                           Balance: ${data.user.credits} 💰
                        </div>
                    </div>
                    <button class="auth-btn" onclick="logout()">Logout</button>
                </div>`;
        }
    } catch (e) {}
}

window.logout = async function() {
    try { await fetch(API_BASE + '/api/auth/logout', { method: 'POST', credentials: 'include' }); location.reload(); }
    catch (e) { location.reload(); }
};

function showToast(msg, color) {
    const t = document.createElement('div');
    t.className = 'toast show';
    t.style.background = color;
    t.innerText = msg;
    document.getElementById('toasts').appendChild(t);
    setTimeout(() => { t.remove(); }, 4000); 
}
