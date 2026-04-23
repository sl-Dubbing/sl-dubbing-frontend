let selectedVoiceId = 'source';
let selectedLang = '';
let customVoiceBase64 = '';

const LANGS = [
    {c:'ar', n:'Arabic', f:'🇸🇦'}, {c:'en', n:'English', f:'🇺🇸'},
    {c:'es', n:'Spanish', f:'🇪🇸'}, {c:'fr', n:'French', f:'🇫🇷'},
    {c:'de', n:'German', f:'🇩🇪'}, {c:'it', n:'Italian', f:'🇮🇹'}
];

// وظيفة الإخفاء والإظهار
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const mainContent = document.getElementById('mainContent');
    sidebar.classList.toggle('collapsed');
    mainContent.classList.toggle('expanded');
}

function renderLangs() {
    const select = document.getElementById('langSelect');
    if (!select) return;
    LANGS.forEach(l => {
        const opt = document.createElement('option');
        opt.value = l.c;
        opt.textContent = `${l.f} ${l.n}`;
        select.appendChild(opt);
    });
}

function updateFileName() {
    const input = document.getElementById('mediaFile');
    document.getElementById('fileTxt').innerText = input.files[0] ? input.files[0].name : "لم يتم اختيار ملف";
}

// ... بقية دوال الـ API (startDubbing, startSSE) تظل كما هي ...

document.addEventListener('DOMContentLoaded', () => {
    renderLangs();
});
