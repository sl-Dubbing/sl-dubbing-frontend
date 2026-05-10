document.addEventListener('DOMContentLoaded', () => {
    let currentLangCode = 'ar-sa';
    let currentAudio = null;

    // --- بناء قائمة اللغات المنسدلة ---
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

    // --- ✨ التدقيق الذكي (AI) ---
    document.getElementById('ttsFixBtn').onclick = async () => {
        const text = document.getElementById('ttsInput').value.trim();
        if(!text) return;
        const btn = document.getElementById('ttsFixBtn');
        const oldIcon = btn.innerHTML;
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
                if(window.showToast) showToast('✨ Text improved and corrected', 'success');
            }
        } catch (e) { console.error(e); }
        finally { btn.innerHTML = oldIcon; }
    };

    // --- النطق والتنزيل ---
    async function processTTS(isDownload = false) {
        const input = document.getElementById('ttsInput');
        const textToRead = isDownload ? input.value.trim() : (input.value.substring(input.selectionStart).trim() || input.value.trim());
        
        if(!textToRead) return window.showToast?.('Please enter text first', 'error');

        const btn = isDownload ? document.getElementById('ttsDownloadBtn') : document.getElementById('ttsPlayBtn');
        const oldHtml = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        
        const mode = document.querySelector('.mode-option.active').dataset.mode;

        try {
            const res = await fetch('https://duty-grow-pic-becomes.trycloudflare.com/text-to-speech', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    text: textToRead, lang: currentLangCode,
                    voice_config: window.getVoiceConfig ? window.getVoiceConfig() : { source: 'original' }, 
                    speed: document.getElementById('speedSlider').value,
                    mode: mode
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

    document.getElementById('ttsPlayBtn').onclick = () => processTTS(false);
    document.getElementById('ttsDownloadBtn').onclick = () => processTTS(true);
    document.getElementById('ttsStopBtn').onclick = () => { if(currentAudio) currentAudio.pause(); document.getElementById('ttsStopBtn').style.display = 'none'; document.getElementById('ttsPlayBtn').style.display = 'flex'; };

    // تبديل أوضاع الجودة
    document.querySelectorAll('.mode-option').forEach(opt => {
        opt.onclick = () => {
            document.querySelectorAll('.mode-option').forEach(o => o.classList.remove('active'));
            opt.classList.add('active');
        };
    });

    // عداد الحروف والسرعة
    document.getElementById('ttsInput').oninput = (e) => { document.getElementById('charCount').innerText = e.target.value.length; };
    document.getElementById('speedSlider').oninput = (e) => {
        const v = e.target.value;
        document.getElementById('speedVal').innerText = v == 0 ? 'Normal' : (v > 0 ? `+${v}%` : `${v}%`);
    };
});
