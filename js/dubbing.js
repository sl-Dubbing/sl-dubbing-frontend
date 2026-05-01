// dubbing.js — منطق استوديو الدبلجة
(function() {
    'use strict';

    const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB
    const ALLOWED_TYPES = ['video/', 'audio/'];
    const ALLOWED_AUDIO = ['audio/wav', 'audio/mp3', 'audio/mpeg', 'audio/ogg', 'audio/flac', 'audio/m4a'];

    const els = {
        mediaFile: document.getElementById('mediaFile'),
        fileTxt: document.getElementById('fileTxt'),
        chooseMediaBtn: document.getElementById('chooseMediaBtn'),
        customVoice: document.getElementById('customVoice'),
        customVoiceTxt: document.getElementById('customVoiceTxt'),
        chooseCustomVoiceBtn: document.getElementById('chooseCustomVoiceBtn'),
        voiceSelect: document.getElementById('voiceSelect'),
        dubBtn: document.getElementById('dubBtn'),
        progressArea: document.getElementById('progressArea'),
        statusTxt: document.getElementById('statusTxt'),
        progFill: document.getElementById('progFill'),
        resultsCard: document.getElementById('resultsCard'),
        resultsList: document.getElementById('resultsList'),
        miniStatus: document.getElementById('miniStatus')
    };

    let currentJobId = null;
    let pollInterval = null;

    // =================================
    // Validation helpers
    // =================================
    function validateFile(file, type) {
        if (!file) return 'لم يتم اختيار ملف';
        if (file.size > MAX_FILE_SIZE) return `الملف كبير جداً (الحد الأقصى ${MAX_FILE_SIZE/1024/1024}MB)`;

        if (type === 'media') {
            const isValid = ALLOWED_TYPES.some(t => file.type.startsWith(t));
            if (!isValid) return 'يجب اختيار ملف فيديو أو صوت';
        } else if (type === 'voice') {
            const isValid = ALLOWED_AUDIO.includes(file.type) || file.name.match(/\.(wav|mp3|ogg|flac|m4a)$/i);
            if (!isValid) return 'يجب اختيار ملف صوتي (wav, mp3, ogg, flac, m4a)';
        }
        return null;
    }

    function formatFileSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024*1024) return (bytes/1024).toFixed(1) + ' KB';
        return (bytes/1024/1024).toFixed(1) + ' MB';
    }

    // =================================
    // File handlers
    // =================================
    function handleMediaSelect(e) {
        const file = e.target.files[0];
        if (!file) {
            els.fileTxt.textContent = 'لم يتم اختيار ملف بعد';
            return;
        }
        const err = validateFile(file, 'media');
        if (err) {
            window.showToast?.(err, 'error');
            els.mediaFile.value = '';
            els.fileTxt.textContent = 'لم يتم اختيار ملف بعد';
            return;
        }
        els.fileTxt.innerHTML = `<strong>${file.name}</strong> <span style="color:#86868b">(${formatFileSize(file.size)})</span>`;
    }

    function handleVoiceSelect(e) {
        const file = e.target.files[0];
        if (!file) {
            els.customVoiceTxt.textContent = '';
            return;
        }
        const err = validateFile(file, 'voice');
        if (err) {
            window.showToast?.(err, 'error');
            els.customVoice.value = '';
            els.customVoiceTxt.textContent = '';
            return;
        }
        els.customVoiceTxt.innerHTML = `<strong>${file.name}</strong> <span style="color:#86868b">(${formatFileSize(file.size)})</span>`;
        els.voiceSelect.value = 'custom';
    }

    // =================================
    // UI helpers
    // =================================
    function setProgress(percent, text) {
        els.progFill.style.width = percent + '%';
        if (text) els.statusTxt.textContent = text;
        if (els.miniStatus) els.miniStatus.textContent = text || 'جاري المعالجة...';
    }

    function showProgress() {
        els.progressArea.style.display = 'block';
        els.resultsCard.style.display = 'none';
        els.resultsList.innerHTML = '';
        setProgress(0, 'جاري التحضير...');
        els.dubBtn.disabled = true;
    }

    function hideProgress() {
        els.dubBtn.disabled = false;
    }

    function addResult(langCode, status, url, error) {
        const lang = window.LANGUAGES?.find(l => l.code === langCode);
        const name = lang ? `${lang.flag} ${lang.name_ar}` : langCode;

        const statusClass = status === 'success' ? 'success' : status === 'error' ? 'error' : '';
        const statusText = status === 'success' ? 'تم' : status === 'error' ? 'فشل' : 'قيد المعالجة';

        let actions = '';
        if (status === 'success' && url) {
            actions = `<a href="${url}" download class="btn-download"><i class="fas fa-download"></i> تحميل</a>`;
        } else if (status === 'error') {
            actions = `<span style="color:#ff3b30;font-size:0.78rem">${error || 'حدث خطأ'}</span>`;
        }

        const html = `
            <div class="result-item" data-lang="${langCode}">
                <div class="result-item-header">
                    <span class="result-item-flag">${lang?.flag || '🌐'}</span>
                    <span class="result-item-name">${name}</span>
                    <span class="result-item-status ${statusClass}">${statusText}</span>
                </div>
                <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
                    ${actions}
                </div>
            </div>
        `;

        const existing = els.resultsList.querySelector(`[data-lang="${langCode}"]`);
        if (existing) existing.outerHTML = html;
        else els.resultsList.insertAdjacentHTML('beforeend', html);

        els.resultsCard.style.display = 'block';
    }

    // =================================
    // API calls
    // =================================
    async function startDubbing() {
        const mediaFile = els.mediaFile.files[0];
        const customVoiceFile = els.customVoice.files[0];
        const voiceMode = els.voiceSelect.value;
        const langs = window.selectedLangs ? [...window.selectedLangs] : ['ar'];

        // Validation
        if (!mediaFile) {
            window.showToast?.('يرجى اختيار ملف فيديو أو صوت أولاً', 'warning');
            els.chooseMediaBtn?.focus();
            return;
        }

        if (langs.length === 0) {
            window.showToast?.('يرجى اختيار لغة واحدة على الأقل', 'warning');
            return;
        }

        const token = localStorage.getItem('token');
        if (!token) {
            window.showToast?.('يرجى تسجيل الدخول أولاً', 'warning');
            setTimeout(() => location.href = 'login.html', 1500);
            return;
        }

        showProgress();

        try {
            const formData = new FormData();
            formData.append('media', mediaFile);
            formData.append('languages', JSON.stringify(langs));
            formData.append('voice_mode', voiceMode);

            if (voiceMode === 'custom' && customVoiceFile) {
                formData.append('voice_sample', customVoiceFile);
            }

            setProgress(5, 'جاري رفع الملف...');

            const response = await fetch(`${window.API_BASE}/api/dubbing`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: formData
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                throw new Error(errData.message || `خطأ ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            currentJobId = data.job_id;

            setProgress(15, 'تم الرفع، جاري المعالجة...');

            // Start polling
            startPolling(currentJobId, token);

        } catch (err) {
            console.error('Dubbing error:', err);
            window.showToast?.(err.message || 'فشل بدء الدبلجة', 'error');
            setProgress(0, 'فشلت العملية');
            hideProgress();
        }
    }

    async function startPolling(jobId, token) {
        if (pollInterval) clearInterval(pollInterval);

        pollInterval = setInterval(async () => {
            try {
                const res = await fetch(`${window.API_BASE}/api/dubbing/status/${jobId}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                if (!res.ok) throw new Error('فشل جلب الحالة');

                const data = await res.json();

                // Update progress
                const progress = data.progress || 0;
                setProgress(15 + (progress * 0.8), data.status_text || 'جاري المعالجة...');

                // Update results
                if (data.results) {
                    for (const [langCode, result] of Object.entries(data.results)) {
                        addResult(langCode, result.status, result.url, result.error);
                    }
                }

                // Check completion
                if (data.status === 'completed' || data.status === 'failed') {
                    clearInterval(pollInterval);
                    pollInterval = null;
                    setProgress(100, data.status === 'completed' ? 'اكتملت الدبلجة!' : 'اكتملت مع وجود أخطاء');
                    hideProgress();

                    if (data.status === 'completed') {
                        window.showToast?.('تمت الدبلجة بنجاح!', 'success');
                    }
                }

            } catch (err) {
                console.warn('Polling error:', err);
            }
        }, 3000); // Poll every 3 seconds
    }

    // =================================
    // Event listeners
    // =================================
    function init() {
        // Remove inline onclick from HTML and use addEventListener
        els.chooseMediaBtn?.addEventListener('click', () => els.mediaFile?.click());
        els.chooseCustomVoiceBtn?.addEventListener('click', () => els.customVoice?.click());

        els.mediaFile?.addEventListener('change', handleMediaSelect);
        els.customVoice?.addEventListener('change', handleVoiceSelect);
        els.dubBtn?.addEventListener('click', startDubbing);

        // Add custom option to voice select
        const customOpt = document.createElement('option');
        customOpt.value = 'custom';
        customOpt.textContent = 'عينة صوتية مخصصة';
        els.voiceSelect?.appendChild(customOpt);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
