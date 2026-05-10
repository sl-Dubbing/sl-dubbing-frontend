// js/tts-quick.js — V1.2 (Centralized API Base, Streaming & UI Aligned)

async function quickTTS(text, options = {}) {
    // تم تغيير اللغة الافتراضية إلى الإنجليزية لتطابق واجهة الموقع
    const { lang = 'en-us', edge_voice = '', translate = true, rate = '+0%', pitch = '+0Hz' } = options;
    const token = localStorage.getItem('token');
    const headers = { 'Content-Type': 'application/json' };
    
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (!text?.trim()) throw new Error('Text is empty');

    const t0 = performance.now();
    
    // بناء رابط الـ API بذكاء لمنع مشكلة تكرار علامة السلاش (//)
    let apiEndpoint = `${window.API_BASE}/api/tts/quick`;
    apiEndpoint = apiEndpoint.replace(/([^:]\/)\/+/g, "$1"); // تنظيف الرابط

    const response = await fetch(apiEndpoint, {
        method: 'POST', 
        headers,
        body: JSON.stringify({ text, lang, edge_voice, translate, rate, pitch })
    });

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
    const chunks = []; 

    return new Promise((resolve, reject) => {
        mediaSource.addEventListener('sourceopen', async () => {
            try {
                const sourceBuffer = mediaSource.addSourceBuffer('audio/mpeg');
                const reader = response.body.getReader();
                
                const pushChunks = async () => {
                    while (true) {
                        const { done, value } = await reader.read();
                        if (done) {
                            if (mediaSource.readyState === 'open' && !sourceBuffer.updating) {
                                mediaSource.endOfStream();
                            }
                            break;
                        }
                        chunks.push(value); 
                        if (sourceBuffer.updating) {
                            await new Promise(r => sourceBuffer.addEventListener('updateend', r, { once: true }));
                        }
                        if (mediaSource.readyState === 'open') {
                            sourceBuffer.appendBuffer(value);
                        }
                    }
                    return URL.createObjectURL(new Blob(chunks, { type: 'audio/mpeg' }));
                };

                const blobPromise = pushChunks();

                resolve({
                    audio: audio,
                    url: audio.src, 
                    blobPromise: blobPromise, 
                    ttfb,
                    totalTime: performance.now() - t0,
                    remainingCredits
                });

            } catch (e) { reject(new Error('Streaming processing error')); }
        });
        mediaSource.addEventListener('error', () => reject(new Error('Player error')));
    });
}

window.quickTTS = quickTTS;
