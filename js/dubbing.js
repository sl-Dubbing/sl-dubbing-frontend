const API_BASE = 'https://web-production-14a1.up.railway.app';

// دالة إظهار وإخفاء القائمة
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const mainContent = document.getElementById('mainContent');
    
    // التبديل بين الكلاسات
    sidebar.classList.toggle('collapsed');
    mainContent.classList.toggle('expanded');
}

// دالة جلب بيانات المستخدم (رصيد النقاط)
async function fetchUserStats() {
    const authBox = document.getElementById('authSection');
    const token = localStorage.getItem('token');
    
    if (!token) {
        authBox.innerHTML = '<a href="login.html" style="color:#ffb800; text-decoration:none;">تسجيل الدخول</a>';
        return;
    }

    try {
        const res = await fetch('https://web-production-14a1.up.railway.app/api/user', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.success) {
            authBox.innerHTML = `
                <div style="font-weight:bold; color:#fff;">${data.user.name}</div>
                <div style="color:#ffb800; font-size:0.9rem; margin-top:5px;">${data.user.credits} نقطة 💰</div>
            `;
        }
    } catch (e) {
        console.error("Auth Error:", e);
    }
}

// تنفيذ عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', () => {
    fetchUserStats();
});

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
