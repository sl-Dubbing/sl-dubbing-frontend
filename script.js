/* sl-Dubbing Script - Version 2.1 (Repair Edition) */
const API_BASE = 'https://sl-dubbing-backend-production.up.railway.app'; 

let selectedLangs = [];
let srtSegments = [];
let activeSpeakerId = 'muhammad';

// اللغات المدعومة
const LANGS = [
    { code: 'ar', name: 'العربية', flag: '🇸🇦' },
    { code: 'en', name: 'English', flag: '🇺🇸' },
    { code: 'fr', name: 'French', flag: '🇫🇷' },
    { code: 'de', name: 'German', flag: '🇩🇪' },
    { code: 'tr', name: 'Turkish', flag: '🇹🇷' }
];

// 1. وظيفة بناء القوائم (نضعها في البداية لضمان الظهور)
function populateGrids() {
    const spkGrid = document.getElementById('spkGrid');
    const langGrid = document.getElementById('langGrid');

    if (spkGrid) {
        spkGrid.innerHTML = `
            <div class="spk-card active" id="spk-muhammad" onclick="selectSpeaker('muhammad')">
                <i class="fas fa-check-circle chk" style="display:block"></i>
                <div class="spk-av">M</div>
                <div class="spk-nm">محمد (افتراضي)</div>
            </div>
        `;
    }

    if (langGrid) {
        langGrid.innerHTML = ''; // تنظيف القائمة
        LANGS.forEach(l => {
            const box = document.createElement('div');
            box.className = 'lang-box';
            box.id = `lang-${l.code}`;
            box.innerHTML = `${l.flag} ${l.name}`;
            box.onclick = () => selectLanguage(l.code);
            langGrid.appendChild(box);
        });
    }
}

// 2. دوال الاختيار (لم تكن معرفة في المرة السابقة!)
window.selectSpeaker = function(id) {
    activeSpeakerId = id;
    document.querySelectorAll('.spk-card').forEach(c => c.classList.remove('active'));
    document.getElementById(`spk-${id}`).classList.add('active');
    checkReady();
};

window.selectLanguage = function(code) {
    selectedLangs = [code];
    document.querySelectorAll('.lang-box').forEach(b => b.classList.remove('active'));
    document.getElementById(`lang-${code}`).classList.add('active');
    checkReady();
};

// 3. تحديث حالة السيرفر
async function updateStatus() {
    const dot = document.getElementById('dot');
    const dotLbl = document.getElementById('dotLbl');
    try {
        const res = await fetch(`${API_BASE}/api/status`);
        const data = await res.json();
        if(data.status === 'online') {
            dot.classList.add('on');
            dotLbl.innerText = "System Online";
        }
    } catch(e) {
        dot.classList.remove('on');
        dotLbl.innerText = "System Offline";
    }
}

// 4. معالجة رابط يوتيوب
window.onUrlUpdate = function(url) {
    const infoDiv = document.getElementById('ytInfo');
    const thumb = document.getElementById('ytThumb');
    const title = document.getElementById('ytTitle');
    if(url.includes('youtube.com') || url.includes('youtu.be')) {
        const parts = url.split('v=');
        const id = parts.length > 1 ? parts[1].split('&')[0] : url.split('/').pop();
        thumb.src = `https://img.youtube.com/vi/${id}/mqdefault.jpg`;
        title.innerText = "فيديو يوتيوب جاهز للمعالجة";
        infoDiv.style.display = 'flex';
    } else {
        infoDiv.style.display = 'none';
    }
};

// 5. رفع ملف SRT
document.getElementById('srtFile').addEventListener('change', function(e) {
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onload = function(ev) {
        const lines = ev.target.result.split('\n');
        srtSegments = lines.filter(l => l.length > 5 && !/^\d+$/.test(l));
        document.getElementById('srtZone').classList.add('ok');
        document.getElementById('srtStatusTxt').innerText = `تم استلام: ${file.name}`;
        checkReady();
    };
    reader.readAsText(file);
});

function checkReady() {
    const btn = document.getElementById('startBtn');
    if(srtSegments.length > 0 && selectedLangs.length > 0) {
        btn.style.opacity = "1";
        btn.style.cursor = "pointer";
    }
}

// 6. بدء الدبلجة
window.start = async function() {
    const btn = document.getElementById('startBtn');
    if (btn.style.opacity !== "1") return;
    
    btn.style.display = 'none';
    document.getElementById('progressArea').style.display = 'block';

    try {
        const res = await fetch(`${API_BASE}/dub`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                segments: srtSegments.map(s => ({text: s})),
                lang: selectedLangs[0],
                speaker_id: activeSpeakerId
            })
        });
        const data = await res.json();
        if(data.task_id) poll(data.task_id);
    } catch(e) { 
        alert("خطأ في الاتصال بالسيرفر!");
        btn.style.display = 'block';
    }
};

function poll(id) {
    const interval = setInterval(async () => {
        try {
            const res = await fetch(`${API_BASE}/status/${id}`);
            const data = await res.json();
            if(data.status === 'done') {
                clearInterval(interval);
                finish(data.audio_url);
            } else if(data.percent) {
                document.getElementById('progBar').style.width = data.percent + '%';
                document.getElementById('pctTxt').innerText = data.percent + '%';
                document.getElementById('statusTxt').innerText = data.msg || "جاري المعالجة...";
            }
        } catch(e) {}
    }, 4000);
}

function finish(url) {
    document.getElementById('progressArea').style.display = 'none';
    document.getElementById('resCard').style.display = 'block';
    document.getElementById('resList').innerHTML = `<audio controls src="${url}" style="width:100%"></audio>`;
}

// التشغيل الابتدائي
document.addEventListener('DOMContentLoaded', () => { 
    populateGrids(); 
    updateStatus(); 
});
