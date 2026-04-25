// ==========================================
// 🎨 ثوابت الألوان والإعدادات
// ==========================================
const API_BASE = 'https://web-production-14a1.up.railway.app';
const COLORS = {
    ACCENT: '#7c3aed',
    GOLD: '#ffb800',
    PROGRESS: '#34d399',
    TOAST_ERROR: '#ef4444',
    TOAST_SUCCESS: '#10b981',
    TOAST_WARNING: '#f59e0b'
};

// ==========================================
// 🔧 استخراج اسم الصوت من URL Cloudinary (لو احتجت)
// ==========================================
function extractVoiceName(value) {
    if (!value) return '';
    const v = String(value).trim();
    if (v === 'original' || v === 'source' || v === '') return '';
    if (v.startsWith('http')) {
        try {
            const tail = v.split('/').pop() || '';
            return tail.split('.').shift() || '';
        } catch (e) {
            return '';
        }
    }
    return v;
}

// ==========================================
// 🟢 إظهار التنبيهات
// ==========================================
function showToast(msg, color = COLORS.TOAST_ERROR) {
    const t = document.getElementById('toasts');
    if (!t) return;
    const box = document.createElement('div');
    box.className = 'toast';
    box.style.cssText = `
        position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%);
        background: ${color}; color: white; padding: 12px 25px; border-radius: 10px;
        z-index: 9999; font-weight: bold; box-shadow: 0 6px 18px rgba(0,0,0,0.3);
    `;
    box.innerText = msg;
    t.appendChild(box);
    setTimeout(() => box.remove(), 4000);
}

// ==========================================
// 🟢 الشريط الجانبي + المصادقة
// ==========================================
function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('active');
    document.getElementById('overlay').classList.toggle('active');
}

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
            method: 'GET', headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        if (data.success || data.user) {
            const userName = data.user?.name || data.user?.username || data.name || 'مستخدم';
            const userCredits = data.user?.credits ?? data.user?.points ?? data.credits ?? 0;
            authSection.innerHTML = `
                <div class="user-info-card">
                    <div class="user-name">${userName}</div>
                    <div class="user-points">رصيدك: ${userCredits} نقطة 💰</div>
                    <button onclick="logout()" style="margin-top:12px; background:none; border:none; color:#ff4444; cursor:pointer; font-size:0.85rem; font-weight:bold;">تسجيل الخروج</button>
                </div>`;
        }
    } catch (e) {
        localStorage.removeItem('token');
        authSection.innerHTML = `<a href="login.html" class="btn-login-sidebar">تسجيل الدخول مجدداً</a>`;
    }
}

function logout() { localStorage.removeItem('token'); location.reload(); }

