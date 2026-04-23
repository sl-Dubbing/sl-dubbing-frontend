let selectedVoiceId = 'source';
let selectedLang = '';
let customVoiceBase64 = '';

const LANGS = [
    {c:'ar', n:'Arabic', f:'🇸🇦'}, {c:'en', n:'English', f:'🇺🇸'},
    {c:'es', n:'Spanish', f:'🇪🇸'}, {c:'fr', n:'French', f:'🇫🇷'},
    {c:'de', n:'German', f:'🇩🇪'}, {c:'it', n:'Italian', f:'🇮🇹'},
    {c:'pt', n:'Portuguese', f:'🇵🇹'}, {c:'tr', n:'Turkish', f:'🇹🇷'},
    {c:'ru', n:'Russian', f:'🇷🇺'}, {c:'hi', n:'Hindi', f:'🇮🇳'}
];

function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('collapsed');
    document.getElementById('mainContent').classList.toggle('expanded');
}

function renderLangs() {
    const select = document.getElementById('langSelect');
    if (!select) return;
    LANGS.forEach(l => {
        const opt = document.createElement('option');
        opt.value = l.c;
        opt.textContent = `${l.f} ${l.n}`;
        select.appendChild(opt);
    });
}

function setLang(code) { selectedLang = code; }

async function handleCustomVoice(input) {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        customVoiceBase64 = e.target.result.split(',')[1];
        selectedVoiceId = 'custom';
        document.getElementById('customVoiceTxt').innerText = "✅ تم رفع: " + file.name;
    };
    reader.readAsDataURL(file);
}

async function startDubbing() {
    const mediaInput = document.getElementById('mediaFile');
    const token = localStorage.getItem('token');
    if (!token || !mediaInput.files[0] || !selectedLang) return showToast("تأكد من تسجيل الدخول واختيار الملف واللغة");

    document.getElementById('dubBtn').disabled = true;
    document.getElementById('progressArea').style.display = 'block';

    const fd = new FormData();
    fd.append('media_file', mediaInput.files[0]);
    fd.append('lang', selectedLang);
    fd.append('voice_id', selectedVoiceId);
    if (customVoiceBase64) fd.append('sample_b64', customVoiceBase64);

    try {
        const res = await fetch(`${API_BASE}/api/dub`, {
            method: 'POST',
            body: fd,
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.success) startSSE(data.job_id);
        else { showToast(data.error); document.getElementById('dubBtn').disabled = false; }
    } catch(e) { showToast("خطأ اتصال"); document.getElementById('dubBtn').disabled = false; }
}

function startSSE(jobId) {
    const source = new EventSource(`${API_BASE}/api/progress/${jobId}`);
    source.onmessage = (e) => {
        const data = JSON.parse(e.data);
        document.getElementById('statusTxt').innerText = "الحالة: " + data.status;
        if (data.status === 'completed') {
            document.getElementById('dubAud').src = data.audio_url;
            document.getElementById('resCard').style.display = 'block';
            source.close();
            document.getElementById('dubBtn').disabled = false;
        }
    };
}

document.addEventListener('DOMContentLoaded', () => {
    renderLangs();
    const mediaInput = document.getElementById('mediaFile');
    if(mediaInput) mediaInput.onchange = function() {
        document.getElementById('fileTxt').innerText = this.files[0].name;
    };
});
