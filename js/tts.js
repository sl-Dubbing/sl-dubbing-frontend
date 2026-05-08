document.addEventListener('DOMContentLoaded', () => {
    // 1. تبديل وضع الجودة (سريع / عالي الجودة)
    const modeButtons = document.querySelectorAll('.mode-option');
    modeButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            // إزالة التفعيل من كل الأزرار
            modeButtons.forEach(b => b.classList.remove('active'));
            // تفعيل الزر المضغوط
            btn.classList.add('active');
            // تغيير الـ data-mode في الـ body لإظهار/إخفاء قسم البصمة الصوتية
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

    // 3. ربط زر التوليد (تشغيل فوري سريع) بسيرفر البايثون الخاص بنا
    const instantBtn = document.getElementById('ttsInstantBtn');
    if (instantBtn) {
        instantBtn.addEventListener('click', async () => {
            const text = textInput.value.trim();
            if (!text) {
                if (window.showToast) showToast('الرجاء كتابة نص أولاً', 'error');
                else alert('الرجاء كتابة نص أولاً');
                return;
            }

            // معرفة الوضع الحالي (سريع أو جودة عالية)
            const mode = document.body.getAttribute('data-mode'); // 'fast' أو 'quality'
            
            // للحصول على اللغة (مؤقتاً سنضعها عربي، ويمكنك ربطها بـ lang-picker لاحقاً)
            const lang = 'ar'; 
            
            // تعطيل الزر وتغيير النص لتوضيح حالة التحميل
            const originalHtml = instantBtn.innerHTML;
            instantBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري التوليد والرفع...';
            instantBtn.disabled = true;

            try {
                // إرسال الطلب إلى الخادم المحلي (Local Factory) الذي صممناه
                const response = await fetch('https://steps-dental-matthew-vancouver.trycloudflare.com', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        text: text, 
                        lang: lang,
                        mode: mode === 'quality' ? 'hq' : 'fast' 
                    })
                });

                const data = await response.json();
                
                if (data.status === 'success' && data.audio_url) {
                    if (window.showToast) showToast('✅ تم توليد الصوت بنجاح!', 'success');
                    
                    // تشغيل الصوت فوراً في المتصفح
                    const audio = new Audio(data.audio_url);
                    audio.play();
                } else {
                    throw new Error(data.error || 'فشل التوليد في الخادم');
                }
            } catch (err) {
                console.error(err);
                if (window.showToast) showToast('❌ حدث خطأ: تأكد أن سيرفر البايثون يعمل', 'error');
            } finally {
                // إعادة الزر لحالته الطبيعية
                instantBtn.innerHTML = originalHtml;
                instantBtn.disabled = false;
            }
        });
    }
});
