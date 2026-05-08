document.addEventListener('DOMContentLoaded', () => {
    let currentLangCode = 'ar-sa';
    let currentAudio = null;

    // --- بناء القائمة المنسدلة ---
    const dropdown = document.getElementById('langDropdown');
    const selectedEl = document.getElementById('langSelected');
    const menuEl = document.getElementById('langMenu');

    if (menuEl && window.LANG_MENU) {
        window.LANG_MENU.forEach(item => {
            const li = document.createElement('li');
            if (item.hasSub) {
                li.className = 'has-submenu';
                li.innerHTML = `<span>${item.icon} ${item.name}</span> <i class="fas fa-chevron-left"></i>`;
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
        selectedEl.innerHTML = `<div><span class="flag">${flag}</span> <span class="name">${name}</span></div> <i class="fas fa-chevron-down"></i>`;
        dropdown.classList.remove('open');
    }

    if (selectedEl) selectedEl.onclick = () => dropdown.classList.toggle('open');
    document.addEventListener('click', (e) => { if (dropdown && !dropdown.contains(e.target)) dropdown.classList.remove('open'); });

    // --- العداد والسرعة ---
    const textInput = document.getElementById('ttsInput');
    const charCount = document.getElementById('charCount');
    if (textInput && charCount) textInput.addEventListener('input', () => charCount.textContent = textInput.value.length);
    
    const speedSlider = document.getElementById('speedSlider');
    const speedValueTxt = document.getElementById('speedValueTxt');
    if (speedSlider) {
        speedSlider.addEventListener('input', () => {
            let val = speedSlider.value;
            speedValueTxt.textContent = val == 0 ? 'طبيعي' : (val > 0 ? `+${val}%` : `${val}%`);
        });
    }

    // --- ✨ إصلاح أداة التدقيق الإملائي ---
    const fixBtn = document.getElementById('ttsFixBtn');
    if (fixBtn) {
        fixBtn.onclick = async () => {
            const text = textInput.value.trim();
            if (!text) return window.showToast?.('اكتب نصاً لتدقيقه', 'error');

            fixBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
            fixBtn.disabled = true;

            try {
                const langBase = currentLangCode.split('-')[0];
                const response = await fetch('https://api.languagetool.org/v2/check', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: `text=${encodeURIComponent(text)}&language=${langBase === 'ar' ? 'ar' : 'auto'}`
                });
                const data = await response.json();
                
                if (data.matches && data.matches.length > 0) {
                    let newText = text;
                    // التصحيح من النهاية للبداية لضمان عدم تغير المؤشرات
                    data.matches.sort((a,b) => b.offset - a.offset).forEach(m => {
                        if (m.replacements && m.replacements.length > 0) {
                            newText = newText.slice(0, m.offset) + m.replacements[0].value + newText.slice(m.offset + m.length);
                        }
                    });
                    textInput.value = newText;
                    window.showToast?.('✨ تم تحسين النص وتصحيح الأخطاء', 'success');
                } else {
                    window.showToast?.('✅ النص سليم إملائياً', 'success');
                }
            } catch (err) { window.showToast?.('خطأ في الاتصال بمدقق النصوص', 'error'); }
            finally { fixBtn.innerHTML = '<i class="fas fa-wand-magic-sparkles"></i>'; fixBtn.disabled = false; }
        };
    }

    // --- 🎙️ الإملاء الصوتي ---
    const sttMicBtn = document.getElementById('sttMicBtn');
    let recognition, isRecording = false;
    if ('webkitSpeechRecognition' in window) {
        recognition = new webkitSpeechRecognition();
        recognition.continuous = true;
        recognition.onstart = () => sttMicBtn.classList.add('active-mic');
        recognition.onresult = (e) => { textInput.value += e.results[e.results.length-1][0].transcript; };
        recognition.onend = () => sttMicBtn.classList.remove('active-mic');
    }
    if (sttMicBtn) sttMicBtn.onclick = () => { if(!isRecording) recognition.start(); else recognition.stop(); isRecording=!isRecording; };

    // --- 🚀 دالة التوليد الموحدة ---
    async function generateVoice(textToRead, isDownload = false) {
        if (!textToRead) return;
        
        const btn = isDownload ? document.getElementById('ttsDownloadBtn') : document.getElementById('ttsPlayBtn');
        const originalHtml = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        btn.disabled = true;

        try {
            const response = await fetch('https://duty-grow-pic-becomes.trycloudflare.com/text-to-speech', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    text: textToRead, 
                    lang: currentLangCode, 
                    mode: document.querySelector('.mode-option.active').dataset.mode,
                    speed: speedSlider.value 
                })
            });

            const data = await response.json();
            if (data.status === 'success') {
                if (isDownload) {
                    const a = document.createElement('a');
                    a.href = data.audio_url;
                    a.download = `sl-dubbing-${Date.now()}.mp3`;
                    a.click();
                    window.showToast?.('📥 بدأ تحميل الملف الصوتي كاملاً', 'success');
                } else {
                    if (currentAudio) currentAudio.pause();
                    currentAudio = new Audio(data.audio_url);
                    document.getElementById('ttsPlayBtn').style.display = 'none';
                    document.getElementById('ttsStopBtn').style.display = 'flex';
                    currentAudio.play();
                    currentAudio.onended = () => { document.getElementById('ttsStopBtn').click(); };
                }
            }
        } catch (err) { window.showToast?.('حدث خطأ في الخادم', 'error'); }
        finally { btn.innerHTML = originalHtml; btn.disabled = false; }
    }

    // --- ربط الأزرار بالوظائف ---
    const playBtn = document.getElementById('ttsPlayBtn');
    const stopBtn = document.getElementById('ttsStopBtn');
    const downloadBtn = document.getElementById('ttsDownloadBtn');

    if (playBtn) playBtn.onclick = () => {
        const fullText = textInput.value;
        const start = textInput.selectionStart;
        const chunk = fullText.substring(start).trim() || fullText.trim();
        generateVoice(chunk, false);
    };

    if (stopBtn) stopBtn.onclick = () => { 
        if(currentAudio) currentAudio.pause(); 
        stopBtn.style.display='none'; 
        playBtn.style.display='flex'; 
    };

    if (downloadBtn) downloadBtn.onclick = () => {
        generateVoice(textInput.value.trim(), true); // النص كامل للتنزيل
    };
});
