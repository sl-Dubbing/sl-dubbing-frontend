// 🟢 ثوابت الألوان البرمجية (تطابق CSS)
const COLORS = {
    ACCENT: '#7c3aed',
    GOLD: '#ffb800',
    PROGRESS: '#34d399',
    TOAST_ERROR: '#ef4444',
    TOAST_SUCCESS: '#10b981'
};

const API_BASE = 'https://web-production-14a1.up.railway.app';

// 🟢 التحكم في القائمة الجانبية (Sidebar)
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const main = document.getElementById('mainContent');
    const btn = document.getElementById('menuToggle');
    
    sidebar.classList.toggle('collapsed');
    main.classList.toggle('expanded');
    
    // تغيير حالة الزر (لتحريكه في الشاشات الكبيرة)
    if (window.innerWidth > 1024) {
        btn.classList.toggle('active');
    }
}

// 🟢 إظهار التنبيهات
function showToast(msg, color = COLORS.TOAST_ERROR) {
    const t = document.getElementById('toasts');
    if (!t) return;
    const box = document.createElement('div');
    box.style.cssText = `
        position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%);
        background: ${color}; color: white; padding: 12px 25px; border-radius: 10px;
        z-index: 9999; font-weight: bold; box-shadow: 0 6px 18px rgba(0,0,0,0.3);
    `;
    box.innerText = msg;
    t.appendChild(box);
    setTimeout(() => box.remove(), 4000);
}

// 🟢 تهيئة الأحداث
document.addEventListener('DOMContentLoaded', () => {
    const menuBtn = document.getElementById('menuToggle');
    if (menuBtn) menuBtn.addEventListener('click', toggleSidebar);

    // تحديث اسم الملف عند الاختيار
    const mediaInp = document.getElementById('mediaFile');
    const fileTxt = document.getElementById('fileTxt');
    if (mediaInp) {
        mediaInp.onchange = () => {
            if (mediaInp.files[0]) {
                fileTxt.innerText = "✅ المختار: " + mediaInp.files[0].name;
                fileTxt.style.color = COLORS.GOLD;
            }
        };
    }
});
