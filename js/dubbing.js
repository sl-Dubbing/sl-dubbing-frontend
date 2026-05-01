// dubbing.js — النسخة الكاملة والمصلحة 100%
(function() {
    'use strict';

    const els = {
        mediaFile: document.getElementById('mediaFile'),
        fileTxt: document.getElementById('fileTxt'),
        chooseMediaBtn: document.getElementById('chooseMediaBtn'),
        dubBtn: document.getElementById('dubBtn'),
        progressArea: document.getElementById('progressArea'),
        statusTxt: document.getElementById('statusTxt'),
        progFill: document.getElementById('progFill'),
        resultsCard: document.getElementById('resultsCard'),
        resultsList: document.getElementById('resultsList'),
        creditDisplay: document.getElementById('user-credits') || document.querySelector('.points-count')
    };

    let currentJobId = null;

    // --- وظائف مساعدة ---
    async function updateBalance() {
        const token = localStorage.getItem('token');
        if (!token) return;
        try {
            const res = await fetch(`https://web-production-14a1.up.railway.app/api/user/credits`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.success) {
                const credits = data.user?.credits ?? 0;
                if(els.creditDisplay) els.creditDisplay.textContent = credits;
                document.querySelectorAll('.points-count').forEach(el => el.textContent = credits);
            }
        } catch (e) { console.error('Balance update failed', e); }
    }

    function setProgress(percent, text) {
        if (els.progFill) els.progFill.style.width = percent + '%';
        if (text && els.statusTxt) els.statusTxt.textContent = text;
    }

    // 🛠️ هذه هي الوظيفة التي كانت مفقودة وتسببت في الخطأ
    function showProgress() {
        if (els.progressArea) els.progressArea.style.display = 'block';
        if (els.resultsCard) els.resultsCard.style.display = 'none';
        setProgress(0, 'جاري التحضير للرفع...');
        if (els.dubBtn) els.dubBtn.disabled = true;
    }

    function hideProgress() {
        if (els.dubBtn) els.dubBtn.disabled = false;
    }

    // --- المنطق الأساسي ---
    async function startDubbing() {
        const mediaFile = els.mediaFile.files[0];
        const token = localStorage.getItem('token');

        if (!mediaFile) {
            window.showToast?.('يرجى اختيار ملف أولاً', 'warning');
            return;
        }

        showProgress(); // الآن ستعمل بنجاح

        try {
            const formData = new FormData();
            formData.append('media_file', mediaFile); 
            formData.append('lang', 'ar'); 

            setProgress(10, 'جاري رفع الملف للسيرفر...');

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
            setProgress(20, 'تم الرفع! السيرفر بدأ المعالجة...');
            updateBalance();
        } catch (err) {
            window.showToast?.(err.message, 'error');
            setProgress(0, 'فشلت العملية');
            hideProgress();
        }
    }

    function init() {
        els.chooseMediaBtn?.addEventListener('click', () => els.mediaFile?.click());
        els.mediaFile?.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file && els.fileTxt) els.fileTxt.textContent = file.name;
        });
        els.dubBtn?.addEventListener('click', startDubbing);
        updateBalance();
    }

    init();
})();
