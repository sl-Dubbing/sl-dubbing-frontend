document.addEventListener('DOMContentLoaded', () => {

    // 1. تبديل وضع الجودة (سريع / عالي الجودة)
    const modeButtons = document.querySelectorAll('.mode-option');
    modeButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            modeButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            document.body.setAttribute('data-mode', btn.dataset.mode);
        });
    });

    // 2. عداد الحروف الديناميكي
    const textInput = document.getElementById('ttsInput');
    const charCount = document.getElementById('charCount');
    if (textInput && charCount) {
        textInput.addEventListener('input', () => {
            charCount.textContent = textInput.value.length;
        });
    }

    // 3. تعبئة القائمة المنسدلة للغات (من ملف languages-data.js)
    const langSelect = document.getElementById('singleLangSelect');
    if (langSelect && window.LANGUAGES) {
        window.LANGUAGES.forEach(lang => {
            const option = document.createElement('option');
            option.value = lang.code;
            // عرض العلم + اسم اللغة + الكود (مثال: 🇸🇦 العربية (AR) )
            option.textContent = `${lang.flag} ${lang.name_ar} (${lang.code.toUpperCase()})`;
            
            // جعل اللغة العربية هي الافتراضية
            if(lang.code === 'ar') option.selected = true; 
            
            langSelect.appendChild(option);
        });
    }

    // 4. برمجة زر الميكروفون 🎙️ (التشغيل والنطق الفوري)
    const micBtn = document.getElementById('ttsMicBtn');
    if (micBtn) {
        micBtn.addEventListener('click', async () => {
            const text = textInput ? textInput.value.trim() : '';
            if (!text) {
                if (window.showToast) showToast('الرجاء كتابة نص أولاً ليتم نطقه!', 'error');
                return;
            }

            // قراءة كود اللغة المختارة من القائمة المنسدلة (مثلاً: ar أو es أو ja)
            const targetLangCode = langSelect.value;
            // قراءة اسم اللغة لعرضها في الإشعار
            const targetLangName = langSelect.options[langSelect.selectedIndex].text;

            const mode = document.body.getAttribute('data-mode') || 'fast';
            
            // تغيير شكل الميكروفون لدائرة تحميل أثناء الاتصال
            const originalIcon = micBtn.innerHTML;
            micBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
            micBtn.disabled = true;

            try {
                // ⚠️ تأكد دائماً أن الرابط هو رابط النفق النشط حالياً
                const response = await fetch('https://duty-grow-pic-becomes.trycloudflare.com/text-to-speech', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        text: text, 
                        lang: targetLangCode,
                        mode: mode === 'quality' ? 'hq' : 'fast' 
                    })
                });

                const data = await response.json();
                
                if (data.status === 'success' && data.audio_url) {
                    if (window.showToast) showToast(`✅ جاري نطق النص بـ ${targetLangName}`, 'success');
                    
                    // تشغيل الصوت فوراً
                    const audio = new Audio(data.audio_url);
                    audio.play();
                } else {
                    throw new Error(data.error || 'فشل التوليد في الخادم');
                }
            } catch (err) {
                console.error(err);
                if (window.showToast) showToast('❌ حدث خطأ في الاتصال بالخادم. تأكد من عمل النفق.', 'error');
            } finally {
                // إعادة شكل الميكروفون بعد الانتهاء
                micBtn.innerHTML = originalIcon;
                micBtn.disabled = false;
            }
        });
    }
});
