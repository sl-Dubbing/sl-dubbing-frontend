'use strict';

// 🌍 الرابط العالمي لـ Railway (السيرفر الخلفي)
const API_BASE = 'https://sl-dubbing-frontend-production.up.railway.app';

let selectedLangs = [];
let srtSegments = [];
let activeSpeakerId = 'auto';

const SUPPORTED_LANGS = [
    { code: 'ar', name: 'العربية', flag: '🇸🇦' }, { code: 'en', name: 'English', flag: '🇺🇸' },
    { code: 'fr', name: 'French', flag: '🇫🇷' }, { code: 'de', name: 'German', flag: '🇩🇪' },
    { code: 'es', name: 'Spanish', flag: '🇪🇸' }, { code: 'it', name: 'Italian', flag: '🇮🇹' },
    { code: 'pt', name: 'Portuguese', flag: '🇵🇹' }, { code: 'tr', name: 'Turkish', flag: '🇹🇷' },
    { code: 'ru', name: 'Russian', flag: '🇷🇺' }, { code: 'zh-cn', name: 'Chinese', flag: '🇨🇳' }
];

// --- 🎙️ بناء بطاقة المتحدث ---
function createSpeakerCard(s) {
    const card = document.createElement('div');
    card.className = `spk-card ${activeSpeakerId === s.speaker_id ? 'active' : ''}`;
    card.setAttribute('data-id', s.speaker_id);
    
    let iconClass = s.icon || 'fa-microphone';
    
    card.innerHTML = `
        <i class="fas fa-check-circle chk"></i>
        <div class="spk-av"><i class="fas ${iconClass}"></i></div>
        <div class="spk-nm">${s.label}</div>
    `;
    
    card.onclick = () => {
        if (s.isAdd) {
            document.getElementById('spkFile').click();
        } else {
            activeSpeakerId = s.speaker_id;
            document.querySelectorAll('.spk-card').forEach(c => c.classList.remove('active'));
            card.classList.add('active');
        }
    };
    return card;
}

// --- 🎙️ تحميل الأصوات ---
async function loadSpeakers() {
    const grid = document.getElementById('spkGrid');
    if (!grid) return;
    
    grid.innerHTML = '';
    grid.appendChild(createSpeakerCard({ speaker_id: 'auto', label: 'تلقائي (المصدر)', icon: 'fa-magic' }));
    grid.appendChild(createSpeakerCard({ speaker_id: 'add', label: 'استنساخ صوت', icon: 'fa-plus', isAdd: true }));

    try {
        const res = await fetch(`${API_BASE}/api/speakers`);
        if (res.ok) {
            const list = await res.json();
            const addButton = grid.lastChild;
            list.forEach(s => {
                if (!document.querySelector(`[data-id="${s.speaker_id}"]`)) {
                    const card = createSpeakerCard({ speaker_id: s.speaker_id, label: s.label, icon: 'fa-microphone' });
                    grid.insertBefore(card, addButton);
                }
            });
        }
    } catch (e) { console.log("السيرفر لا يرسل أصواتًا حاليًا"); }
}

// --- 🌐 إدارة حالة النظام واللغات ---
function buildLangGrid() {
    const grid = document.getElementById('langGrid');
    if (!grid) return;
    grid.innerHTML = '';
    SUPPORTED_LANGS.forEach(l => {
        const box = document.createElement('div');
        box.className = 'lang-box';
        box.innerHTML = `${l.flag} <span>${l.name}</span>`;
        box.onclick = () => {
            if (selectedLangs.includes(l.code)) selectedLangs = selectedLangs.filter(c => c !== l.code);
            else selectedLangs.push(l.code);
            box.classList.toggle('active');
            checkReady();
        };
        grid.appendChild(box);
    });
}

async function updateStatus() {
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
}

// --- 📁 معالجة ملفات الترجمة ---
function toSec(t) {
    if (!t) return 0;
    let parts = t.trim().replace(',', '.').split(':');
    if (parts.length === 3) return parseFloat(parts[0]) * 3600 + parseFloat(parts[1]) * 60 + parseFloat(parts[2]);
    if (parts.length === 2) return parseFloat(parts[0]) * 60 + parseFloat(parts[1]);
    return parseFloat(parts[0]) || 0;
}

function parseSubtitle(data) {
    const segments = [];
    const lines = data.replace(/\r/g, '').split('\n');
    const timeRegex = /(\d+:?\d*:\d+[.,]\d+)\s*(-->|,)\s*(\d+:?\d*:\d+[.,]\d+)/;
    let current = null;
    lines.forEach(line => {
        const match = timeRegex.exec(line);
        if (match) {
            if (current) segments.push(current);
            current = { start: toSec(match[1]), end: toSec(match[3]), text: "" };
        } else if (current && line.trim() !== "" && !/^\d+$/.test(line.trim())) {
            current.text += line.trim() + " ";
        }
    });
    if (current) segments.push(current);
    return segments.filter(s => s.text.trim().length > 0);
}

document.getElementById('srtFile').addEventListener('change', (e) => {
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onload = (ev) => {
        srtSegments = parseSubtitle(ev.target.result);
        if (srtSegments.length > 0) {
            document.getElementById('srtZone').innerHTML = `<i class="fas fa-check-circle" style="color:#22c55e"></i> ${file.name} (${srtSegments.length} مقطع)`;
            checkReady();
        }
    };
    reader.readAsText(file, 'UTF-8');
});

