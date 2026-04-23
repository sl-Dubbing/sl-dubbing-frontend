const API_BASE = 'https://web-production-14a1.up.railway.app';

// 🟢 إظهار التنبيهات
function showToast(msg, color = '#ef4444') {
    const t = document.getElementById('toasts');
    if (!t) return;
    const box = document.createElement('div');
    box.className = 'toast'; // تأكدي من وجود تنسيق .toast في CSS
    box.style.cssText = `position:fixed; bottom:20px; left:50%; transform:translateX(-50%); background:${color}; color:white; padding:12px 25px; border-radius:10px; z-index:9999; font-weight:bold;`;
    box.innerText = msg;
    t.appendChild(box);
    setTimeout(() => box.remove(), 4000);
}

// 🟢 التحقق من الحماية (Token Based)
async function checkAuth() {
    const authSection = document.getElementById('authSection');
    const token = localStorage.getItem('token');

    if (!authSection) return;

    if (!token) {
        authSection.innerHTML = `<a href="login.html" style="color:var(--gold); text-decoration:none; font-weight:bold; display:block; text-align:center;">تسجيل الدخول</a>`;
        return;
    }

    try {
        const r = await fetch(`${API_BASE}/api/user`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const d = await r.json();
        
        if (d.success) {
            authSection.innerHTML = `
                <div style="text-align:center; background:rgba(255,255,255,0.03); padding:10px; border-radius:12px;">
                    <div style="font-weight:bold; color:#fff">${d.user.name}</div>
                    <div style="color:var(--gold); font-size:0.85rem; margin:5px 0;">الرصيد: ${d.user.credits} 💰</div>
                    <button onclick="logout()" style="background:none; border:1px solid #f87171; color:#f87171; padding:4px 10px; border-radius:8px; cursor:pointer; font-size:0.8rem;">خروج</button>
                </div>`;
        } else {
            localStorage.removeItem('token');
            checkAuth();
        }
    } catch(e) { console.error("Auth check failed"); }
}

window.logout = () => { localStorage.removeItem('token'); location.reload(); };

document.addEventListener('DOMContentLoaded', checkAuth);
