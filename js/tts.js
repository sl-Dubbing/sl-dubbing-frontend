// js/tts.js — Fixed API Connection & UI Arrows
document.addEventListener('DOMContentLoaded', () => {
    let currentLangCode = 'en-us';
    let currentAudio = null;

    // --- Dropdown Menu Build ---
    const menuEl = document.getElementById('langMenu');
    if (menuEl && window.LANG_MENU) {
        window.LANG_MENU.forEach(item => {
            const li = document.createElement('li');
            li.style.padding = '10px 15px'; li.style.cursor = 'pointer';
            if (item.hasSub) {
                li.className = 'has-submenu';
                // ✅ تم إصلاح السهم ليتجه لليمين (English UI)
                li.innerHTML = `<span>${item.icon} ${item.name}</span> <i class="fas fa-chevron-right" style="opacity: 0.5; font-size: 0.8rem;"></i>`;
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
        document.getElementById('langSelected').innerHTML = `<div><span>${flag}</span> <span style="margin-left:8px;">${name}</span></div> <i class="fas fa-chevron-down"></i>`;
        document.getElementById('langDropdown').classList.remove('open');
    }

    document.getElementById('langSelected').onclick = (e) => { e.stopPropagation(); document.getElementById('langDropdown').classList.toggle('open'); };
    document.addEventListener('click', () => document.getElementById('langDropdown').classList.remove('open'));

    // --- ✨ AI Proofread (Using Official API) ---
    document.getElementById('ttsFixBtn').onclick = async () => {
        const text = document.getElementById('ttsInput').value.trim();
        if(!text) return;
        const btn = document.getElementById('ttsFixBtn');
        const oldIcon = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${window.API_BASE}/api/improve-text`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': token ? `Bearer ${token}` : ''
                },
                body: JSON.stringify({ text: text, lang: currentLangCode.split('-')[0] })
            });
            const data = await res.json();
            if(data.status === 'success' || data.fixed_text) {
                document.getElementById('ttsInput').value = data.fixed_text || data.text;
                if(window.showToast) window.showToast('✨ Text improved', 'success');
            }
        } catch (e) { console.error(e); }
        finally { btn.innerHTML = oldIcon; }
    };

    // --- Audio Processing (Using tts-quick.js) ---
    async function processTTS(isDownload = false) {
        const input = document.getElementById('ttsInput');
        const textToRead = isDownload ? input.value.trim() : (input.value.substring(input.selectionStart).trim() || input.value.trim());
        
        if(!textToRead) return window.showToast?.('Please enter text first', 'error');

        const btn = isDownload ? document.getElementById('ttsDownloadBtn') : document.getElementById('ttsPlayBtn');
        const oldHtml = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        
        const speedVal = document.getElementById('speedSlider').value;
        const rate = speedVal == 0 ? '+0%' : (speedVal > 0 ? `+${speedVal}%` : `${speedVal}%`);

        try {
            // ✅ الاعتماد على quickTTS للاتصال الآمن بالسيرفر
            if (typeof window.quickTTS !== 'function') throw new Error("TTS Engine not loaded.");
            
            const result = await window.quickTTS(textToRead, {
                lang: currentLangCode,
                rate: rate
            });

            if(isDownload) {
                const a = document.createElement('a'); a.href = result.url; a.download = 'voice.mp3'; a.click();
            } else {
                if(currentAudio) currentAudio.pause();
                currentAudio = result.audio;
                document.getElementById('ttsPlayBtn').style.display = 'none';
                document.getElementById('ttsStopBtn').style.display = 'flex';
                currentAudio.play();
                currentAudio.onended = () => { document.getElementById('ttsStopBtn').onclick(); };
            }
        } catch(e) {
            window.showToast?.(e.message, 'error');
        } finally { 
            btn.innerHTML = oldHtml; 
        }
    }

    document.getElementById('ttsPlayBtn').onclick = () => processTTS(false);
    document.getElementById('ttsDownloadBtn').onclick = () => processTTS(true);
    document.getElementById('ttsStopBtn').onclick = () => { if(currentAudio) currentAudio.pause(); document.getElementById('ttsStopBtn').style.display = 'none'; document.getElementById('ttsPlayBtn').style.display = 'flex'; };

    document.querySelectorAll('.mode-option').forEach(opt => {
        opt.onclick = () => {
            document.querySelectorAll('.mode-option').forEach(o => o.classList.remove('active'));
            opt.classList.add('active');
        };
    });

    document.getElementById('ttsInput').oninput = (e) => { document.getElementById('charCount').innerText = e.target.value.length; };
    document.getElementById('speedSlider').oninput = (e) => {
        const v = e.target.value;
        document.getElementById('speedVal').innerText = v == 0 ? 'Normal' : (v > 0 ? `+${v}%` : `${v}%`);
    };
});