function checkReady() {
    const btn = document.getElementById('startBtn');
    const isOnline = document.getElementById('dot').classList.contains('on');
    if (btn && btn.innerText !== "✅ تمت الدبلجة بنجاح!") {
        btn.disabled = !(isOnline && srtSegments.length > 0 && selectedLangs.length > 0);
        btn.style.opacity = btn.disabled ? "0.5" : "1";
        if (!isOnline) btn.innerText = "في انتظار اتصال النظام...";
        else if (srtSegments.length === 0) btn.innerText = "يرجى رفع ملف الترجمة";
        else if (selectedLangs.length === 0) btn.innerText = "اختر لغة الدبلجة";
        else btn.innerText = "ابدأ الدبلجة الآن 🚀";
    }
}

// --- 🚀 بدء العملية ومتابعة الحالة (النظام الجديد) ---
async function start() {
    const btn = document.getElementById('startBtn');
    btn.disabled = true;
    btn.innerText = "⏳ جاري الإرسال للسحاب...";
    
    // إخفاء أي مشغل صوت قديم إذا كان المستخدم يدبلج ملفاً جديداً
    const oldPlayer = document.getElementById('playerContainer');
    if (oldPlayer) oldPlayer.style.display = 'none';
    
    try {
        // نستخدم /dub ليتوافق مع كود Python الجديد
        const res = await fetch(`${API_BASE}/dub`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                segments: srtSegments,
                lang: selectedLangs[0],
                url: document.getElementById('ytUrl') ? document.getElementById('ytUrl').value : '',
                speaker_id: activeSpeakerId
            })
        });
        
        const data = await res.json();
        
        if (data.task_id) {
            btn.innerText = "⚙️ السيرفر السحابي يعمل الآن... يرجى الانتظار";
            pollTaskStatus(data.task_id, btn); // البدء بسؤال السيرفر
        } else {
            alert("فشل الإرسال.");
            btn.disabled = false;
            checkReady();
        }
    } catch (e) { 
        alert("خطأ في الاتصال."); 
        btn.disabled = false;
        checkReady();
    }
}

// --- 🔄 دالة الاستعلام المستمر التي تمنع انقطاع Vercel ---
function pollTaskStatus(taskId, btn) {
    const checkInterval = setInterval(async () => {
        try {
            const res = await fetch(`${API_BASE}/status/${taskId}`);
            const data = await res.json();

            if (data.status === 'done') {
                clearInterval(checkInterval);
                btn.innerText = "✅ تمت الدبلجة بنجاح!";
                btn.style.backgroundColor = "#22c55e"; // تلوين الزر بالأخضر
                showAudioPlayer(data.audio_url); // إظهار المشغل فوراً
            } else if (data.status === 'error') {
                clearInterval(checkInterval);
                alert("❌ حدث خطأ في السيرفر: " + data.message);
                btn.innerText = "حدث خطأ، حاول مجدداً";
                btn.disabled = false;
            } else {
                // إضافة حركة للنص ليعرف المستخدم أن السيرفر يعمل
                let dots = btn.innerText.match(/\./g);
                let dotCount = dots ? dots.length : 0;
                btn.innerText = "⚙️ السيرفر السحابي يعمل الآن" + ".".repeat((dotCount + 1) % 4);
            }
        } catch (e) {
            console.error("خطأ في الاستعلام:", e);
        }
    }, 5000); // السؤال يتم كل 5 ثوانٍ
}

// --- 🎧 دالة ذكية لإظهار مشغل الصوت تلقائياً للمستخدم ---
function showAudioPlayer(audioUrl) {
    let playerContainer = document.getElementById('playerContainer');
    
    // إذا لم يكن هناك مكان مخصص للصوت، نصنعه بأنفسنا!
    if (!playerContainer) {
        playerContainer = document.createElement('div');
        playerContainer.id = 'playerContainer';
        playerContainer.style.marginTop = '20px';
        playerContainer.style.padding = '15px';
        playerContainer.style.backgroundColor = 'rgba(34, 197, 94, 0.1)';
        playerContainer.style.borderRadius = '10px';
        playerContainer.style.textAlign = 'center';
        
        const btn = document.getElementById('startBtn');
        btn.parentNode.insertBefore(playerContainer, btn.nextSibling); // وضعه تحت زر البدء
    }

    playerContainer.style.display = 'block';
    playerContainer.innerHTML = `
        <h3 style="color: #22c55e; margin-bottom: 15px; font-size: 1.1rem;">🎉 مقطعك جاهز للاستماع!</h3>
        <audio controls autoplay style="width: 100%; max-width: 400px; border-radius: 8px;">
            <source src="${audioUrl}" type="audio/wav">
            متصفحك لا يدعم مشغل الصوت.
        </audio>
        <br>
        <a href="${audioUrl}" target="_blank" style="display: inline-block; margin-top: 15px; color: #fff; background: #3b82f6; padding: 10px 20px; border-radius: 5px; text-decoration: none; font-weight: bold;">
            <i class="fas fa-download"></i> تحميل المقطع
        </a>
    `;
}

// --- رفع عينة صوت ---
document.getElementById('spkFile').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    fd.append('label', file.name.split('.')[0]);
    try {
        const res = await fetch(`${API_BASE}/api/upload_speaker`, { method: 'POST', body: fd });
        if (res.ok) { await loadSpeakers(); alert("تم رفع العينة بنجاح!"); }
    } catch (e) { alert("فشل رفع العينة"); }
});

document.addEventListener('DOMContentLoaded', () => {
    buildLangGrid();
    loadSpeakers();
    updateStatus();
    setInterval(updateStatus, 5000);
});
