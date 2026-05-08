document.addEventListener('DOMContentLoaded', () => {
    let currentLangCode = 'ar-sa';
    let currentAudio = null;

    // --- 🛠️ إصلاح القائمة الجانبية (Sidebar) ---
    const menuBtn = document.getElementById('mainMenuBtn');
    const sidebar = document.getElementById('mainSidebar');
    const overlay = document.getElementById('mainOverlay');

    if (menuBtn && sidebar && overlay) {
        menuBtn.onclick = () => {
            sidebar.classList.add('open');
            overlay.classList.add('active');
        };
        overlay.onclick = () => {
            sidebar.classList.remove('open');
            overlay.classList.remove('active');
        };
    }

    // --- بناء قائمة اللغات ---
    const dropdown = document.getElementById('langDropdown');
    const selectedEl = document.getElementById('langSelected');
    const menuEl = document.getElementById('langMenu');

    if (menuEl && window.LANG_MENU) {
        window.LANG_MENU.forEach(item => {
            const li = document.createElement('li');
            if (item.hasSub) {
                li.className = 'has-submenu';
                li.innerHTML = `<span>${item.icon} ${item.name}</span> <i class="fas fa-chevron-left" style="font-size:0.7rem;"></i>`;
                const subUl = document.createElement('ul');
                subUl.className = 'submenu';
                item.items.forEach(sub => {
                    const subLi = document.createElement('li');
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
        selectedEl.innerHTML = `<div><span class="flag">${flag}</span> <span class="name" style="margin-right:8px;">${name}</span></div> <i class="fas fa-chevron-down"></i>`;
        dropdown.classList.remove('open');
    }

    if (selectedEl) selectedEl.onclick = (e) => { e.stopPropagation(); dropdown.classList.toggle('open'); };
    document.addEventListener('click', () => dropdown.classList.remove('open'));

    // --- السرعة والعداد ---
    const textInput = document.getElementById('ttsInput');
    const charCount = document.getElementById('charCount');
    const speedSlider = document.getElementById('speedSlider');
    const speedValueTxt = document.getElementById('speedValueTxt');

    if (textInput && charCount) textInput.oninput = () => charCount.textContent = textInput.value.length;
    if (speedSlider) speedSlider.oninput = () => {
        let v = speedSlider.value;
        speedValueTxt.textContent = v == 0 ? 'طبيعي' : (v > 0 ? `+${v}%` : `${v}%`);
    };

    // --- ✨ تحسين المصحح الإملائي (AI Fix) ---
    const fixBtn = document.getElementById('ttsFixBtn');
    if (fixBtn) {
        fixBtn.onclick = async () => {
            const text = textInput.value.trim();
            if (!text) return;
            fixBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
            fixBtn.disabled = true;

            try {
                const langBase = currentLangCode.split('-')[0];
                const res = await fetch('https://api.languagetool.org/v2/check', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: `text=${encodeURIComponent(text)}&language=${langBase === 'ar' ? 'ar' : 'en-US'}`
                });
                const data = await res.json();
                if (data.matches && data.matches.length > 0) {
                    let fixed = text;
                    // التصحيح من النهاية للبداية لضمان سلامة الـ offsets
                    data.matches.sort((a,b) => b.offset - a.offset).forEach(m => {
                        if (m.replacements && m.replacements.length > 0) {
                            fixed = fixed.slice(0, m.offset) + m.replacements[0].value + fixed.slice(m.offset + m.length);
                        }
                    });
                    textInput.value = fixed;
                    window.showToast?.('✨ تم تحسين النص وتصحيح الأخطاء', 'success');
                } else { window.showToast?.('النص سليم ولا يحتاج لتعديل', 'info'); }
            } catch (e) { window.showToast?.('فشل الاتصال بالمدقق', 'error'); }
            finally { fixBtn.innerHTML = '<i class="fas fa-wand-magic-sparkles"></i>'; fixBtn.disabled = false; }
        };
    }

    // --- 🎙️ الإملاء الصوتي ---
    const micBtn = document.getElementById('sttMicBtn');
    let recognition, isRecording = false;
    if ('webkitSpeechRecognition' in window) {
        recognition = new webkitSpeechRecognition();
        recognition.continuous = true;
        recognition.onstart = () => micBtn.classList.add('active-recording');
        recognition.onresult = (e) => { textInput.value += e.results[e.results.length-1][0].transcript; charCount.textContent = textInput.value.length; };
        recognition.onend = () => micBtn.classList.remove('active-recording');
    }
    if (micBtn) micBtn.onclick = () => { if(!isRecording) recognition.start(); else recognition.stop(); isRecording=!isRecording; };

    // --- 🚀 التوليد والنطق والتنزيل ---
    async function processTTS(text, isDownload = false) {
        if (!text) return window.showToast?.('اكتب نصاً أولاً', 'error');
        const btn = isDownload ? document.getElementById('ttsDownloadBtn') : document.getElementById('ttsPlayBtn');
        const oldHtml = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        btn.disabled = true;

        try {
            const response = await fetch('https://duty-grow-pic-becomes.trycloudflare.com/text-to-speech', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    text: text, 
                    lang: currentLangCode, 
                    mode: document.querySelector('.mode-option.active').dataset.mode,
                    speed: speedSlider.value 
                })
            });
            const data = await response.json();
            if (data.status === 'success') {
                if (isDownload) {
                    const a = document.createElement('a'); a.href = data.audio_url; a.download = `voice-${Date.now()}.mp3`; a.click();
                } else {
                    if (currentAudio) currentAudio.pause();
                    currentAudio = new Audio(data.audio_url);
                    document.getElementById('ttsPlayBtn').style.display = 'none';
                    document.getElementById('ttsStopBtn').style.display = 'flex';
                    currentAudio.play();
                    currentAudio.onended = () => document.getElementById('ttsStopBtn').click();
                }
            }
        } catch (e) { window.showToast?.('خطأ في الاتصال بالسيرفر', 'error'); }
        finally { btn.innerHTML = oldHtml; btn.disabled = false; }
    }

    document.getElementById('ttsPlayBtn').onclick = () => {
        const txt = textInput.value;
        const sub = txt.substring(textInput.selectionStart).trim() || txt.trim();
        processTTS(sub, false);
    };

    document.getElementById('ttsStopBtn').onclick = () => {
        if (currentAudio) currentAudio.pause();
        document.getElementById('ttsStopBtn').style.display = 'none';
        document.getElementById('ttsPlayBtn').style.display = 'flex';
    };

    document.getElementById('ttsDownloadBtn').onclick = () => processTTS(textInput.value.trim(), true);

    // تبديل الأوضاع
    document.querySelectorAll('.mode-option').forEach(opt => {
        opt.onclick = () => {
            document.querySelectorAll('.mode-option').forEach(o => o.classList.remove('active'));
            opt.classList.add('active');
        };
    });
});
