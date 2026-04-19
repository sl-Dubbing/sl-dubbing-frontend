// استبدلي الدوال التالية في ملف script.js بالدوال المحدثة:

// 1. تحديث خيار Voice Clone
async function loadVoicesFromGithub() {
    const spkGrid = document.getElementById('spkGrid');
    if (!spkGrid) return;
    spkGrid.innerHTML = '';

    const sourceCard = document.createElement('div');
    sourceCard.className = 'spk-card active';
    // تم تغيير النص إلى Voice Clone
    sourceCard.innerHTML = `<i class="fas fa-check-circle chk"></i><div class="spk-av">VC</div><div class="spk-nm">Voice Clone</div>`;
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

// 2. تحديث الرصيد وزر الخروج
async function checkAuth() {
    try {
        const res = await fetch(API_BASE + '/api/user', { credentials: 'include' });
        const data = await res.json();
        if (data.success) {
            document.getElementById('authSection').innerHTML = `
                <div style="display:flex; gap:10px; align-items:center">
                    <div style="text-align:right">
                        <div style="font-weight:700">${data.user.name || 'User'}</div>
                        <div style="background:rgba(255,255,255,0.06); padding:6px; border-radius:8px; font-size:0.8rem">
                           Credits: ${data.user.credits} 💰
                        </div>
                    </div>
                    <button class="auth-btn" onclick="logout()">Logout</button>
                </div>`;
        }
    } catch (e) {}
}

// 3. تحديث حالة الزر عند البدء (Generating)
window.startDubbing = async function() {
    const btn = document.getElementById('startBtn');
    const mediaInput = document.getElementById('mediaFile');
    const mediaFile = mediaInput && mediaInput.files.length ? mediaInput.files[0] : null;
    
    if (!mediaFile) {
        showToast("Please upload a file first", "#b91c1c");
        return;
    }

    // تفعيل حالة الـ Loading للزر الجديد
    btn.disabled = true;
    btn.classList.add('loading');
    
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
            document.getElementById('statusTxt').innerText = 'Generating...';
            document.getElementById('progBar').style.width = '5%';
            pollInterval = setInterval(() => pollJob(currentJobId), 2000);
        } else { 
            showToast("Error: " + data.error, "#b91c1c"); 
            btn.disabled = false; 
            btn.classList.remove('loading');
        }
    } catch (e) { 
        showToast("Connection failed", "#b91c1c"); 
        btn.disabled = false; 
        btn.classList.remove('loading');
    }
};

// 4. تأكدي من إزالة الـ loading في حالة النجاح أو الفشل داخل pollJob:
// أضيفي هذا السطر في نهاية حالات pollJob (completed و failed):
// btn.classList.remove('loading');
