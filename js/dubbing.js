// -----------------------------
// 🟢 ثوابت الألوان (عدل هنا لتغيير الألوان في كل الملف)
// -----------------------------
const COLORS = {
    ACCENT: '#7c3aed',
    GOLD: '#ffb800',
    TEXT: '#e0e0ff',
    PROGRESS: '#34d399',
    DOWNLOAD_BG: '#065f2c',
    TOAST_ERROR: '#ef4444',
    TOAST_SUCCESS: '#10b981',
    TOAST_WARNING: '#f59e0b'
};

const API_BASE = 'https://web-production-14a1.up.railway.app';
const FETCH_TIMEOUT_MS = 15000;

// -----------------------------
// 🟢 إظهار التنبيهات (toast)
// -----------------------------
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

// -----------------------------
// 🟢 إدارة المصادقة (Token Based)
// -----------------------------
async function checkAuth() {
    const authSection = document.getElementById('authSection');
    const token = localStorage.getItem('token');
    if (!authSection) return;

    if (!token) {
        authSection.innerHTML = `<a href="login.html" style="color:${COLORS.GOLD}; text-decoration:none; font-weight:bold; display:block; text-align:center;">تسجيل الدخول</a>`;
        return;
    }

    try {
        const r = await fetch(`${API_BASE}/api/user`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const d = await r.json();
        if (d.success) {
            authSection.innerHTML = `
                <div style="text-align:center;">
                    <div style="font-weight:bold; color:${COLORS.TEXT}">${d.user.name}</div>
                    <div style="color:${COLORS.GOLD}; font-size:0.85rem; margin:5px 0;">الرصيد: ${d.user.credits} 💰</div>
                    <button onclick="logout()" style="background:none; border:1px solid #f87171; color:#f87171; padding:4px 10px; border-radius:8px; cursor:pointer; font-size:0.8rem;">خروج</button>
                </div>`;
        } else {
            localStorage.removeItem('token');
            location.reload();
        }
    } catch (e) { console.error("Auth error", e); }
}

function logout() { localStorage.removeItem('token'); location.reload(); }

// -----------------------------
// 🟢 بدء الدبلجة (API Call)
// -----------------------------
async function startDubbing() {
    const mediaInput = document.getElementById('mediaFile');
    const token = localStorage.getItem('token');
    if (!token) return showToast("يرجى تسجيل الدخول أولاً", COLORS.TOAST_WARNING);
    if (mediaInput.files.length === 0) return showToast("يرجى اختيار ملف", COLORS.TOAST_ERROR);

    const progArea = document.getElementById('progressArea');
    const progFill = document.getElementById('progFill');
    progArea.style.display = 'block';
    progFill.style.width = '20%';

    // هنا يوضع كود الـ Fetch و FormData لإرسال الملف للسيرفر...
    showToast("جاري بدء المعالجة...", COLORS.TOAST_SUCCESS);
}

// -----------------------------
// 🟢 تبديل الشريط الجانبي
// -----------------------------
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const main = document.getElementById('mainContent');
    const btn = document.getElementById('menuToggle');
    
    sidebar.classList.toggle('collapsed');
    main.classList.toggle('expanded');
    btn.classList.toggle('sidebar-collapsed');
}

// -----------------------------
// 🟢 تهيئة الأحداث
// -----------------------------
document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    document.getElementById('menuToggle').addEventListener('click', toggleSidebar);
    document.getElementById('dubBtn').addEventListener('click', startDubbing);
});
