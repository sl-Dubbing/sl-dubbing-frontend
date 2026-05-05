// --- 1. إدارة الشريط الجانبي ---
function openSidebar() {
    document.getElementById('sidebar').classList.add('active');
    document.getElementById('overlay').classList.add('active');
}

function closeSidebar() {
    document.getElementById('sidebar').classList.remove('active');
    document.getElementById('overlay').classList.remove('active');
}

// --- 2. إدارة معاينة الملف (Preview) ---
document.getElementById('mediaFile').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (file) {
        const url = URL.createObjectURL(file);
        const dropZone = document.getElementById('dropZone');
        const previewArea = document.getElementById('previewArea');
        const dubBtn = document.getElementById('dubBtn');
        const vPreview = document.getElementById('videoPreview');
        const aPreview = document.getElementById('audioPreviewLabel');

        dropZone.style.display = 'none';
        previewArea.style.display = 'block';
        dubBtn.style.display = 'block';

        if (file.type.startsWith('video/')) {
            vPreview.src = url;
            vPreview.style.display = 'block';
            aPreview.style.display = 'none';
        } else {
            vPreview.style.display = 'none';
            aPreview.style.display = 'block';
            document.getElementById('audioFileName').innerText = file.name;
        }
    }
});

// --- 3. منطق الدبلجة والتبديل (Cinema) ---
let cinemaResults = {};

async function startDubbing() {
    // ... (هنا تضع منطق الرفع وطلب الدبلجة الخاص بك) ...
    // بمجرد اكتمال مهمة، قم بتخزينها في cinemaResults واستدعاء switchCinemaLang
}

function switchCinemaLang(langCode) {
    const data = cinemaResults[langCode];
    const player = document.getElementById('mainPlayer');
    const dlBtn = document.getElementById('masterDl');
    const dlArea = document.getElementById('dlArea');

    // تمييز العنصر النشط
    document.querySelectorAll('.side-lang-card').forEach(c => c.classList.remove('active'));
    document.getElementById(`cinema-${langCode}`).classList.add('active');

    const isMp4 = data.url.toLowerCase().includes('.mp4');
    if (isMp4) {
        player.innerHTML = `<video controls autoplay src="${data.url}" style="width:100%; height:100%;"></video>`;
    } else {
        player.innerHTML = `<div id="wsWave" style="width:85%;"></div>`;
        WaveSurfer.create({ container: '#wsWave', waveColor: '#555', progressColor: '#fff', height: 80, url: data.url }).on('ready', function() { this.play(); });
    }

    dlArea.style.display = 'block';
    dlBtn.href = data.url;
}

// إغلاق القوائم عند الضغط خارجها
window.onclick = function(event) {
    if (!event.target.closest('.drop-btn')) {
        document.querySelectorAll('.drop-btn').forEach(d => d.classList.remove('active'));
    }
};
