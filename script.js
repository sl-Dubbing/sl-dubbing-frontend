'use strict';

// الربط الذكي: يتصل بـ Railway إذا كان الموقع مرفوعاً، وبـ Localhost إذا كنت تبرمج محلياً
const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
    ? 'http://127.0.0.1:5000' 
    : 'https://sl-dubbing-frontend-production.up.railway.app';

let selectedLangs = [];
let srtSegments = [];
let activeSpeakerId = 'muhammad';
let jobStartTime = 0;

const SUPPORTED_LANGS = [
    { code: 'ar', name: 'العربية', flag: '🇸🇦' }, { code: 'en', name: 'English', flag: '🇺🇸' },
    { code: 'fr', name: 'French', flag: '🇫🇷' }, { code: 'de', name: 'German', flag: '🇩🇪' },
    { code: 'es', name: 'Spanish', flag: '🇪🇸' }, { code: 'it', name: 'Italian', flag: '🇮🇹' },
    { code: 'pt', name: 'Portuguese', flag: '🇵🇹' }, { code: 'tr', name: 'Turkish', flag: '🇹🇷' },
    { code: 'ru', name: 'Russian', flag: '🇷🇺' }, { code: 'zh-cn', name: 'Chinese', flag: '🇨🇳' }
];

// --- إظهار التنبيهات (Toast) ---
function showToast(msg, type = 'info') {
    const toast = document.createElement('div');
    toast.style.cssText = `
        position: fixed; bottom: 20px; right: 20px; padding: 12px 24px;
        background: ${type === 'error' ? '#ef4444' : '#0f0f10'};
        color: white; border-radius: 10px; z-index: 9999;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15); font-size: 0.9rem;
        transition: transform 0.3s ease, opacity 0.3s ease;
        transform: translateY(100px); opacity: 0;
    `;
    toast.innerText = msg;
    document.body.appendChild(toast);
    setTimeout(() => { toast.style.transform = 'translateY(0)'; toast.style.opacity = '1'; }, 100);
    setTimeout(() => {
        toast.style.transform = 'translateY(100px)'; toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// --- بناء شبكة اللغات ---
function buildLangGrid() {
    const grid = document.getElementById('langGrid');
    if (!grid) return;
    grid.innerHTML = '';
    SUPPORTED_LANGS.forEach(l => {
        const box = document.createElement('div');
        box.className = 'lang-box';
        box.innerHTML = `${l.flag} <span>${l.name}</span>`;
        box.onclick = () => {
            const idx = selectedLangs.indexOf(l.code);
            if (idx > -1) { selectedLangs.splice(idx, 1); box.classList.remove('active'); } 
            else { selectedLangs.push(l.code); box.classList.add('active'); }
            checkReady();
        };
        grid.appendChild(box);
    });
}

// --- بناء بطاقة المتحدث ---
function createSpeakerCard(s) {
    const card = document.createElement('div');
    card.className = `spk-card ${activeSpeakerId === s.speaker_id ? 'active' : ''}`;
    card.dataset.id = s.speaker_id;
    card.innerHTML = `
        <i class="fas fa-check-circle chk"></i>
        <div class="spk-av">${s.is_auto ? 'A' : (s.label ? s.label[0] : 'S')}</div>
        <div class="spk-nm">${s.label}</div>
    `;
    card.onclick = () => {
        activeSpeakerId = s.speaker_id;
        document.querySelectorAll('.spk-card').forEach(c => c.classList.remove('active'));
        card.classList.add('active');
    };
    return card;
}

// --- تحميل قائمة الأصوات من السيرفر ---
async function loadSpeakers() {
    try {
        const res = await fetch(`${API_BASE}/api/speakers`);
        const list = await res.json();
        const grid = document.getElementById('spkGrid');
        grid.innerHTML = '';
        grid.appendChild(createSpeakerCard({ speaker_id: 'auto', label: 'من المصدر', is_auto: true }));
        list.forEach(s => grid.appendChild(createSpeakerCard(s)));
        const addCard = document.createElement('div');
        addCard.className = 'spk-card add-card';
        addCard.innerHTML = '<i class="fas fa-plus"></i><span>رفع عيّنة</span>';
        addCard.onclick = () => document.getElementById('spkFile').click();
        grid.appendChild(addCard);
    } catch (e) {
        console.error("خطأ في تحميل الأصوات:", e);
    }
}

// --- رفع عينة صوت جديدة ---
document.getElementById('spkFile').addEventListener('change', async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    document.getElementById('upProg').style.display = 'block';
    const fd = new FormData();
    fd.append('file', f);
    fd.append('label', f.name.replace(/\.[^.]+$/, ''));
    try {
        const r = await fetch(API_BASE + '/api/upload_speaker', { method: 'POST', body: fd });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        activeSpeakerId = d.speaker_id;
        await loadSpeakers();
        showToast("تم رفع الصوت بنجاح", "success");
    } catch (err) {
        showToast("فشل الرفع: " + err.message, "error");
    }
    document.getElementById('upProg').style.display = 'none';
    e.target.value = '';
});

// --- تحويل النص إلى ثواني ---
function toSec(t) {
    t = String(t).trim()
        .replace(/[\u0660-\u0669]/g, d => d.charCodeAt(0) - 0x0660)
        .replace(',', '.')
        .replace(/[^\d:.]/g, ' ').trim();
    const p = t.split(':').map(Number);
    if (p.length === 3) return p[0]*3600 + p[1]*60 + (p[2]||0);
    if (p.length === 2) return p[0]*60   + (p[1]||0);
    return p[0]||0;
}

// --- معالجة ملف SRT ---
function parseSRT(data) {
    data = data.replace(/^\uFEFF/, '');
    const norm = []; for (let i=0;i<data.length;i++) {
        const c=data[i];
        if (c==='\r') { norm.push('\n'); if(data[i+1]==='\n') i++; }
        else norm.push(c);
    }
    data = norm.join('');

    const segments = [];
    const SRT_RE = /(\d[\d:.,-]+)\s*-->\s*(\d[\d:.,-]+)/;
    const SBV_RE = /^(\d+:\d{2}:\d{2}[.,]\d+),(\d+:\d{2}:\d{2}[.,]\d+)/;

    function isTL(l) { return SRT_RE.test(l) || SBV_RE.test(l.trim()); }
    function getTimes(l) {
        let m = SRT_RE.exec(l);
        if (m) return { s: toSec(m[1]), e: toSec(m[2]) };
        m = SBV_RE.exec(l.trim());
        if (m) return { s: toSec(m[1]), e: toSec(m[2]) };
        return null;
    }

    const blocks = data.split(/\n[ \t]*\n/);
    blocks.forEach(block => {
        const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
        if (!lines.length) return;
        let tiIdx = -1;
        for (let j=0; j<lines.length; j++) { if (isTL(lines[j])) { tiIdx=j; break; } }
        if (tiIdx === -1) return;
        const times = getTimes(lines[tiIdx]);
        if (!times) return;
        const txtLines = lines.slice(tiIdx+1).filter(l => !/^\d+$/.test(l)).filter(l => !isTL(l));
        const text = txtLines.join(' ').replace(/<[^>]*>/g,'').replace(/\{[^}]*\}/g,'').replace(/\s+/g,' ').trim();
        if (text && times.e > times.s) segments.push({ start: times.s, end: times.e, text });
    });

    if (segments.length === 0) {
        const lines = data.split('\n'); let k=0;
        while (k < lines.length) {
            const times = getTimes(lines[k]);
            if (times) {
                const arr=[]; k++;
                while (k<lines.length && !isTL(lines[k]) && !/^\d+$/.test(lines[k].trim())) {
                    if(lines[k].trim()) arr.push(lines[k].trim()); k++;
                }
                const text = arr.join(' ').replace(/<[^>]*>/g,'').replace(/\{[^}]*\}/g,'').trim();
                if (text && times.e > times.s) segments.push({ start:times.s, end:times.e, text });
            } else k++;
        }
    }
    segments.sort((a,b) => a.start - b.start);
    return segments.filter((s,i,a) => i===0 || s.start !== a[i-1].start);
}

