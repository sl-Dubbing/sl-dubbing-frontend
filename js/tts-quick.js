const QUICK_API_BASE = 'https://web-production-14a1.up.railway.app';

async function quickTTS(text, options = {}) {
    const { lang = 'ar', edge_voice = '', translate = true, rate = '+0%', pitch = '+0Hz' } = options;
    const token = localStorage.getItem('token');
    const headers = { 'Content-Type': 'application/json' };
    
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (!text?.trim()) throw new Error('النص فارغ');

    const t0 = performance.now();
    const response = await fetch(`${QUICK_API_BASE}/api/tts/quick`, {
        method: 'POST', headers,
        body: JSON.stringify({ text, lang, edge_voice, translate, rate, pitch })
    });

    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${response.status}`);
    }

    const ttfb = performance.now() - t0;
    const remainingCredits = parseInt(response.headers.get('X-Remaining-Credits') || '0');

    // 🛡️ خطة بديلة: إذا كان المتصفح لا يدعم بث MP3 المباشر (مثل أجهزة iOS/Safari)
    if (typeof MediaSource === 'undefined' || !MediaSource.isTypeSupported('audio/mpeg')) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        return { audio: new Audio(url), url, ttfb, totalTime: performance.now() - t0, remainingCredits };
    }

    // 🚀 تقنية البث المباشر (Real-time Streaming)
    const mediaSource = new MediaSource();
    const audio = new Audio(URL.createObjectURL(mediaSource));
    const chunks = []; 

    return new Promise((resolve, reject) => {
        mediaSource.addEventListener('sourceopen', async () => {
            try {
                const sourceBuffer = mediaSource.addSourceBuffer('audio/mpeg');
                const reader = response.body.getReader();
                
                // دالة لجلب القطع الصوتية في الخلفية وتغذية المشغل
                const pushChunks = async () => {
                    while (true) {
                        const { done, value } = await reader.read();
                        if (done) {
                            if (mediaSource.readyState === 'open' && !sourceBuffer.updating) {
                                mediaSource.endOfStream();
                            }
                            break;
                        }
                        
                        chunks.push(value); // نحتفظ بالقطعة لإنشاء ملف التحميل لاحقاً
                        
                        // ننتظر حتى ينتهي التحديث الحالي قبل إضافة قطعة جديدة
                        if (sourceBuffer.updating) {
                            await new Promise(r => sourceBuffer.addEventListener('updateend', r, { once: true }));
                        }
                        
                        if (mediaSource.readyState === 'open') {
                            sourceBuffer.appendBuffer(value);
                        }
                    }
                    // عند انتهاء البث، نقوم بتجميع القطع كملف كامل لزر التحميل
                    return URL.createObjectURL(new Blob(chunks, { type: 'audio/mpeg' }));
                };

                const blobPromise = pushChunks();

                // نرجع النتيجة للواجهة فور بدء البث لتعمل فوراً دون انتظار النهاية
                resolve({
                    audio: audio,
                    url: audio.src, // رابط البث المباشر المؤقت
                    blobPromise: blobPromise, // نرسل الوعد بالملف النهائي لزر التحميل
                    ttfb,
                    totalTime: performance.now() - t0,
                    remainingCredits
                });

            } catch (e) {
                reject(new Error('خطأ في معالجة البث المباشر'));
            }
        });
        
        mediaSource.addEventListener('error', () => reject(new Error('خطأ في المشغل')));
    });
}

window.quickTTS = quickTTS;
