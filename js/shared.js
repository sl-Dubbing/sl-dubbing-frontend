// shared.js - الوظائف العامة لكل الموقع
const API_BASE = 'https://web-production-14a1.up.railway.app';

function showToast(msg, color) {
    const t = document.getElementById('toasts');
    if (!t) return;
    const box = document.createElement('div');
    box.className = 'toast';
    box.style.background = color || '#ef4444';
    box.innerHTML = msg;
    t.appendChild(box);
    setTimeout(() => { box.remove(); }, 4000);
}

async function checkAuth() {
    // كود التحقق من الرصيد والاسم الذي كتبناه سابقاً
}
