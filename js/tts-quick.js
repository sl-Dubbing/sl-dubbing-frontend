// tts-quick.js — استخدام endpoint السريع لتجربة شبيهة بـ ElevenLabs
// يبدأ التشغيل أثناء التوليد (streaming MP3)

const API_BASE = 'https://web-production-14a1.up.railway.app';

/**
 * توليد TTS سريع مع streaming.
 * يبدأ تشغيل الصوت بمجرد وصول أول chunk (~300-500ms).
 * 
 * @param {string} text - النص المراد تحويله
 * @param {object} options - خيارات اختيارية
 * @returns {Promise<{audio: HTMLAudioElement, blob: Blob}>}
 */
async function quickTTS(text, options = {}) {
    const {
        lang = 'ar',
        edge_voice = '',  // مثل "ar-EG-SalmaNeural" أو فارغ للافتراضي
        translate = true,
        rate = '+0%',     // -50% إلى +100%
        pitch = '+0Hz',   // -50Hz إلى +50Hz
    } = options;

    const token = localStorage.getItem('token');
    if (!token) throw new Error('يرجى تسجيل الدخول أولاً');
    if (!text?.trim()) throw new Error('النص فارغ');

    const t0 = performance.now();

    const response = await fetch(`${API_BASE}/api/tts/quick`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text, lang, edge_voice, translate, rate, pitch }),
    });

    if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP ${response.status}`);
    }

    const ttfb = performance.now() - t0;
    console.log(`⚡ TTFB: ${ttfb.toFixed(0)}ms`);

    // قراءة الـ stream
    const reader = response.body.getReader();
    const chunks = [];
    let firstChunkTime = 0;

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!firstChunkTime) {
            firstChunkTime = performance.now() - t0;
            console.log(`🎵 First audio chunk: ${firstChunkTime.toFixed(0)}ms`);
        }
        chunks.push(value);
    }

    const totalTime = performance.now() - t0;
    console.log(`✅ Total: ${totalTime.toFixed(0)}ms`);

    // إنشاء Blob قابل للتشغيل
    const blob = new Blob(chunks, { type: 'audio/mpeg' });
    const audioUrl = URL.createObjectURL(blob);
    const audio = new Audio(audioUrl);

    return {
        audio,
        blob,
        url: audioUrl,
        ttfb,
        totalTime,
        remainingCredits: parseInt(response.headers.get('X-Remaining-Credits') || '0'),
    };
}

/**
 * توليد TTS سريع مع تشغيل فوري (streaming play).
 * يبدأ التشغيل بمجرد وصول أول chunk (مثل ElevenLabs بالضبط).
 */
async function quickTTSPlay(text, options = {}) {
    const token = localStorage.getItem('token');
    if (!token) throw new Error('يرجى تسجيل الدخول أولاً');
    if (!text?.trim()) throw new Error('النص فارغ');

    const t0 = performance.now();

    // ✅ استخدام MediaSource API للتشغيل المباشر أثناء التحميل
    const audio = new Audio();
    const mediaSource = new MediaSource();
    audio.src = URL.createObjectURL(mediaSource);

    mediaSource.addEventListener('sourceopen', async () => {
        const sourceBuffer = mediaSource.addSourceBuffer('audio/mpeg');

        const response = await fetch(`${API_BASE}/api/tts/quick`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                text,
                lang: options.lang || 'ar',
                edge_voice: options.edge_voice || '',
                translate: options.translate ?? true,
                rate: options.rate || '+0%',
                pitch: options.pitch || '+0Hz',
            }),
        });

        if (!response.ok) {
            console.error('TTS failed:', response.status);
            return;
        }

        const reader = response.body.getReader();
        let firstChunk = true;

        while (true) {
            const { done, value } = await reader.read();
            if (done) {
                if (mediaSource.readyState === 'open') {
                    mediaSource.endOfStream();
                }
                break;
            }

            // انتظر حتى يصبح SourceBuffer جاهز
            while (sourceBuffer.updating) {
                await new Promise(r => setTimeout(r, 5));
            }
            sourceBuffer.appendBuffer(value);

            if (firstChunk) {
                firstChunk = false;
                console.log(`🎵 First chunk received: ${(performance.now() - t0).toFixed(0)}ms`);
                audio.play().catch(e => console.warn('Autoplay blocked:', e));
            }
        }
    });

    return audio;
}

// مثال للاستخدام:
// const { audio } = await quickTTS('مرحبا، كيف حالك؟', { lang: 'ar' });
// audio.play();
//
// أو للتشغيل الفوري (Streaming):
// await quickTTSPlay('مرحبا، كيف حالك؟', { lang: 'ar' });

window.quickTTS = quickTTS;
window.quickTTSPlay = quickTTSPlay;
