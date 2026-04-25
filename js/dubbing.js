// ==========================================
// 🎨 ثوابت الألوان والإعدادات
// ==========================================
const API_BASE = 'https://web-production-14a1.up.railway.app';
const SAMPLES_BASE = 'samples'; // مجلد العينات المحلي
const COLORS = {
    ACCENT: '#7c3aed', GOLD: '#ffb800', TEXT: '#e0e0ff',
    PROGRESS: '#34d399', TOAST_ERROR: '#ef4444',
    TOAST_SUCCESS: '#10b981', TOAST_WARNING: '#f59e0b'
};

// ==========================================
// 🎙️ جلب العينات من manifest.json (يدعم الإضافة التلقائية)
// ==========================================
async function renderVoices() {
    const select = document.getElementById('voiceSelect');
    if (!select) return;

    select.innerHTML = '<option value="original" selected>🎙️ الصوت الأصلي للوسائط (بدون استنساخ)</option>';

    try {
        // ✅ نقرأ من manifest.json المحلي
        const res = await fetch(`${SAMPLES_BASE}/manifest.json?t=${Date.now()}`);
        if (!res.ok) throw new Error('manifest.json not found');

        const data = await res.json();
        const voices = Array.isArray(data.voices) ? data.voices : [];

        if (voices.length === 0) {
            console.warn('manifest.json فارغ — لا توجد عينات.');
            return;
        }

        voices.forEach(v => {
            const opt = document.createElement('option');
            opt.value = v.id; // معرّف الصوت
            opt.textContent = `${v.icon || '🎤'} عينة: ${v.label || v.id}`;
            // نخزن مسار الملف للتحميل لاحقاً
            opt.dataset.file = v.file || `${v.id}.mp3`;
            select.appendChild(opt);
        });
    } catch (e) {
        console.warn('فشل قراءة manifest.json:', e);
        // قائمة احتياطية صلبة
        const fallback = [{ id: 'muhammad', file: 'muhammad.mp3', label: 'محمد', icon: '👨' }];
        fallback.forEach(v => {
            const opt = document.createElement('option');
            opt.value = v.id;
            opt.textContent = `${v.icon} عينة: ${v.label}`;
            opt.dataset.file = v.file;
            select.appendChild(opt);
        });
    }
}

// ==========================================
// 🟢 إظهار التنبيهات
// ==========================================
function showToast(msg, color = COLORS.TOAST_ERROR) {
    const t = document.getElementById('toasts');
    if (!t) return;
    const box = document.createElement('div');
    box.className = 'toast';
    box.style.background = color;
    box.innerText = msg;
    t.appendChild(box);
    setTimeout(() => box.remove(), 4000);
}

function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('active');
    document.getElementById('overlay').classList.toggle('active');
}

// ==========================================
// 🟢 المصادقة وجلب الرصيد
// ==========================================
async function updateSidebarAuth() {
    const authSection = document.getElementById('authSection');
    if (!authSection) return;
    const token = localStorage.getItem('token');

    if (!token) {
        authSection.innerHTML = `
            <div class="user-info-card">
                <p style="margin-bottom:15px; font-size:0.95rem; color: #fff;">أهلاً بك في sl-Dubbing</p>
                <a href="login.html" class="btn-login-sidebar">تسجيل الدخول</a>
            </div>`;
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/api/user`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' }
        });
        if (!res.ok) throw new Error('Invalid Response');
        const data = await res.json();

        if (data.success || data.user) {
            const userName = data.user?.name || data.user?.username || data.name || 'مستخدم';
            const userCredits = data.user?.credits ?? data.user?.points ?? data.credits ?? 0;

            authSection.innerHTML = `
                <div class="user-info-card">
                    <div class="user-name">${userName}</div>
                    <div class="user-points">رصيدك: ${userCredits} نقطة 💰</div>
                    <button onclick="logout()" style="margin-top:12px; background:none; border:none; color:#ff4444; cursor:pointer; font-size:0.85rem; font-weight:bold;">
                        <i class="fas fa-sign-out-alt"></i> تسجيل الخروج
                    </button>
                </div>`;
        } else {
            throw new Error('Incomplete data');
        }
    } catch (e) {
        localStorage.removeItem('token');
        authSection.innerHTML = `
            <div class="user-info-card">
                <p style="margin-bottom:10px; font-size:0.85rem; color: #ff4444;">انتهت الجلسة</p>
                <a href="login.html" class="btn-login-sidebar">تسجيل الدخول مجدداً</a>
            </div>`;
    }
}

function logout() { localStorage.removeItem('token'); location.reload(); }

// ==========================================
// 🟢 إدارة الملفات
// ==========================================
function updateFileName() {
    const inp = document.getElementById('mediaFile');
    const txt = document.getElementById('fileTxt');
    if (inp.files && inp.files[0]) {
        txt.innerText = "✅ ملف الوسائط: " + inp.files[0].name;
        txt.style.color = COLORS.GOLD;
    }
}

function setVoice(val) {
    const customInput = document.getElementById('customVoice');
    const customTxt = document.getElementById('customVoiceTxt');
    if (val !== 'original' && customInput && customInput.files.length > 0) {
        customInput.value = '';
        if (customTxt) {
            customTxt.innerText = "تم إلغاء المرفق لأنك اخترت عينة جاهزة";
            customTxt.style.color = COLORS.TOAST_WARNING;
        }
    }
}

function handleCustomVoice(input) {
    const txt = document.getElementById('customVoiceTxt');
    const voiceSelect = document.getElementById('voiceSelect');
    if (input.files && input.files[0]) {
        if (txt) {
            txt.innerText = "✅ عينة خاصة: " + input.files[0].name;
            txt.style.color = COLORS.PROGRESS;
        }
        if (voiceSelect) voiceSelect.value = 'original';
    }
}

function setLang(val) { console.log("Language selected:", val); }

// ==========================================
// 🔧 جلب ملف العينة من samples/ كـ Blob
// ==========================================
async function fetchSampleAsBlob(fileName) {
    const url = `${SAMPLES_BASE}/${fileName}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`فشل جلب العينة: ${fileName} (HTTP ${res.status})`);
    return await res.blob();
}

