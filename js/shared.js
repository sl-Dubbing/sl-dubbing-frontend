// js/shared.js - المحرك المشترك لنظام الحماية والتنبيهات والتحكم بالشريط الجانبي
const API_BASE = 'https://web-production-14a1.up.railway.app';
const OVERLAY_ID = 'sidebarOverlay';

// -----------------------------
// 🟢 إظهار التنبيهات الجمالية
// -----------------------------
function showToast(msg, color = '#ef4444') {
    const t = document.getElementById('toasts');
    if (!t) return;
    const box = document.createElement('div');
    box.className = 'toast';
    box.style.cssText = `
        background: ${color};
        color: #fff;
        padding: 10px 16px;
        border-radius: 10px;
        margin-top: 8px;
        box-shadow: 0 6px 18px rgba(0,0,0,0.35);
        transition: opacity 0.3s ease, transform 0.3s ease;
        opacity: 1;
    `;
    box.innerHTML = msg;
    t.appendChild(box);
    // اختفاء تدريجي
    setTimeout(() => {
        box.style.opacity = '0';
        box.style.transform = 'translateY(6px)';
        setTimeout(() => {
            try { box.remove(); } catch (e) {}
        }, 300);
    }, 4000);
}

// -----------------------------
// 🟢 التحقق من تسجيل الدخول وجلب الرصيد (Token Based)
// -----------------------------
async function checkAuth() {
    const authSection = document.getElementById('authSection');
    const token = localStorage.getItem('token');

    if (!authSection) return;

    if (!token) {
        authSection.innerHTML = `<a href="login.html" style="color:#ffd700; text-decoration:none; font-weight:bold;">Login</a>`;
        return;
    }

    try {
        const r = await fetch(`${API_BASE}/api/user`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/json'
            }
        });

        if (!r.ok) {
            // توكن منتهي أو غير صالح
            if (r.status === 401 || r.status === 403) {
                localStorage.removeItem('token');
                authSection.innerHTML = `<a href="login.html" style="color:#ffd700; text-decoration:none; font-weight:bold;">Login</a>`;
                showToast('انتهت صلاحية الجلسة. الرجاء تسجيل الدخول مجدداً.', '#f59e0b');
                return;
            }
            // أخطاء أخرى
            authSection.innerHTML = `<a href="login.html" style="color:#ffd700; text-decoration:none; font-weight:bold;">Login</a>`;
            console.warn('Auth check returned non-ok status', r.status);
            return;
        }

        const d = await r.json().catch(() => null);
        if (!d) {
            authSection.innerHTML = `<a href="login.html" style="color:#ffd700; text-decoration:none; font-weight:bold;">Login</a>`;
            console.warn('Auth check: invalid JSON response');
            return;
        }

        if (d.success) {
            const name = escapeHtml(d.user?.name || 'User');
            const credits = Number(d.user?.credits || 0);
            authSection.innerHTML = `
                <div style="display:flex; gap:12px; align-items:center; justify-content:flex-start;">
                    <div style="text-align:right">
                        <div style="font-weight:700; color:#fff">${name}</div>
                        <div style="background:rgba(255,255,255,0.06); padding:4px 10px; border-radius:8px; font-size:0.8rem; color:#ffd700">
                            Balance: ${credits} 💰
                        </div>
                    </div>
                    <button id="logoutBtn" style="background:#7c3aed; color:#fff; border:none; padding:8px 15px; border-radius:10px; cursor:pointer; font-weight:bold;">Logout</button>
                </div>`;
            const lb = document.getElementById('logoutBtn');
            if (lb) lb.addEventListener('click', logout);
        } else {
            localStorage.removeItem('token');
            authSection.innerHTML = `<a href="login.html" style="color:#ffd700; text-decoration:none; font-weight:bold;">Login</a>`;
        }
    } catch (e) {
        console.error("Auth check failed", e);
        // لا تكشف تفاصيل الخطأ للمستخدم، فقط نعرض رسالة عامة
        showToast('فشل الاتصال بخدمة المصادقة. تحقق من الخادم.', '#ef4444');
    }
}

// -----------------------------
// 🟢 تسجيل الخروج (ببساطة حذف التوكن)
// -----------------------------
function logout() {
    localStorage.removeItem('token');
    location.reload();
}
window.logout = logout;

