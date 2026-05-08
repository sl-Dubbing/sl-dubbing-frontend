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

    // 3. زر التوليد (تشغيل فوري سريع)
    const instantBtn = document.getElementById('ttsInstantBtn');
    if (instantBtn) {
        instantBtn.addEventListener('click', async () => {
            const text = textInput.value.trim();
            if (!text) {
                if (window.showToast) showToast('الرجاء كتابة نص أولاً', 'error');
                return;
            }

            // 👈 1. قراءة كود اللغة المختارة من lang-picker.js (الافتراضي: ar)
            let targetLangCode = 'ar'; 
            if (window.selectedLangs && window.selectedLangs.size > 0) {
                targetLangCode = Array.from(window.selectedLangs)[0]; 
            }

            // 👈 2. جلب اسم اللغة بالعربي من languages-data.js لعرضه في الإشعار
            let targetLangName = targetLangCode;
            if (window.LANGUAGES) {
                const langObj = window.LANGUAGES.find(l => l.code === targetLangCode);
                if (langObj) {
                    targetLangName = langObj.name_ar; // سيجلب "الإنجليزية" مثلاً
                }
            }

            const mode = document.body.getAttribute('data-mode') || 'fast';
            
            const originalHtml = instantBtn.innerHTML;
            instantBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري التوليد...';
            instantBtn.disabled = true;

            try {
                // ⚠️ تأكد دائماً أن الرابط هو رابط النفق النشط 
                const response = await fetch('https://duty-grow-pic-becomes.trycloudflare.com/text-to-speech', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        text: text, 
                        lang: targetLangCode, // إرسال الكود مثل: en, fr, zh
                        mode: mode === 'quality' ? 'hq' : 'fast' 
                    })
                });

                const data = await response.json();
                
                if (data.status === 'success' && data.audio_url) {
                    // استخدام الاسم العربي في الإشعار
                    if (window.showToast) showToast(`✅ تم التوليد باللغة (${targetLangName}) بنجاح!`, 'success');
                    
                    const audio = new Audio(data.audio_url);
                    audio.play();
                } else {
                    throw new Error(data.error || 'فشل التوليد في الخادم');
                }
            } catch (err) {
                console.error(err);
                if (window.showToast) showToast('❌ حدث خطأ في الاتصال بالخادم', 'error');
            } finally {
                instantBtn.innerHTML = originalHtml;
                instantBtn.disabled = false;
            }
        });
    }
});
