// stt.js — منطق تحويل الصوت لنص (Speech-to-Text)
(function() {
    'use strict';

    const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB
    const ALLOWED_TYPES = ['audio/', 'video/'];
    const ALLOWED_EXTS = ['mp3', 'wav', 'mp4', 'm4a', 'ogg', 'webm', 'flac', 'aac'];

    const els = {
        mediaFile: document.getElementById('mediaFile'),
        fileTxt: document.getElementById('fileTxt'),
        chooseMediaBtn: document.getElementById('chooseMediaBtn'),
        sttBtn: document.getElementById('sttBtn'),
        progressArea: document.getElementById('progressArea'),
        statusTxt: document.getElementById('statusTxt'),
        progFill: document.getElementById('progFill'),
        resultsCard: document.getElementById('resultsCard'),
        resultText: document.getElementById('resultText'),
        copyBtn: document.getElementById('copyBtn'),
        downloadBtn: document.getElementById('downloadBtn'),
        speakerDiarization: document.getElementById('speakerDiarization'),
        autoPunctuation: document.getElementById('autoPunctuation'),
        outputFormat: document.getElementById('outputFormat'),
        miniStatus: document.getElementById('miniStatus')
    };

    let currentJobId = null;
    let pollInterval = null;
    let currentResult = '';

    // =================================
    // Validation helpers
    // =================================
    function validateFile(file) {
        if (!file) return 'لم يتم اختيار ملف';
        if (file.size > MAX_FILE_SIZE) return `الملف كبير جداً (الحد الأقصى ${MAX_FILE_SIZE/1024/1024}MB)`;

        const ext = file.name.split('.').pop().toLowerCase();
        const isValidType = ALLOWED_TYPES.some(t => file.type.startsWith(t));
        const isValidExt = ALLOWED_EXTS.includes(ext);

        if (!isValidType && !isValidExt) {
            return 'يجب اختيار ملف صوتي أو فيديو (MP3, WAV, MP4, M4A, OGG, WEBM)';
        }
        return null;
    }

    function formatFileSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024*1024) return (bytes/1024).toFixed(1) + ' KB';
        return (bytes/1024/1024).toFixed(1) + ' MB';
    }

    // =================================
    // File handler
    // =================================
    function handleMediaSelect(e) {
        const file = e.target.files[0];
        if (!file) {
            els.fileTxt.textContent = 'لم يتم اختيار ملف بعد (الحد الأقصى 500MB)';
            return;
        }
        const err = validateFile(file);
        if (err) {
            window.showToast?.(err, 'error');
            els.mediaFile.value = '';
            els.fileTxt.textContent = 'لم يتم اختيار ملف بعد (الحد الأقصى 500MB)';
            return;
        }
        els.fileTxt.innerHTML = `<strong>${file.name}</strong> <span style="color:#86868b">(${formatFileSize(file.size)})</span>`;
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
        els.resultText.textContent = '';
        setProgress(0, 'جاري التحضير...');
        els.sttBtn.disabled = true;
    }

    function hideProgress() {
        els.sttBtn.disabled = false;
    }

    function showResult(text, format) {
        currentResult = text;
        els.resultText.textContent = text;
        els.resultsCard.style.display = 'block';

        // Create download blob
        let blob, filename;
        const timestamp = new Date().toISOString().slice(0,19).replace(/[:T]/g,'-');

        if (format === 'srt') {
            blob = new Blob([text], { type: 'text/srt' });
            filename = `transcript-${timestamp}.srt`;
        } else if (format === 'vtt') {
            blob = new Blob([text], { type: 'text/vtt' });
            filename = `transcript-${timestamp}.vtt`;
        } else if (format === 'json') {
            blob = new Blob([text], { type: 'application/json' });
            filename = `transcript-${timestamp}.json`;
        } else {
            blob = new Blob([text], { type: 'text/plain' });
            filename = `transcript-${timestamp}.txt`;
        }

        const url = URL.createObjectURL(blob);
        els.downloadBtn.href = url;
        els.downloadBtn.download = filename;
        els.downloadBtn.style.display = 'inline-flex';
    }

    // =================================
    // API calls
    // =================================
    async function startSTT() {
        const mediaFile = els.mediaFile.files[0];
        const langs = window.selectedLangs ? [...window.selectedLangs] : ['ar'];
        const lang = langs[0] || 'ar';
        const speakerDiarization = els.speakerDiarization?.checked || false;
        const autoPunctuation = els.autoPunctuation?.checked !== false;
        const outputFormat = els.outputFormat?.value || 'txt';

        // Validation
        if (!mediaFile) {
            window.showToast?.('يرجى اختيار ملف صوتي أو فيديو أولاً', 'warning');
            els.chooseMediaBtn?.focus();
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
            formData.append('language', lang);
            formData.append('speaker_diarization', speakerDiarization);
            formData.append('auto_punctuation', autoPunctuation);
            formData.append('output_format', outputFormat);

            setProgress(5, 'جاري رفع الملف...');

            const response = await fetch(`${window.API_BASE}/api/stt`, {
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

            setProgress(15, 'تم الرفع، جاري التحويل...');

            // Start polling
            startPolling(currentJobId, token, outputFormat);

        } catch (err) {
            console.error('STT error:', err);
            window.showToast?.(err.message || 'فشل بدء التحويل', 'error');
            setProgress(0, 'فشلت العملية');
            hideProgress();
        }
    }

    async function startPolling(jobId, token, outputFormat) {
        if (pollInterval) clearInterval(pollInterval);

        pollInterval = setInterval(async () => {
            try {
                const res = await fetch(`${window.API_BASE}/api/stt/status/${jobId}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                if (!res.ok) throw new Error('فشل جلب الحالة');

                const data = await res.json();

                // Update progress
                const progress = data.progress || 0;
                setProgress(15 + (progress * 0.8), data.status_text || 'جاري التحويل...');

                // Check completion
                if (data.status === 'completed') {
                    clearInterval(pollInterval);
                    pollInterval = null;
                    setProgress(100, 'اكتمل التحويل!');
                    hideProgress();

                    if (data.result) {
                        showResult(data.result, outputFormat);
                        window.showToast?.('تم التحويل بنجاح!', 'success');
                    }
                } else if (data.status === 'failed') {
                    clearInterval(pollInterval);
                    pollInterval = null;
                    setProgress(0, 'فشل التحويل');
                    hideProgress();
                    window.showToast?.(data.error || 'فشل التحويل', 'error');
                }

            } catch (err) {
                console.warn('Polling error:', err);
            }
        }, 3000);
    }

    // =================================
    // Event listeners
    // =================================
    function init() {
        els.chooseMediaBtn?.addEventListener('click', () => els.mediaFile?.click());
        els.mediaFile?.addEventListener('change', handleMediaSelect);
        els.sttBtn?.addEventListener('click', startSTT);

        els.copyBtn?.addEventListener('click', () => {
            if (!currentResult) return;
            navigator.clipboard.writeText(currentResult).then(() => {
                window.showToast?.('تم النسخ!', 'success');
            }).catch(() => {
                window.showToast?.('فشل النسخ', 'error');
            });
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