// --- التحقق من جاهزية زر البدء ---
function checkReady() {
    const isXttsReady = document.getElementById('dot').classList.contains('on');
    const btn = document.getElementById('startBtn');
    if (isXttsReady && srtSegments.length > 0 && selectedLangs.length > 0) {
        btn.style.opacity = '1';
        btn.style.cursor = 'pointer';
    } else {
        btn.style.opacity = '0.5';
        btn.style.cursor = 'not-allowed';
    }
}

// --- مستمع لرفع ملف الترجمة ---
document.getElementById('srtFile').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    function tryRead(encoding) {
        const r = new FileReader();
        r.onload = ev => {
            const segs = parseSRT(ev.target.result);
            if (segs.length > 0) { applySRT(segs, file.name); return; }
            if (encoding === 'utf-8')       tryRead('windows-1256');
            else if (encoding==='windows-1256') tryRead('latin-1');
            else showToast("الملف لا يحتوي على توقيتات صالحة", "error");
        };
        r.readAsText(file, encoding);
    }

    function applySRT(segs, fname) {
        srtSegments = segs;
        if (srtSegments.length === 0) return showToast("الملف لا يحتوي على توقيتات صالحة", "error");

        showToast(`تم تحميل SRT بنجاح (${srtSegments.length} مقطع)`);
        
        const dur = srtSegments[srtSegments.length - 1].end;
        const mins = Math.floor(dur / 60);
        const secs = Math.round(dur % 60);
        const avgLen = Math.round(srtSegments.reduce((a, s) => a + s.text.length, 0) / srtSegments.length) || 0;

        document.getElementById('srtZone').innerHTML = `<i class="fas fa-check-circle" style="color:#059669"></i><div class="srt-lbl">${file.name}</div>`;
        document.getElementById('srtZone').classList.add('ok');

        const stats = document.getElementById('srtStats');
        stats.style.display = 'flex';
        stats.innerHTML =
            `<span class="stat"><i class="fas fa-list-ol"></i> ${srtSegments.length} مقطع</span>` +
            `<span class="stat"><i class="far fa-clock"></i> ${mins}:${String(secs).padStart(2, '0')}</span>` +
            `<span class="stat"><i class="fas fa-font"></i> ~${avgLen} حرف/مقطع</span>`;

        checkReady();
    }
    tryRead('utf-8');
});