// ==========================================
// 🟢 بدء الدبلجة
// ==========================================
async function startDubbing() {
    const mediaInput = document.getElementById('mediaFile');
    const langSelect = document.getElementById('langSelect');
    const voiceSelect = document.getElementById('voiceSelect');
    const customVoiceInput = document.getElementById('customVoice');
    const token = localStorage.getItem('token');

    if (!token) return showToast("يرجى تسجيل الدخول أولاً", COLORS.TOAST_WARNING);
    if (!mediaInput || mediaInput.files.length === 0)
        return showToast("يرجى رفع ملف الفيديو أولاً", COLORS.TOAST_ERROR);

    const dubBtn = document.getElementById('dubBtn');
    const progressArea = document.getElementById('progressArea');
    const statusTxt = document.getElementById('statusTxt');
    const progFill = document.getElementById('progFill');
    const resCard = document.getElementById('resCard');

    dubBtn.disabled = true;
    progressArea.style.display = 'block';
    if (resCard) resCard.style.display = 'none';
    statusTxt.innerText = "الحالة: جاري تجهيز الملفات...";
    progFill.style.width = '15%';
    progFill.style.background = COLORS.PROGRESS;

    const fd = new FormData();
    fd.append('media_file', mediaInput.files[0]);
    fd.append('lang', langSelect.value || 'ar');

    try {
        // ✅ منطق اختيار الصوت بالأولوية:
        // 1) بصمة مرفوعة من المستخدم
        // 2) عينة من مجلد samples/
        // 3) الصوت الأصلي للوسائط (لا نُرسل voice_sample)

        if (customVoiceInput && customVoiceInput.files.length > 0) {
            fd.append('voice_sample', customVoiceInput.files[0]);
            statusTxt.innerText = "الحالة: استخدام بصمتك الصوتية...";
        } else if (voiceSelect && voiceSelect.value && voiceSelect.value !== 'original') {
            const selectedOpt = voiceSelect.options[voiceSelect.selectedIndex];
            const fileName = selectedOpt?.dataset?.file || `${voiceSelect.value}.mp3`;
            const labelText = (selectedOpt.textContent || '').replace(/^.*عينة:\s*/, '');

            statusTxt.innerText = `الحالة: تحميل عينة "${labelText}"...`;
            try {
                const sampleBlob = await fetchSampleAsBlob(fileName);
                fd.append('voice_sample', sampleBlob, fileName);
            } catch (e) {
                console.error('Sample fetch failed:', e);
                showToast(`تعذّر جلب العينة، سيتم استخدام الصوت الأصلي`, COLORS.TOAST_WARNING);
            }
        }

        statusTxt.innerText = "الحالة: جاري رفع الملف للسيرفر...";
        progFill.style.width = '30%';

        const res = await fetch(`${API_BASE}/api/dub`, {
            method: 'POST', body: fd, headers: { 'Authorization': `Bearer ${token}` }
        });

        const data = await res.json().catch(() => ({}));

        if (!res.ok) throw new Error(data.error || `Server Error: ${res.status}`);

        if (data.success && data.job_id) {
            statusTxt.innerText = "الحالة: جاري معالجة الذكاء الاصطناعي...";
            progFill.style.width = '50%';

            const evtSource = new EventSource(`${API_BASE}/api/progress/${data.job_id}`);

            evtSource.onmessage = function (event) {
                let progData;
                try { progData = JSON.parse(event.data); } catch (e) { return; }

                if (progData.status === 'completed') {
                    evtSource.close();
                    progFill.style.width = '100%';
                    statusTxt.innerText = "الحالة: تمت المعالجة بنجاح!";
                    showToast("اكتملت الدبلجة بنجاح!", COLORS.TOAST_SUCCESS);

                    if (resCard) resCard.style.display = 'block';
                    const aud = document.getElementById('dubAud');
                    const dl = document.getElementById('dlBtn');
                    if (aud) {
                        aud.src = progData.audio_url;
                        aud.style.display = 'block';
                    }
                    if (dl) dl.href = progData.audio_url;
                    dubBtn.disabled = false;
                    updateSidebarAuth();
                } else if (progData.status === 'failed') {
                    evtSource.close();
                    showToast("فشلت المعالجة", COLORS.TOAST_ERROR);
                    statusTxt.innerText = "الحالة: فشلت المعالجة";
                    progFill.style.background = COLORS.TOAST_ERROR;
                    dubBtn.disabled = false;
                    updateSidebarAuth();
                } else if (progData.status === 'not_found') {
                    evtSource.close();
                    showToast("المهمة غير موجودة", COLORS.TOAST_ERROR);
                    dubBtn.disabled = false;
                } else if (progData.status === 'processing') {
                    statusTxt.innerText = "الحالة: المعالجة جارية...";
                    progFill.style.width = '70%';
                }
            };

            evtSource.onerror = function () {
                evtSource.close();
                pollJobStatus(data.job_id, dubBtn, statusTxt, progFill, resCard);
            };
        } else {
            throw new Error(data.error || "خطأ أثناء الرفع");
        }
    } catch (e) {
        console.error("Dubbing Error:", e);
        showToast(e.message || "تعطل الخادم أثناء المعالجة", COLORS.TOAST_ERROR);
        statusTxt.innerText = `الحالة: خطأ — ${e.message || ''}`;
        progFill.style.background = COLORS.TOAST_ERROR;
        dubBtn.disabled = false;
    }
}

