// dubbing.js — النسخة المطورة والمصلحة
(function() {
    'use strict';

    const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB
    const els = {
        mediaFile: document.getElementById('mediaFile'),
        fileTxt: document.getElementById('fileTxt'),
        chooseMediaBtn: document.getElementById('chooseMediaBtn'),
        voiceSelect: document.getElementById('voiceSelect'),
        dubBtn: document.getElementById('dubBtn'),
        progressArea: document.getElementById('progressArea'),
        statusTxt: document.getElementById('statusTxt'),
        progFill: document.getElementById('progFill'),
        resultsCard: document.getElementById('resultsCard'),
        resultsList: document.getElementById('resultsList'),
        // مسميات عناصر الرصيد (تأكد أن أحد هذه الـ IDs موجود في الـ HTML)
        creditDisplay: document.getElementById('user-credits') || document.querySelector('.points-count')
    };

    let currentJobId = null;
    let pollInterval = null;

    // =================================
    // 🛠️ وظيفة تحديث الرصيد (الإضافة الجديدة)
    // =================================
    async function updateBalance() {
        const token = localStorage.getItem('token') || localStorage.getItem('sb-access-token');
        if (!token) return;

        try {
            const response = await fetch(`https://web-production-14a1.up.railway.app/api/user/credits`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            if (data.success && els.creditDisplay) {
                els.creditDisplay.textContent = data.user.credits;
                // تحديث الرصيد في أي مكان آخر بالصفحة يحمل نفس الكلاس
                document.querySelectorAll('.points-count').forEach(el => el.textContent = data.user.credits);
            }
        } catch (err) {
            console.error('Failed to fetch credits:', err);
        }
    }

    // =================================
    // API calls
    // =================================
    async function startDubbing() {
        const mediaFile = els.mediaFile.files[0];
        const langs = window.selectedLangs ? [...window.selectedLangs] : ['ar'];
        const token = localStorage.getItem('token') || localStorage.getItem('sb-access-token');

        if (!mediaFile) {
            window.showToast?.('يرجى اختيار ملف أولاً', 'warning');
            return;
        }

        if (!token) {
            window.showToast?.('يرجى تسجيل الدخول', 'error');
            return;
        }

        showProgress();

        try {
            const formData = new FormData();
            // 🛠️ تم تعديل المسمى إلى media_file ليتوافق مع السيرفر
            formData.append('media_file', mediaFile); 
            formData.append('lang', langs[0]); // إرسال اللغة المختارة

            setProgress(5, 'جاري رفع الملف للسيرفر...');

            const response = await fetch(`https://web-production-14a1.up.railway.app/api/dubbing`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                throw new Error(errData.error || 'فشل البدء');
            }

            const data = await response.json();
            currentJobId = data.job_id;
            setProgress(15, 'تم الرفع! بدأت المعالجة الآن...');
            
            // تحديث الرصيد فوراً لأنه تم خصمه في السيرفر
            updateBalance();

        } catch (err) {
            console.error('Dubbing error:', err);
            window.showToast?.(err.message, 'error');
            setProgress(0, 'فشلت العملية');
            hideProgress();
        }
    }

    // الوظائف المساعدة (setProgress, showProgress, إلخ) تبقى كما هي في كودك الأصلي...

    function init() {
        els.chooseMediaBtn?.addEventListener('click', () => els.mediaFile?.click());
        els.mediaFile?.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) els.fileTxt.textContent = file.name;
        });
        els.dubBtn?.addEventListener('click', startDubbing);

        // 🛠️ تحديث الرصيد فور تحميل الصفحة
        updateBalance();
    }

    init();
})();