// --- مراقبة المهمة (Job Monitor) ---
function monitorJob(jobId, label) {
    return new Promise((resolve, reject) => {
        let isDone = false;
        const source = new EventSource(`${API_BASE}/api/progress/${jobId}`);
        
        const pollInterval = setInterval(async () => {
            if (isDone) return;
            try {
                const res = await fetch(`${API_BASE}/api/job/${jobId}`);
                const data = await res.json();
                if (data.status === 'done' || data.status === 'error') handleUpdate(data);
            } catch (e) {}
        }, 10000);

        const handleUpdate = (data) => {
            if (isDone) return;
            if (data.status === 'done') {
                isDone = true; source.close(); clearInterval(pollInterval);
                addResult(data.audio_url, label); resolve();
            } else if (data.status === 'error') {
                isDone = true; source.close(); clearInterval(pollInterval);
                reject(data.error);
            } else {
                updateProgress(data.progress, `[${label}] ${data.message}`);
                updateETA(data.progress);
            }
        };

        source.onmessage = (e) => handleUpdate(JSON.parse(e.data));
    });
}

// --- زر بدء العملية ---
async function start() {
    const isXttsReady = document.getElementById('dot').classList.contains('on');
    if (!isXttsReady) {
        return showToast("المحرك (XTTS) لم يجهز بعد!", "error");
    }

    const url = document.getElementById('ytUrl').value.trim();
    const file = document.getElementById('mediaFile').files[0];

    if (srtSegments.length === 0) return showToast("يرجى رفع ملف SRT صالح", "error");
    if (!url && !file) return showToast("يرجى وضع رابط أو رفع ملف", "error");
    if (selectedLangs.length === 0) return showToast("اختر لغة دبلجة واحدة على الأقل", "error");

    document.getElementById('startBtn').style.pointerEvents = 'none';
    document.getElementById('progressArea').style.display = 'block';
    document.getElementById('loader').style.display = 'flex';

    let uploadedPath = null;
    if (file) {
        updateProgress(0, "جاري رفع الملف...");
        const fd = new FormData(); fd.append('file', file);
        try {
            const res = await fetch(`${API_BASE}/api/upload_audio`, { method: 'POST', body: fd });
            uploadedPath = (await res.json()).orig_audio_path;
        } catch(e) {
            document.getElementById('startBtn').style.pointerEvents = 'auto';
            return showToast("فشل رفع الملف", "error");
        }
    }

    const srcLang = document.getElementById('srcLang').value;

    for (const lang of selectedLangs) {
        jobStartTime = Date.now();
        const lobj = SUPPORTED_LANGS.find(l => l.code === lang);
        const label = lobj ? `${lobj.flag} ${lobj.name}` : lang;
        
        try {
            const res = await fetch(`${API_BASE}/api/dub`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    segments: srtSegments,
                    lang: lang,
                    source_lang: srcLang,
                    url: url,
                    orig_audio_path: uploadedPath,
                    speaker_id: activeSpeakerId !== 'auto' ? activeSpeakerId : null
                })
            });
            const { job_id } = await res.json();
            await monitorJob(job_id, label);
        } catch (e) { showToast(`فشل في ${label}: ${e}`, "error"); }
    }

    document.getElementById('loader').style.display = 'none';
    updateProgress(100, "اكتملت جميع المهام!");
    document.getElementById('startBtn').style.pointerEvents = 'auto';
    setTimeout(() => { document.getElementById('progressArea').style.display = 'none'; }, 5000);
}

