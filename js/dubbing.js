const API_BASE = 'https://web-production-14a1.up.railway.app';
const COLORS = { GOLD: '#ffb800', ACCENT: '#7c3aed' };

// 🟢 دالة إظهار وإخفاء القائمة
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const mainContent = document.getElementById('mainContent');
    
    sidebar.classList.toggle('collapsed');
    mainContent.classList.toggle('expanded');
}

// 🟢 دالة جلب بيانات المستخدم (المصادقة والرصيد)
async function checkAuth() {
    const authBox = document.getElementById('authSection');
    const token = localStorage.getItem('token');
    
    if (!token) {
        authBox.innerHTML = `<a href="login.html" style="color:${COLORS.GOLD}; text-decoration:none; font-weight:bold;">تسجيل الدخول</a>`;
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/api/user`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        
        if (data.success) {
            authBox.innerHTML = `
                <div style="font-weight:bold; color:#fff;">${data.user.name}</div>
                <div style="color:${COLORS.GOLD}; font-size:0.9rem; margin-top:5px;">الرصيد: ${data.user.credits} نقطة 💰</div>
            `;
        } else {
            // إذا كان التوكن غير صالح
            localStorage.removeItem('token');
            checkAuth();
        }
    } catch (e) {
        console.error("Auth Error:", e);
        authBox.innerHTML = `<div style="color:#ff4444; font-size:0.8rem;">خطأ في الاتصال</div>`;
    }
}

// 🟢 إظهار اسم الملف المختار
function updateFileName() {
    const inp = document.getElementById('mediaFile');
    const txt = document.getElementById('fileTxt');
    if (inp.files && inp.files[0]) {
        txt.innerText = "✅ الملف: " + inp.files[0].name;
        txt.style.color = COLORS.GOLD;
    }
}

// 🟢 اختيار اللغة
function setLang(val) {
    console.log("اللغة المختارة:", val);
}

// تنفيذ العمليات عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
});
