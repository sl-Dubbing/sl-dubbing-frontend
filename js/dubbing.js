const API_BASE = 'https://web-production-14a1.up.railway.app';

// 🟢 دالة التبديل (تأكدي من استخدام الكلاسات الصحيحة)
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const main = document.getElementById('mainContent');
    
    // التبديل بين الحالات
    sidebar.classList.toggle('collapsed');
    main.classList.toggle('expanded');
}

// 🟢 تحديث الرصيد عند التحميل
async function checkAuth() {
    const authBox = document.getElementById('authSection');
    const token = localStorage.getItem('token');
    if (!token) {
        authBox.innerHTML = '<a href="login.html" style="color:#ffb800; text-decoration:none;">تسجيل الدخول</a>';
        return;
    }
    try {
        const res = await fetch(`${API_BASE}/api/user`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const d = await res.json();
        if (d.success) {
            authBox.innerHTML = `
                <div style="font-weight:bold; color:#fff;">${d.user.name}</div>
                <div style="color:#ffb800; font-size:0.9rem; margin-top:5px;">${d.user.credits} نقطة 💰</div>
            `;
        }
    } catch (e) { console.error("Error fetching auth", e); }
}

// 🟢 إظهار اسم الملف
function updateFileName() {
    const inp = document.getElementById('mediaFile');
    const txt = document.getElementById('fileTxt');
    if (inp.files[0]) {
        txt.innerText = "✅ الملف: " + inp.files[0].name;
        txt.style.color = "#ffb800";
    }
}

// تهيئة الأحداث
document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
});