// ==========================================
// 🔄 polling احتياطي
// ==========================================
async function pollJobStatus(jobId, btn, statusTxt, progFill, resCard) {
    const token = localStorage.getItem('token');
    const start = Date.now();
    const TIMEOUT_MS = 30 * 60 * 1000;

    const poll = async () => {
        if (Date.now() - start > TIMEOUT_MS) {
            showToast("انتهت مهلة المعالجة", COLORS.TOAST_ERROR);
            btn.disabled = false;
            return;
        }
        try {
            const res = await fetch(`${API_BASE}/api/job/${jobId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json().catch(() => ({}));
            if (data.status === 'completed') {
                progFill.style.width = '100%';
                statusTxt.innerText = "الحالة: تمت المعالجة بنجاح!";
                showToast("اكتملت الدبلجة بنجاح!", COLORS.TOAST_SUCCESS);
                if (resCard) resCard.style.display = 'block';
                const aud = document.getElementById('dubAud');
                const dl = document.getElementById('dlBtn');
                if (aud) { aud.src = data.audio_url; aud.style.display = 'block'; }
                if (dl) dl.href = data.audio_url;
                btn.disabled = false;
                updateSidebarAuth();
                return;
            }
            if (data.status === 'failed') {
                showToast("فشلت المعالجة", COLORS.TOAST_ERROR);
                statusTxt.innerText = "الحالة: فشلت المعالجة";
                progFill.style.background = COLORS.TOAST_ERROR;
                btn.disabled = false;
                updateSidebarAuth();
                return;
            }
            statusTxt.innerText = "الحالة: المعالجة جارية...";
            setTimeout(poll, 3000);
        } catch (e) {
            console.error("Poll error:", e);
            setTimeout(poll, 5000);
        }
    };
    poll();
}

document.addEventListener('DOMContentLoaded', () => {
    updateSidebarAuth();
    renderVoices();
});
