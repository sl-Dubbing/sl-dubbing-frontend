const API_BASE = 'https://web-production-14a1.up.railway.app';
const GITHUB_USER = "sl-Dubbing"; 
const REPO_NAME = "sl-dubbing-frontend";

let selectedVoice = 'source';
let selectedLang = 'en'; // Default to English now
let currentJobId = null;
let pollInterval = null;

document.addEventListener('DOMContentLoaded', () => {
    loadVoicesFromGithub();
    checkAuth();
    
    // Language Grid Setup
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

    // Media Upload Visual Interaction
    const mediaFile = document.getElementById('mediaFile');
    const mediaZone = document.getElementById('mediaZone');

    if (mediaFile && mediaZone) {
        mediaFile.addEventListener('change', () => {
            if (mediaFile.files.length > 0) {
                const file = mediaFile.files[0];
                const iconClass = file.type.startsWith('video') ? 'fa-file-video' : 'fa-file-audio';
                
                mediaZone.innerHTML = `
                    <i class="fas ${iconClass} fa-beat" style="font-size:2.5rem; margin-bottom:10px; color:#065f2c; display:block;"></i>
                    <span style="font-weight:bold; color:#065f2c;">File Prepared:</span><br>
                    <span style="font-size:0.9rem; color:#111827;">${file.name}</span>
                `;
                mediaZone.style.borderColor = '#065f2c';
                mediaZone.style.background = '#f0fdf4';
            }
        });
    }
});

async function loadVoicesFromGithub() {
    const spkGrid = document.getElementById('spkGrid');
    if (!spkGrid) return;
    spkGrid.innerHTML = '';

    const sourceCard = document.createElement('div');
    sourceCard.className = 'spk-card active';
    sourceCard.innerHTML = `<i class="fas fa-check-circle chk"></i><div class="spk-av">S</div><div class="spk-nm">Source Voice</div>`;
    sourceCard.onclick = () => selectVoice('source', sourceCard);
    spkGrid.appendChild(sourceCard);

    try {
        const url = `https://api.github.com/repos/${GITHUB_USER}/${REPO_NAME}/contents/samples?t=${Date.now()}`;
        const res = await fetch(url);
        const files = await res.json();
        files.filter(f => f.name.toLowerCase().endsWith('.mp3')).forEach(file => {
            const name = file.name.replace(/\.[^/.]+$/, "");
            const card = document.createElement('div');
            card.className = 'spk-card';
            card.innerHTML = `<i class="fas fa-check-circle chk"></i><div class="spk-av">${name[0].toUpperCase()}</div><div class="spk-nm">${name}</div>`;
            card.onclick = () => selectVoice(name, card);
            spkGrid.appendChild(card);
        });
    } catch (e) { console.error("Error loading voices", e); }
}

function selectVoice(id, el) {
    selectedVoice = id;
    document.querySelectorAll('.spk-card').forEach(c => c.classList.remove('active'));
    el.classList.add('active');
    if (id !== 'source') {
        const audio = new Audio("samples/" + id + ".mp3"); 
        audio.play().catch(() => console.warn("Preview not available"));
    }
}

