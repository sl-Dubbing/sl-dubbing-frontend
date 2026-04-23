const COLORS = { GOLD: '#ffb800', ACCENT: '#7c3aed' };
const API_BASE = 'https://web-production-14a1.up.railway.app';

// 🟢 التحكم في القائمة
function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('collapsed');
    document.getElementById('mainContent').classList.toggle('expanded');
}

// 🟢 جلب الرصيد والمصادقة
async function checkAuth() {
    const authBox = document.getElementById('authSection');
    const token = localStorage.getItem('token');

    if (!token) {
        authBox.innerHTML = `<a href="login.html" class="login-link">تسجيل الدخول</a>`;
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/api/user`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const d = await res.json();
        
        if (d.success) {
            authBox.innerHTML = `
                <div class="user-name">${d.user.name}</div>
                <div class="user-credits">الرصيد: ${d.user.credits} نقطة 💰</div>
            `;
        }
    } catch (e) {
        authBox.innerHTML = `<a href="login.html" class="login-link">تسجيل الدخول</a>`;
    }
}

// 🟢 إظهار اسم الملف
function updateFileName() {
    const inp = document.getElementById('mediaFile');
    const txt = document.getElementById('fileTxt');
    if (inp.files[0]) {
        txt.innerText = "✅ المختار: " + inp.files[0].name;
        txt.style.color = COLORS.GOLD;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    document.getElementById('menuToggle').addEventListener('click', toggleSidebar);
});