// ==========================================
// 🟢 إرسال النص للسيرفر (TTS) — أصبح غير متزامن
// ==========================================
async function startTTS() {
    const ttsInput = document.getElementById('ttsInput');
    const langSelectEl = document.getElementById('langSelect');
    const voiceSelectEl = document.getElementById('voiceSelect'); // اختياري
    const token = localStorage.getItem('token');

    const textInput = (ttsInput?.value || '').trim();
    const lang = langSelectEl?.value || 'en';
    const rawVoice = voiceSelectEl?.value || '';
    const voiceId = extractVoiceName(rawVoice);

    if (!token) return showToast("يرجى تسجيل الدخول أولاً", COLORS.TOAST_WARNING);
    if (!textInput) return showToast("يرجى كتابة النص الذي تريد تحويله!", COLORS.TOAST_ERROR);

    const btn = document.getElementById('ttsBtn');
    const progressArea = document.getElementById('progressArea');
    const progFill = document.getElementById('progFill');
    const statusTxt = document.getElementById('statusTxt');
    const resCard = document.getElementById('resCard');

    btn.disabled = true;
    if (progressArea) progressArea.style.display = 'block';
    if (resCard) resCard.style.display = 'none';
    if (progFill) {
        progFill.style.width = '20%';
        progFill.style.background = COLORS.PROGRESS;
    }
    if (statusTxt) statusTxt.innerText = "الحالة: يتم الآن إرسال النص...";

    try {
        const body = { text: textInput, lang };
        if (voiceId) body.voice_id = voiceId;

        const res = await fetch(`${API_BASE}/api/tts`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });

        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
            throw new Error(data.error || `Server Error: ${res.status}`);
        }

        if (data.success && data.job_id) {
            // ✅ المهمة دخلت قائمة الانتظار — نتابع عبر SSE
            if (statusTxt) statusTxt.innerText = "الحالة: جاري توليد الصوت...";
            if (progFill) progFill.style.width = '50%';

            const evtSource = new EventSource(`${API_BASE}/api/progress/${data.job_id}`);

            evtSource.onmessage = function (event) {
                let progData;
                try { progData = JSON.parse(event.data); } catch (e) { return; }

                if (progData.status === 'completed') {
                    evtSource.close();
                    if (progFill) progFill.style.width = '100%';
                    if (statusTxt) statusTxt.innerText = "الحالة: تم توليد الصوت بنجاح!";
                    showToast("تم التحويل بنجاح!", COLORS.TOAST_SUCCESS);

                    if (resCard) resCard.style.display = 'block';
                    const audEl = document.getElementById('audioResult');
                    const dl = document.getElementById('dlBtn');
                    if (audEl) audEl.src = progData.audio_url;
                    if (dl) dl.href = progData.audio_url;
                    btn.disabled = false;
                    updateSidebarAuth();
                } else if (progData.status === 'failed') {
                    evtSource.close();
                    showToast("فشل توليد الصوت", COLORS.TOAST_ERROR);
                    if (statusTxt) statusTxt.innerText = "الحالة: فشل التوليد";
                    if (progFill) progFill.style.background = COLORS.TOAST_ERROR;
                    btn.disabled = false;
                    updateSidebarAuth();
                } else if (progData.status === 'not_found') {
                    evtSource.close();
                    showToast("المهمة غير موجودة", COLORS.TOAST_ERROR);
                    btn.disabled = false;
                }
            };

            evtSource.onerror = function () {
                evtSource.close();
                pollTtsStatus(data.job_id, btn, statusTxt, progFill, resCard);
            };
        } else {
            throw new Error(data.error || "خطأ أثناء بدء التوليد");
        }
    } catch (e) {
        console.error("TTS Error:", e);
        showToast(e.message || "خطأ في الاتصال بالسيرفر", COLORS.TOAST_ERROR);
        if (progFill) progFill.style.background = COLORS.TOAST_ERROR;
        btn.disabled = false;
    }
}

// ==========================================
// 🔄 polling احتياطي (يُستخدم إذا فشل SSE)
// ==========================================
async function pollTtsStatus(jobId, btn, statusTxt, progFill, resCard) {
    const token = localStorage.getItem('token');
    const start = Date.now();
    const TIMEOUT_MS = 10 * 60 * 1000; // 10 دقائق للـ TTS

    const poll = async () => {
        if (Date.now() - start > TIMEOUT_MS) {
            showToast("انتهت مهلة التوليد", COLORS.TOAST_ERROR);
            btn.disabled = false;
            return;
        }
        try {
            const res = await fetch(`${API_BASE}/api/job/${jobId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json().catch(() => ({}));
            if (data.status === 'completed') {
                if (progFill) progFill.style.width = '100%';
                if (statusTxt) statusTxt.innerText = "الحالة: تم توليد الصوت بنجاح!";
                showToast("تم التحويل بنجاح!", COLORS.TOAST_SUCCESS);
                if (resCard) resCard.style.display = 'block';
                const audEl = document.getElementById('audioResult');
                const dl = document.getElementById('dlBtn');
                if (audEl) audEl.src = data.audio_url;
                if (dl) dl.href = data.audio_url;
                btn.disabled = false;
                updateSidebarAuth();
                return;
            }
            if (data.status === 'failed') {
                showToast("فشل التوليد", COLORS.TOAST_ERROR);
                if (statusTxt) statusTxt.innerText = "الحالة: فشل التوليد";
                if (progFill) progFill.style.background = COLORS.TOAST_ERROR;
                btn.disabled = false;
                updateSidebarAuth();
                return;
            }
            if (statusTxt) statusTxt.innerText = "الحالة: التوليد جارٍ...";
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
});
