document.addEventListener('DOMContentLoaded', () => {
    let currentLangCode = 'ar-sa';
    let currentAudio = null;

    // --- بناء قائمة اللغات ---
    const menuEl = document.getElementById('langMenu');
    if (menuEl && window.LANG_MENU) {
        window.LANG_MENU.forEach(item => {
            const li = document.createElement('li');
            li.style.padding = '10px 15px'; li.style.cursor = 'pointer';
            if (item.hasSub) {
                li.className = 'has-submenu';
                li.innerHTML = `<span>${item.icon} ${item.name}</span> <i class="fas fa-chevron-left"></i>`;
                const subUl = document.createElement('ul');
                subUl.className = 'submenu';
                item.items.forEach(sub => {
                    const subLi = document.createElement('li');
                    subLi.style.padding = '10px 15px';
                    subLi.innerHTML = `<span>${sub.flag} ${sub.name}</span>`;
                    subLi.onclick = (e) => { e.stopPropagation(); selectLang(sub.code, `${item.name} (${sub.name})`, sub.flag); };
                    subUl.appendChild(subLi);
                });
                li.appendChild(subUl);
            } else {
                li.innerHTML = `<span>${item.flag} ${item.name}</span>`;
                li.onclick = (e) => { e.stopPropagation(); selectLang(item.code, item.name, item.flag); };
            }
            menuEl.appendChild(li);
        });
    }

    function selectLang(code, name, flag) {
        currentLangCode = code;
        document.getElementById('langSelected').innerHTML = `<div><span>${flag}</span> <span style="margin-right:8px;">${name}</span></div> <i class="fas fa-chevron-down"></i>`;
        document.getElementById('langDropdown').classList.remove('open');
    }

    document.getElementById('langSelected').onclick = (e) => { e.stopPropagation(); document.getElementById('langDropdown').classList.toggle('open'); };
    document.addEventListener('click', () => document.getElementById('langDropdown').classList.remove('open'));

    // --- ✨ ميزة التدقيق الذكي (تتصل بسيرفر البايثون) ---
    document.getElementById('ttsFixBtn').onclick = async () => {
        const text = document.getElementById('ttsInput').value.trim();
        if(!text) return;
        const btn = document.getElementById('ttsFixBtn');
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        
        try {
            const res = await fetch('https://duty-grow-pic-becomes.trycloudflare.com/improve-text', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: text, lang: currentLangCode.split('-')[0] })
            });
            const data = await res.json();
            if(data.status === 'success') {
                document.getElementById('ttsInput').value = data.fixed_text;
                window.showToast?.('✨ تم تحسين الحوار وتصحيح النص ذكياً', 'success');
            }
        } catch (e) { window.showToast?.('خطأ في الاتصال بالسيرفر', 'error'); }
        finally { btn.innerHTML = '<i class="fas fa-wand-magic-sparkles"></i>'; }
    };

    // --- الإملاء والسرعة ---
    document.getElementById('ttsInput').oninput = (e) => { document.getElementById('charCount').innerText = e.target.value.length; };
    document.getElementById('speedSlider').oninput = (e) => {
        const v = e.target.value;
        document.getElementById('speedVal').innerText = v == 0 ? 'طبيعي' : (v > 0 ? `+${v}%` : `${v}%`);
    };

    // --- التشغيل والتنزيل ---
    async function processVoice(isDownload = false) {
        const input = document.getElementById('ttsInput');
        const text = isDownload ? input.value : (input.value.substring(input.selectionStart).trim() || input.value.trim());
        if(!text) return;

        const btn = isDownload ? document.getElementById('ttsDownloadBtn') : document.getElementById('ttsPlayBtn');
        const oldHtml = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

        try {
            const res = await fetch('https://duty-grow-pic-becomes.trycloudflare.com/text-to-speech', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    text: text, lang: currentLangCode, 
                    speed: document.getElementById('speedSlider').value 
                })
            });
            const data = await res.json();
            if(data.status === 'success') {
                if(isDownload) {
                    const a = document.createElement('a'); a.href = data.audio_url; a.download = 'voice.mp3'; a.click();
                } else {
                    if(currentAudio) currentAudio.pause();
                    currentAudio = new Audio(data.audio_url);
                    document.getElementById('ttsPlayBtn').style.display = 'none';
                    document.getElementById('ttsStopBtn').style.display = 'flex';
                    currentAudio.play();
                    currentAudio.onended = () => { document.getElementById('ttsStopBtn').onclick(); };
                }
            }
        } finally { btn.innerHTML = oldHtml; }
    }

    document.getElementById('ttsPlayBtn').onclick = () => processVoice(false);
    document.getElementById('ttsDownloadBtn').onclick = () => processVoice(true);
    document.getElementById('ttsStopBtn').onclick = () => { if(currentAudio) currentAudio.pause(); document.getElementById('ttsStopBtn').style.display = 'none'; document.getElementById('ttsPlayBtn').style.display = 'flex'; };
});
