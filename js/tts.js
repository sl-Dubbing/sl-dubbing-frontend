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
// 🟢 التحكم في القائمة الجانبية والمصادقة
// ==========================================
function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('active');
    document.getElementById('overlay').classList.toggle('active');
}

async function updateSidebarAuth() {
    const authSection = document.getElementById('authSection');
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
// 🟢 إرسال النص للسيرفر (Text to Speech)
// ==========================================
async function startTTS() {
    const textInput = document.getElementById('ttsInput').value.trim();
    const langSelect = document.getElementById('langSelect').value;
    const token = localStorage.getItem('token');

    // التحققات الأساسية
    if (!token) return showToast("يرجى تسجيل الدخول أولاً", COLORS.TOAST_WARNING);
    if (!textInput) return showToast("يرجى كتابة النص الذي تريد تحويله!", COLORS.TOAST_ERROR);

    const btn = document.getElementById('ttsBtn');
    const progressArea = document.getElementById('progressArea');
    const progFill = document.getElementById('progFill');
    const statusTxt = document.getElementById('statusTxt');
    const resCard = document.getElementById('resCard');

    btn.disabled = true;
    progressArea.style.display = 'block';
    resCard.style.display = 'none';
    progFill.style.width = '40%';
    statusTxt.innerText = "الحالة: يتم الآن قراءة وتوليد النص...";

    try {
        // إرسال البيانات كـ JSON بدلاً من FormData (لأننا نرسل نص وليس ملف فيديو)
        const res = await fetch(`${API_BASE}/api/tts`, {
            method: 'POST',
            headers: { 
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json' 
            },
            body: JSON.stringify({ text: textInput, lang: langSelect })
        });
        
        const data = await res.json();
        
        if (data.success) {
            progFill.style.width = '100%';
            statusTxt.innerText = "الحالة: تم توليد الصوت بنجاح!";
            showToast("تم التحويل بنجاح!", COLORS.TOAST_SUCCESS);
            
            // إظهار مشغل الصوت
            resCard.style.display = 'block';
            document.getElementById('audioResult').src = data.audio_url;
            document.getElementById('dlBtn').href = data.audio_url;
        } else {
            showToast(data.error || "حدث خطأ أثناء التوليد", COLORS.TOAST_ERROR);
            progFill.style.background = COLORS.TOAST_ERROR;
        }
    } catch (e) {
        console.error("TTS Error:", e);
        showToast("خطأ في الاتصال بالسيرفر", COLORS.TOAST_ERROR);
        progFill.style.background = COLORS.TOAST_ERROR;
    } finally {
        btn.disabled = false;
    }
}

// تهيئة الصفحة
document.addEventListener('DOMContentLoaded', () => {
    updateSidebarAuth();
});
