// js/tts-quick.js — V1.3 (X-User-Id + normalized API base)

async function quickTTS(text, options = {}) {
    // تم تغيير اللغة الافتراضية إلى الإنجليزية لتطابق واجهة الموقع
    const { lang = 'en-us', edge_voice = '', translate = true, rate = '+0%', pitch = '+0Hz' } = options;
    const token = localStorage.getItem('token');
    const headers = { 'Content-Type': 'application/json' };
    
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
        const uid = typeof window.parseJwtSub === 'function' ? window.parseJwtSub(token) : null;
        if (uid) headers['X-User-Id'] = uid;
    }
    if (!text?.trim()) throw new Error('Text is empty');

    const t0 = performance.now();
    
    const base = String(window.API_BASE || 'https://api.glotix.ai').replace(/\/$/, '');
    let apiEndpoint = `${base}/api/tts/quick`;
    apiEndpoint = apiEndpoint.replace(/([^:]\/)\/+/g, "$1");

    let fetchSignal;
    let fetchTimer;
    if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
        fetchSignal = AbortSignal.timeout(30000);
    } else {
        const c = new AbortController();
        fetchTimer = setTimeout(function () { c.abort(); }, 30000);
        fetchSignal = c.signal;
    }

    let response;
    try {
        response = await fetch(apiEndpoint, {
            method: 'POST', 
            headers,
            body: JSON.stringify({ text, lang, edge_voice, translate, rate, pitch }),
            signal: fetchSignal
        });
    } finally {
        if (fetchTimer) clearTimeout(fetchTimer);
    }

    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${response.status}`);
    }

    const ttfb = performance.now() - t0;
    const remainingCredits = parseInt(response.headers.get('X-Remaining-Credits') || '0');

    // تحديث الرصيد في الواجهة فوراً إذا كانت الدالة موجودة (عبر shared.js)
    if (typeof window.checkAuth === 'function') window.checkAuth();

    // إذا كان المتصفح لا يدعم بث MP3 المباشر (مثل بعض متصفحات iOS القديمة)
    if (typeof MediaSource === 'undefined' || !MediaSource.isTypeSupported('audio/mpeg')) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        return { audio: new Audio(url), url, ttfb, totalTime: performance.now() - t0, remainingCredits };
    }

    // تقنية البث المباشر (Real-time Streaming)
    const mediaSource = new MediaSource();
    const audio = new Audio(URL.createObjectURL(mediaSource));

    return new Promise((resolve, reject) => {
        function cleanupAudioObjectUrl() {
            try {
                if (audio && audio.src && audio.src.indexOf('blob:') === 0) {
                    URL.revokeObjectURL(audio.src);
                }
                audio.removeAttribute('src');
                audio.load();
            } catch (_) {}
        }

        mediaSource.addEventListener('error', function () {
            cleanupAudioObjectUrl();
            reject(new Error('Player error'));
        });

        mediaSource.addEventListener('sourceopen', async function () {
            try {
                const sourceBuffer = mediaSource.addSourceBuffer('audio/mpeg');
                const reader = response.body.getReader();

                const pushChunks = async function () {
                    while (true) {
                        const { done, value } = await reader.read();
                        if (done) {
                            if (mediaSource.readyState === 'open' && !sourceBuffer.updating) {
                                mediaSource.endOfStream();
                            }
                            break;
                        }
                        if (sourceBuffer.updating) {
                            await new Promise(function (r) { sourceBuffer.addEventListener('updateend', r, { once: true }); });
                        }
                        if (mediaSource.readyState === 'open') {
                            sourceBuffer.appendBuffer(value);
                        }
                    }
                };

                await pushChunks();

                resolve({
                    audio: audio,
                    url: audio.src, 
                    ttfb: ttfb,
                    totalTime: performance.now() - t0,
                    remainingCredits: remainingCredits
                });

            } catch (e) {
                console.error('TTS stream error:', e);
                cleanupAudioObjectUrl();
                reject(new Error('Streaming processing error'));
            }
        });
    });
}

window.quickTTS = quickTTS;
