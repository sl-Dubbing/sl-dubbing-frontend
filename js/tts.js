document.addEventListener('DOMContentLoaded', () => {
    let currentLangCode = 'ar-sa';
    let lastGeneratedAudioUrl = null; 
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

    // --- العداد والسرعة ---
    const textInput = document.getElementById('ttsInput');
    const charCount = document.getElementById('charCount');
    if (textInput && charCount) textInput.addEventListener('input', () => charCount.textContent = textInput.value.length);
    
    const speedSlider = document.getElementById('speedSlider');
    const speedValueTxt = document.getElementById('speedValueTxt');
    if (speedSlider) speedSlider.addEventListener('input', () => {
        let val = speedSlider.value;
        speedValueTxt.textContent = val == 0 ? 'طبيعي' : (val > 0 ? `+${val}%` : `${val}%`);
    });

    // --- 🎙️ الإملاء والكتابة ---
    const sttMicBtn = document.getElementById('sttMicBtn');
    let recognition, isRecording = false;
    if ('webkitSpeechRecognition' in window) {
        recognition = new webkitSpeechRecognition();
        recognition.continuous = true;
        recognition.onstart = () => sttMicBtn.classList.add('recording');
        recognition.onresult = (e) => {
            let t = e.results[e.results.length-1][0].transcript;
            textInput.value += t;
        };
        recognition.onend = () => sttMicBtn.classList.remove('recording');
    }
    if (sttMicBtn) sttMicBtn.onclick = () => { if(!isRecording) recognition.start(); else recognition.stop(); isRecording=!isRecording; };

    // --- ▶️ التوليد مع ميزة "المؤشر الذكي" ---
    const playBtn = document.getElementById('ttsPlayBtn');
    const stopBtn = document.getElementById('ttsStopBtn');
    const downloadBtn = document.getElementById('ttsDownloadBtn');

    if (playBtn) {
        playBtn.addEventListener('click', async () => {
            // 👈 الميزة الجديدة: جلب النص من مكان المؤشر لنهايته
            const fullText = textInput.value;
            const startIndex = textInput.selectionStart;
            const textToRead = fullText.substring(startIndex).trim() || fullText.trim();

            if (!textToRead) return window.showToast?.('اكتب نصاً أولاً', 'error');

            playBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
            playBtn.disabled = true;

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
                    lastGeneratedAudioUrl = data.audio_url;
                    downloadBtn.disabled = false;
                    if (currentAudio) currentAudio.pause();
                    currentAudio = new Audio(data.audio_url);
                    playBtn.style.display = 'none';
                    stopBtn.style.display = 'flex';
                    currentAudio.play();
                    currentAudio.onended = () => { stopBtn.style.display = 'none'; playBtn.style.display = 'flex'; };
                }
            } catch (err) {
                window.showToast?.('خطأ في الاتصال', 'error');
            } finally {
                playBtn.innerHTML = '<i class="fas fa-play"></i>';
                playBtn.disabled = false;
            }
        });
    }

    if (stopBtn) stopBtn.onclick = () => { currentAudio.pause(); stopBtn.style.display='none'; playBtn.style.display='flex'; };

    if (downloadBtn) downloadBtn.onclick = () => {
        const a = document.createElement('a');
        a.href = lastGeneratedAudioUrl;
        a.download = 'voice.mp3';
        a.click();
    };
});
