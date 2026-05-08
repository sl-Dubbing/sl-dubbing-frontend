document.addEventListener('DOMContentLoaded', () => {

    let currentLangCode = 'ar-sa';
    let currentLangName = 'العربية (السعودية)';
    let lastGeneratedAudioUrl = null; // لحفظ رابط الصوت للتنزيل

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

    // تحديث نص شريط السرعة
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

    // --- 3. 🎙️ الكتابة بالصوت (STT) ---
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

    // --- 4. ▶️ التوليد والنطق (TTS) ---
    const playBtn = document.getElementById('ttsPlayBtn');
    const downloadBtn = document.getElementById('ttsDownloadBtn');

    if (playBtn) {
        playBtn.addEventListener('click', async () => {
            const text = textInput ? textInput.value.trim() : '';
            if (!text) return window.showToast ? showToast('الرجاء كتابة نص!', 'error') : alert('اكتب نصاً');

            const mode = document.body.getAttribute('data-mode') || 'fast';
            const speed = speedSlider ? speedSlider.value : 0; // استخراج السرعة

            const originalIcon = playBtn.innerHTML;
            playBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
            playBtn.disabled = true;
            if(downloadBtn) downloadBtn.disabled = true;

            try {
                // إرسال الطلب مع متغير السرعة الجديد!
                const response = await fetch('https://duty-grow-pic-becomes.trycloudflare.com/text-to-speech', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        text: text, 
                        lang: currentLangCode, 
                        mode: mode === 'quality' ? 'hq' : 'fast',
                        speed: speed // إضافة السرعة للبايلود
                    })
                });

                const data = await response.json();
                
                if (data.status === 'success' && data.audio_url) {
                    lastGeneratedAudioUrl = data.audio_url; // حفظ الرابط
                    if (downloadBtn) downloadBtn.disabled = false; // تفعيل زر التنزيل

                    if (window.showToast) showToast(`✅ جاري نطق النص بـ ${currentLangName}`, 'success');
                    const audio = new Audio(data.audio_url);
                    audio.play();
                } else throw new Error(data.error || 'فشل التوليد');
            } catch (err) {
                if (window.showToast) showToast('❌ حدث خطأ في الاتصال بالخادم.', 'error');
            } finally {
                playBtn.innerHTML = originalIcon;
                playBtn.disabled = false;
            }
        });
    }

    // --- 5. 📥 التنزيل ---
    if (downloadBtn) {
        downloadBtn.addEventListener('click', () => {
            if (lastGeneratedAudioUrl) {
                // إنشاء زر مخفي لتحميل الملف مباشرة
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
