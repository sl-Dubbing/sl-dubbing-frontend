document.addEventListener('DOMContentLoaded', () => {

    // المتغيرات لحفظ اللغة المختارة حالياً
    let currentLangCode = 'ar-sa';
    let currentLangName = 'العربية (السعودية)';

    // --- 1. بناء القائمة المنسدلة المخصصة ---
    const dropdown = document.getElementById('langDropdown');
    const selectedEl = document.getElementById('langSelected');
    const menuEl = document.getElementById('langMenu');

    if (menuEl && window.LANG_MENU) {
        window.LANG_MENU.forEach(item => {
            const li = document.createElement('li');
            
            if (item.hasSub) {
                li.className = 'has-submenu';
                li.innerHTML = `<span>${item.icon} ${item.name}</span> <i class="fas fa-chevron-left" style="font-size:0.75rem; color:#94a3b8;"></i>`;
                
                // بناء القائمة الفرعية (اللهجات)
                const subUl = document.createElement('ul');
                subUl.className = 'submenu';
                item.items.forEach(sub => {
                    const subLi = document.createElement('li');
                    subLi.innerHTML = `<span>${sub.flag} ${sub.name}</span>`;
                    subLi.onclick = (e) => {
                        e.stopPropagation(); // منع إغلاق القائمة الأب فوراً
                        selectLang(sub.code, `${item.name} (${sub.name})`, sub.flag);
                    };
                    subUl.appendChild(subLi);
                });
                li.appendChild(subUl);
            } else {
                li.innerHTML = `<span>${item.flag} ${item.name}</span>`;
                li.onclick = (e) => {
                    e.stopPropagation();
                    selectLang(item.code, item.name, item.flag);
                };
            }
            menuEl.appendChild(li);
        });
    }

    // دالة تغيير اللغة
    function selectLang(code, name, flag) {
        currentLangCode = code;
        currentLangName = name;
        selectedEl.innerHTML = `<div><span class="flag">${flag}</span> <span class="name" style="margin-right:8px;">${name}</span></div> <i class="fas fa-chevron-down"></i>`;
        dropdown.classList.remove('open');
    }

    // فتح وإغلاق القائمة
    if (selectedEl) {
        selectedEl.onclick = () => dropdown.classList.toggle('open');
    }
    // إغلاق القائمة عند النقر خارجها
    document.addEventListener('click', (e) => {
        if (dropdown && !dropdown.contains(e.target)) dropdown.classList.remove('open');
    });

    // --- 2. العداد وتبديل الأوضاع ---
    const textInput = document.getElementById('ttsInput');
    const charCount = document.getElementById('charCount');
    if (textInput && charCount) {
        textInput.addEventListener('input', () => charCount.textContent = textInput.value.length);
    }
    
    document.querySelectorAll('.mode-option').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.mode-option').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            document.body.setAttribute('data-mode', btn.dataset.mode);
        });
    });

    // --- 3. 🎙️ الكتابة بالصوت (Speech-to-Text) ---
    const sttMicBtn = document.getElementById('sttMicBtn');
    let isRecording = false;
    let recognition;

    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        recognition = new SpeechRecognition();
        recognition.continuous = true; 
        recognition.interimResults = true; 

        recognition.onstart = () => {
            isRecording = true;
            sttMicBtn.classList.add('recording');
            if(window.showToast) showToast(`🎙️ جاري الاستماع بـ ${currentLangName}... تحدث الآن`, 'success');
        };

        recognition.onresult = (event) => {
            let finalTranscript = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) finalTranscript += event.results[i][0].transcript;
            }
            if(finalTranscript) {
                 textInput.value += (textInput.value ? ' ' : '') + finalTranscript;
                 charCount.textContent = textInput.value.length;
            }
        };

        recognition.onend = () => { isRecording = false; sttMicBtn.classList.remove('recording'); };
        recognition.onerror = () => { isRecording = false; sttMicBtn.classList.remove('recording'); };
    } else {
        if(sttMicBtn) sttMicBtn.style.display = 'none'; // إخفاء الزر إذا كان المتصفح لا يدعم الميزة
    }

    if (sttMicBtn) {
        sttMicBtn.addEventListener('click', () => {
            if (!recognition) return;
            if (isRecording) {
                recognition.stop();
            } else {
                recognition.lang = currentLangCode; // يجعل المتصفح يفهم اللهجة المختارة تحديداً!
                recognition.start();
            }
        });
    }

    // --- 4. ▶️ التوليد والنطق (Text-to-Speech) ---
    const playBtn = document.getElementById('ttsPlayBtn');
    if (playBtn) {
        playBtn.addEventListener('click', async () => {
            const text = textInput ? textInput.value.trim() : '';
            if (!text) {
                if (window.showToast) showToast('الرجاء كتابة نص أو استخدام الميكروفون للإملاء!', 'error');
                return;
            }

            const mode = document.body.getAttribute('data-mode') || 'fast';
            const originalIcon = playBtn.innerHTML;
            playBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
            playBtn.disabled = true;

            try {
                const response = await fetch('https://duty-grow-pic-becomes.trycloudflare.com/text-to-speech', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ text: text, lang: currentLangCode, mode: mode === 'quality' ? 'hq' : 'fast' })
                });

                const data = await response.json();
                
                if (data.status === 'success' && data.audio_url) {
                    if (window.showToast) showToast(`✅ جاري نطق النص بـ ${currentLangName}`, 'success');
                    const audio = new Audio(data.audio_url);
                    audio.play();
                } else {
                    throw new Error(data.error || 'فشل التوليد في الخادم');
                }
            } catch (err) {
                console.error(err);
                if (window.showToast) showToast('❌ حدث خطأ في الاتصال بالخادم. تأكد من عمل النفق.', 'error');
            } finally {
                playBtn.innerHTML = originalIcon;
                playBtn.disabled = false;
            }
        });
    }
});
