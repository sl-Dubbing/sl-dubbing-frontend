// js/shared.js - المحرك المشترك لنظام الحماية والتنبيهات
const API_BASE = 'https://web-production-14a1.up.railway.app';

// 🟢 إظهار التنبيهات الجمالية
function showToast(msg, color = '#ef4444') {
    const t = document.getElementById('toasts');
    if (!t) return;
    const box = document.createElement('div');
    box.className = 'toast';
    box.style.background = color;
    box.innerHTML = msg;
    t.appendChild(box);
    setTimeout(() => { 
        box.style.opacity = '0';
        setTimeout(() => box.remove(), 300);
    }, 4000);
}

// 🟢 التحقق من تسجيل الدخول وجلب الرصيد (Token Based)
async function checkAuth() {
    const authSection = document.getElementById('authSection');
    const token = localStorage.getItem('token'); // نجلب التوكن من ذاكرة المتصفح

    if (!authSection) return;

    if (!token) {
        authSection.innerHTML = `<a href="login.html" style="color:#ffd700; text-decoration:none; font-weight:bold;">Login</a>`;
        return;
    }

    try {
        const r = await fetch(`${API_BASE}/api/user`, { 
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}` // نرسل التوكن للسيرفر
            }
        });
        const d = await r.json();
        
        if (d.success) {
            authSection.innerHTML = `
                <div style="display:flex; gap:12px; align-items:center">
                    <div style="text-align:right">
                        <div style="font-weight:700; color:#fff">${d.user.name || 'User'}</div>
                        <div style="background:rgba(255,255,255,0.1); padding:4px 10px; border-radius:8px; font-size:0.8rem; color:#ffd700">
                            Balance: ${d.user.credits} 💰
                        </div>
                    </div>
                    <button onclick="logout()" style="background:#7c3aed; color:#fff; border:none; padding:8px 15px; border-radius:10px; cursor:pointer; font-weight:bold;">Logout</button>
                </div>`;
        } else {
            // إذا كان التوكن منتهي الصلاحية أو خاطئ
            localStorage.removeItem('token');
            authSection.innerHTML = `<a href="login.html" style="color:#ffd700; text-decoration:none; font-weight:bold;">Login</a>`;
        }
    } catch(e) { 
        console.error("Auth check failed", e);
    }
}

// 🟢 تسجيل الخروج (ببساطة حذف التوكن)
window.logout = function() {
    localStorage.removeItem('token');
    location.reload();
};

// تشغيل التحقق تلقائياً
document.addEventListener('DOMContentLoaded', checkAuth);
