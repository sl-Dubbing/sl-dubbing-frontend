document.addEventListener('DOMContentLoaded', () => {

    let currentLangCode = 'ar-sa';
    let currentLangName = 'العربية (السعودية)';
    let lastGeneratedAudioUrl = null; 
    let currentAudio = null; 

    // --- 1. بناء القائمة المنسدلة ---
    const dropdown = document.getElementById('langDropdown');
    const selectedEl = document.getElementById('langSelected');
    const menuEl = document.getElementById('langMenu');

    if (menuEl && window.LANG_MENU) {
        window.LANG_MENU.forEach(item => {
            const li = document.createElement('li');
            if (item.hasSub) {
                li.className = 'has-submenu';
                li.innerHTML = `<span>${item.icon} ${item.name}</span> <i class="fas fa-chevron-left" style="font-size:0.75rem; color:#94a3b8;"></i>`;
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
        currentLangCode = code; currentLangName = name;
        selectedEl.innerHTML = `<div><span class="flag">${flag}</span> <span class="name">${name}</span></div> <i class="fas fa-chevron-down"></i>`;
        dropdown.classList.remove('open');
    }

    if (selectedEl) selectedEl.onclick = () => dropdown.classList.toggle('open');
    document.addEventListener('click', (e) => { if (dropdown && !dropdown.contains(e.target)) dropdown.classList.remove('open'); });

    // --- 2. العداد وتبديل الأوضاع والسرعة ---
    const textInput = document.getElementById('ttsInput');
    const charCount = document.getElementById('charCount');
    if (textInput && charCount) textInput.addEventListener('input', () => charCount.textContent = textInput.value.length);
    
    document.querySelectorAll('.mode-option').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.mode-option').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            document.body.setAttribute('data-mode', btn.dataset.mode);
        });
    });

    const speedSlider = document.getElementById('speedSlider');
    const speedValueTxt = document.getElementById('speedValueTxt');
    if (speedSlider && speedValueTxt) {
        speedSlider.addEventListener('input', () => {
            const val = parseInt(speedSlider.value);
            if (val === 0) speedValueTxt.textContent = 'طبيعي';
            else if (val > 0) speedValueTxt.textContent = `+${val}% أسرع`;
            else speedValueTxt.textContent = `${val}% أبطأ`;
        });
    }

    // --- 3. ✨ التدقيق الإملائي والتصحيح الذكي (الجديد) ---
    const fixBtn = document.getElementById('ttsFixBtn');
    if (fixBtn) {
        fixBtn.addEventListener('click', async () => {
            const text = textInput ? textInput.value.trim() : '';
            if (!text) return window.showToast ? showToast('الرجاء كتابة نص أولاً لتدقيقه!', 'error') : alert('اكتب نصاً');

            const originalIcon = fixBtn.innerHTML;
            fixBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
            fixBtn.disabled = true;

            try {
                // استخراج اللغة الأساسية (مثلاً: من ar-sa نأخذ ar فقط ليفهمها المدقق)
                const langBase = currentLangCode.split('-')[0];
                
                // إرسال النص إلى خدمة LanguageTool المجانية
                const response = await fetch('https://api.languagetool.org/v2/check', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: new URLSearchParams({
                        text: text,
                        language: langBase === 'ar' ? 'ar' : 'auto' 
                    })
                });

                const data = await response.json();
                
                if (data.matches && data.matches.length > 0) {
                    let newText = text;
                    let fixCount = 0;
                    
                    // الترتيب العكسي ضروري لكي لا تتلخبط أماكن الحروف عند استبدال الكلمات
                    const matches = data.matches.sort((a, b) => b.offset - a.offset);
                    
                    matches.forEach(match => {
                        if (match.replacements && match.replacements.length > 0) {
                            const rep = match.replacements[0].value;
                            newText = newText.slice(0, match.offset) + rep + newText.slice(match.offset + match.length);
                            fixCount++;
                        }
                    });

                    textInput.value = newText;
                    if (charCount) charCount.textContent = newText.length;
                    
                    if (window.showToast) showToast(`✨ تم تصحيح ${fixCount} أخطاء إملائية بنجاح!`, 'success');
                } else {
                    if (window.showToast) showToast('✅ النص سليم ولا يوجد به أخطاء إملائية.', 'success');
                }
            } catch (err) {
                console.error(err);
                if (window.showToast) showToast('❌ حدث خطأ أثناء الاتصال بخدمة التدقيق.', 'error');
            } finally {
                fixBtn.innerHTML = originalIcon;
                fixBtn.disabled = false;
            }
        });
    }

    // --- 4. 🎙️ الكتابة بالصوت (STT) ---
    const sttMicBtn = document.getElementById('sttMicBtn');
    let recognition, isRecording = false;
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
        recognition.continuous = true; recognition.interimResults = true;
        recognition.onstart = () => { isRecording = true; sttMicBtn.classList.add('recording'); };
        recognition.onresult = (event) => {
            let finalTranscript = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) finalTranscript += event.results[i][0].transcript;
            }
            if(finalTranscript) { textInput.value += (textInput.value ? ' ' : '') + finalTranscript; charCount.textContent = textInput.value.length; }
        };
        recognition.onend = () => { isRecording = false; sttMicBtn.classList.remove('recording'); };
    }
    if (sttMicBtn) sttMicBtn.addEventListener('click', () => {
        if (!recognition) return;
        if (isRecording) recognition.stop();
        else { recognition.lang = currentLangCode; recognition.start(); }
    });

    // --- 5. ▶️ التوليد والنطق (TTS) و 🛑 الإيقاف ---
    const playBtn = document.getElementById('ttsPlayBtn');
    const stopBtn = document.getElementById('ttsStopBtn');
    const downloadBtn = document.getElementById('ttsDownloadBtn');

    if (stopBtn) {
        stopBtn.addEventListener('click', () => {
            if (currentAudio) {
                currentAudio.pause();
                currentAudio.currentTime = 0;
            }
            stopBtn.style.display = 'none';
            if (playBtn) playBtn.style.display = 'flex';
        });
    }

    if (playBtn) {
        playBtn.addEventListener('click', async () => {
            const text = textInput ? textInput.value.trim() : '';
            if (!text) return window.showToast ? showToast('الرجاء كتابة نص!', 'error') : alert('اكتب نصاً');

            const mode = document.body.getAttribute('data-mode') || 'fast';
            const speed = speedSlider ? speedSlider.value : 0;

            const originalIcon = playBtn.innerHTML;
            playBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
            playBtn.disabled = true;
            if(downloadBtn) downloadBtn.disabled = true;

            try {
                const response = await fetch('https://duty-grow-pic-becomes.trycloudflare.com/text-to-speech', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ text: text, lang: currentLangCode, mode: mode === 'quality' ? 'hq' : 'fast', speed: speed })
                });

                const data = await response.json();
                
                if (data.status === 'success' && data.audio_url) {
                    lastGeneratedAudioUrl = data.audio_url; 
                    if (downloadBtn) downloadBtn.disabled = false; 

                    if (window.showToast) showToast(`✅ جاري نطق النص بـ ${currentLangName}`, 'success');
                    
                    if (currentAudio) {
                        currentAudio.pause();
                        currentAudio.currentTime = 0;
                    }

                    currentAudio = new Audio(data.audio_url);
                    
                    playBtn.style.display = 'none';
                    if (stopBtn) stopBtn.style.display = 'flex';

                    currentAudio.play();

                    currentAudio.onended = () => {
                        if (stopBtn) stopBtn.style.display = 'none';
                        playBtn.style.display = 'flex';
                    };

                } else throw new Error(data.error || 'فشل التوليد');
            } catch (err) {
                if (window.showToast) showToast('❌ حدث خطأ في الاتصال بالخادم.', 'error');
            } finally {
                playBtn.innerHTML = originalIcon;
                playBtn.disabled = false;
            }
        });
    }

    // --- 6. 📥 التنزيل ---
    if (downloadBtn) {
        downloadBtn.addEventListener('click', () => {
            if (lastGeneratedAudioUrl) {
                const a = document.createElement('a');
                a.href = lastGeneratedAudioUrl;
                a.download = `Voice_${currentLangCode}_${new Date().getTime()}.mp3`;
                a.target = '_blank';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
            }
        });
    }
});