// --- تحديث الواجهة بنسبة التقدم ---
function updateProgress(pct, msg) {
    document.getElementById('progBar').style.width = `${pct}%`;
    document.getElementById('statusTxt').innerText = msg;
    document.getElementById('pctTxt').innerText = `${pct}%`;
}

// --- حساب الوقت المتبقي ---
function updateETA(prog) {
    if (prog < 5 || !jobStartTime) { document.getElementById('etaTxt').textContent = ''; return; }
    const remain = Math.round(((Date.now() - jobStartTime) / 1000 / prog) * (100 - prog));
    document.getElementById('etaTxt').textContent = 'الوقت المتبقي: ~' + (remain > 60 ? Math.round(remain / 60) + ' دقيقة' : remain + ' ثانية');
}

// --- إضافة النتيجة للواجهة ---
function addResult(url, label) {
    const card = document.getElementById('resCard');
    card.style.display = 'block';
    const item = document.createElement('div');
    item.className = 'res-item';
    
    // تصحيح الرابط للتعامل مع الروابط السحابية (Cloudinary/R2) والروابط المحلية
    const finalUrl = url.startsWith('http') ? url : `${API_BASE}${url}`;
    
    item.innerHTML = `
        <div class="res-hd">
            <span class="res-lang">${label}</span>
            <a href="${finalUrl}" target="_blank" download class="btn2"><i class="fas fa-download"></i> تحميل</a>
        </div>
        <audio controls src="${finalUrl}?t=${Date.now()}"></audio>
    `;
    document.getElementById('resList').appendChild(item);
}

// --- معالجة روابط يوتيوب ---
async function onUrl(url) {
    if (!url.includes('youtu')) { document.getElementById('ytInfo').style.display='none'; return; }
    const vid = (url.split('v=')[1]||'').split('&')[0] || url.split('.be/')[1] || '';
    if (!vid) return;
    document.getElementById('ytThumb').src = `https://img.youtube.com/vi/${vid}/mqdefault.jpg`;
    document.getElementById('ytInfo').style.display = 'flex';
}

// --- التهيئة عند التحميل ---
document.addEventListener('DOMContentLoaded', () => {
    buildLangGrid();
    loadSpeakers();
    setInterval(async () => {
        try {
            const res = await fetch(`${API_BASE}/api/status`);
            const data = await res.json();
            if (data.xtts_ready) {
                document.getElementById('dot').classList.add('on');
                document.getElementById('dotLbl').innerText = "المحرك جاهز";
            } else {
                document.getElementById('dot').classList.remove('on');
                document.getElementById('dotLbl').innerText = "جاري التحميل...";
            }
        } catch (e) {
            document.getElementById('dot').classList.remove('on');
            document.getElementById('dotLbl').innerText = "السيرفر متوقف";
        }
        checkReady();
    }, 5000);
});