// -----------------------------
// 🟢 دالة مساعدة: تأمين النص قبل العرض
// -----------------------------
function escapeHtml(unsafe) {
    return String(unsafe)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// -----------------------------
// 🟢 إدارة الشريط الجانبي (hamburger + overlay)
// -----------------------------
function createOverlay() {
    let ov = document.getElementById(OVERLAY_ID);
    if (!ov) {
        ov = document.createElement('div');
        ov.id = OVERLAY_ID;
        ov.style.position = 'fixed';
        ov.style.inset = '0';
        ov.style.background = 'rgba(0,0,0,0.45)';
        ov.style.zIndex = '1050';
        document.body.appendChild(ov);
        ov.addEventListener('click', () => {
            closeSidebarMobile();
        });
    } else {
        ov.style.display = 'block';
    }
}

function removeOverlay() {
    const ov = document.getElementById(OVERLAY_ID);
    if (ov) ov.remove();
}

function openSidebarMobile() {
    const sidebar = document.getElementById('sidebar');
    const menuToggle = document.getElementById('menuToggle');
    if (!sidebar) return;
    sidebar.classList.remove('collapsed');
    sidebar.classList.add('open');
    if (menuToggle) menuToggle.classList.remove('sidebar-collapsed');
    createOverlay();
    updateMenuAria();
}

function closeSidebarMobile() {
    const sidebar = document.getElementById('sidebar');
    const menuToggle = document.getElementById('menuToggle');
    if (!sidebar) return;
    sidebar.classList.remove('open');
    sidebar.classList.add('collapsed');
    if (menuToggle) menuToggle.classList.add('sidebar-collapsed');
    removeOverlay();
    updateMenuAria();
}

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const main = document.getElementById('mainContent') || document.querySelector('.main-content');
    const menuToggle = document.getElementById('menuToggle');
    if (!sidebar || !menuToggle) return;

    if (window.innerWidth <= 1024) {
        // سلوك الجوال
        if (sidebar.classList.contains('open')) {
            closeSidebarMobile();
        } else {
            openSidebarMobile();
        }
    } else {
        // سلوك سطح المكتب
        if (sidebar.classList.contains('collapsed')) {
            sidebar.classList.remove('collapsed');
            if (main) main.classList.remove('expanded');
            menuToggle.classList.remove('sidebar-collapsed');
        } else {
            sidebar.classList.add('collapsed');
            if (main) main.classList.add('expanded');
            menuToggle.classList.add('sidebar-collapsed');
        }
        updateMenuAria();
    }
}

// ربط الدالة على النافذة لتسهيل الاستخدام من HTML inline onclick
window.toggleSidebar = toggleSidebar;

// -----------------------------
// 🟢 تحديث aria-expanded للزر
// -----------------------------
function updateMenuAria() {
    const menuToggle = document.getElementById('menuToggle');
    const sidebar = document.getElementById('sidebar');
    if (!menuToggle || !sidebar) return;
    const isOpen = (!sidebar.classList.contains('collapsed') && (window.innerWidth > 1024 || sidebar.classList.contains('open')));
    menuToggle.setAttribute('aria-expanded', String(isOpen));
}

// -----------------------------
// 🟢 تهيئة عند تحميل الصفحة
// -----------------------------
document.addEventListener('DOMContentLoaded', () => {
    // تحقق المصادقة
    checkAuth();

    // ربط أحداث واجهة المستخدم
    const mediaFile = document.getElementById('mediaFile');
    if (mediaFile) mediaFile.addEventListener('change', () => {
        const txt = document.getElementById('fileTxt');
        if (mediaFile.files && mediaFile.files.length > 0 && txt) txt.innerText = mediaFile.files[0].name;
    });

    const customVoice = document.getElementById('customVoice');
    if (customVoice) customVoice.addEventListener('change', function() {
        const txt = document.getElementById('customVoiceTxt');
        if (this.files && this.files.length > 0 && txt) txt.innerText = this.files[0].name;
    });

    const dubBtn = document.getElementById('dubBtn');
    if (dubBtn) dubBtn.addEventListener('click', () => {
        // استدعاء دالة بدء الدبلجة إن وُجدت في dubbing.js
        if (typeof startDubbing === 'function') startDubbing();
        else showToast('وظيفة الدبلجة غير متاحة حالياً.', '#f97316');
    });

    // زر القائمة (menuToggle)
    const menuToggle = document.getElementById('menuToggle');
    if (menuToggle) {
        menuToggle.addEventListener('click', (e) => {
            e.preventDefault();
            toggleSidebar();
        });
    }

    // تهيئة حالة الشريط حسب حجم الشاشة
    const sidebar = document.getElementById('sidebar');
    if (sidebar) {
        if (window.innerWidth <= 1024) {
            sidebar.classList.add('collapsed');
            sidebar.classList.remove('open');
            const mt = document.getElementById('menuToggle');
            if (mt) mt.classList.add('sidebar-collapsed');
        } else {
            sidebar.classList.remove('collapsed');
            sidebar.classList.remove('open');
            const mt = document.getElementById('menuToggle');
            if (mt) mt.classList.remove('sidebar-collapsed');
        }
    }

    updateMenuAria();
});

// -----------------------------
// 🟢 استجابة لتغيير حجم النافذة
// -----------------------------
window.addEventListener('resize', () => {
    const sidebar = document.getElementById('sidebar');
    const main = document.getElementById('mainContent') || document.querySelector('.main-content');
    const menuToggle = document.getElementById('menuToggle');

    if (!sidebar) return;

    if (window.innerWidth > 1024) {
        // إزالة حالة الجوال
        sidebar.classList.remove('open');
        removeOverlay();
        // إذا لم يكن collapsed افتراضياً، اتركه مفتوح
        if (!sidebar.classList.contains('collapsed')) {
            if (main) main.classList.remove('expanded');
            if (menuToggle) menuToggle.classList.remove('sidebar-collapsed');
        }
    } else {
        // على الجوال اجعل الشريط مخفي افتراضياً إن لم يكن مفتوحاً
        if (!sidebar.classList.contains('open')) {
            sidebar.classList.add('collapsed');
            if (menuToggle) menuToggle.classList.add('sidebar-collapsed');
        }
    }
    updateMenuAria();
});