window.startDubbing = async function() {
    const btn = document.getElementById('startBtn');
    const mediaInput = document.getElementById('mediaFile');
    const mediaFile = mediaInput && mediaInput.files.length ? mediaInput.files[0] : null;
    
    if (!mediaFile) {
        showToast("Please upload a video or audio file first", "#b91c1c");
        return;
    }

    btn.disabled = true;
    btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Sending to server...`;
    
    const voiceUrl = selectedVoice === 'source' ? '' : `https://raw.githubusercontent.com/${GITHUB_USER}/${REPO_NAME}/main/samples/${selectedVoice}.mp3`;

    const formData = new FormData();
    formData.append('lang', selectedLang);
    formData.append('voice_mode', selectedVoice === 'source' ? 'source' : 'xtts');
    formData.append('voice_url', voiceUrl);
    formData.append('media_file', mediaFile);

    try {
        const res = await fetch(API_BASE + '/api/dub', {
            method: 'POST',
            body: formData, 
            credentials: 'include' 
        });
        const data = await res.json();
        
        if (data.success) {
            currentJobId = data.job_id;
            document.getElementById('progressArea').style.display = 'block';
            document.getElementById('statusTxt').innerText = 'File uploaded! Processing...';
            document.getElementById('progBar').style.width = '5%';
            pollInterval = setInterval(() => pollJob(currentJobId), 2000);
        } else { 
            showToast("Error: " + data.error, "#b91c1c"); 
            btn.disabled = false; 
            btn.innerHTML = `<i class="fas fa-bolt"></i> Start Dubbing Process Now`;
        }
    } catch (e) { 
        showToast("Connection failed", "#b91c1c"); 
        btn.disabled = false; 
        btn.innerHTML = `<i class="fas fa-bolt"></i> Start Dubbing Process Now`;
    }
};

async function pollJob(jobId) {
    try {
        const res = await fetch(API_BASE + '/api/job/' + jobId, { credentials: 'include' });
        const data = await res.json();
        
        if (data.status === 'processing') {
            document.getElementById('statusTxt').innerText = 'AI is Dubbing your file...';
            let bar = document.getElementById('progBar');
            let cur = parseInt(bar.style.width) || 10;
            cur = Math.min(90, cur + 1); 
            bar.style.width = cur + '%';
            document.getElementById('pctTxt').innerText = cur + '%';
        } else if (data.status === 'completed') {
            clearInterval(pollInterval);
            document.getElementById('statusTxt').innerText = 'Magic Complete!';
            document.getElementById('progBar').style.width = '100%';
            document.getElementById('pctTxt').innerText = '100%';
            document.getElementById('resCard').style.display = 'block';
            document.getElementById('dubAud').src = data.audio_url;
            document.getElementById('dlBtn').href = data.audio_url;

            const btn = document.getElementById('startBtn');
            btn.disabled = false;
            btn.innerHTML = `<i class="fas fa-bolt"></i> Start Dubbing Process Now`;
            showToast("Success! Audio is ready.", "#065f2c");
            checkAuth();
        } else if (data.status === 'failed') {
            clearInterval(pollInterval);
            document.getElementById('statusTxt').innerText = 'Process Failed';
            showToast("Dubbing failed. Credits refunded.", "#b91c1c");
            document.getElementById('startBtn').disabled = false;
            document.getElementById('startBtn').innerHTML = `<i class="fas fa-bolt"></i> Start Dubbing Process Now`;
            checkAuth();
        }
    } catch (e) { console.error("Polling error", e); }
}

async function checkAuth() {
    try {
        const res = await fetch(API_BASE + '/api/user', { credentials: 'include' });
        const data = await res.json();
        if (data.success) {
            document.getElementById('authSection').innerHTML = `
                <div style="display:flex; gap:10px; align-items:center">
                    <div style="text-align:right">
                        <div style="font-weight:700">${data.user.name || 'User'}</div>
                        <div style="background:rgba(255,255,255,0.06); padding:6px; border-radius:8px; font-size:0.8rem">Credits: ${data.user.credits}</div>
                    </div>
                    <button class="auth-btn" onclick="logout()">Logout</button>
                </div>`;
        }
    } catch (e) {}
}

window.logout = async function() {
    try {
        await fetch(API_BASE + '/api/auth/logout', { method: 'POST', credentials: 'include' });
        location.reload();
    } catch (e) { location.reload(); }
};

function showToast(msg, color='#0f0f10') {
    const t = document.createElement('div');
    t.className = 'toast show';
    t.style.background = color;
    t.innerText = msg;
    document.getElementById('toasts').appendChild(t);
    setTimeout(() => { t.remove(); }, 3500); 
}
