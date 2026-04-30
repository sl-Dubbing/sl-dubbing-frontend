// tts-quick.js — V2.1: Fast streaming logic for instant playback
// يضمن هذا الملف تجربة مستخدم سريعة جداً (توليد في أقل من 500ms)

const API_BASE = 'https://web-production-14a1.up.railway.app';

/**
 * توليد TTS سريع مع streaming.
 * يبدأ تشغيل الصوت بمجرد وصول أول chunk (~300-500ms).
 */
async function quickTTS(text, options = {}) {
    const {
        lang = 'ar',
        edge_voice = '',  
        translate = true,
        rate = '+0%',     
        pitch = '+0Hz',   
    } = options;

    const token = localStorage.getItem('token');
    // إذا لم يوجد توكن، قد يحاول السيرفر استخدام الكوكي إذا كانت مفعلة
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    if (!text?.trim()) throw new Error('النص فارغ');

    const t0 = performance.now();

    const response = await fetch(`${API_BASE}/api/tts/quick`, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({ text, lang, edge_voice, translate, rate, pitch }),
    });

    if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP ${response.status}`);
    }

    const ttfb = performance.now() - t0;
    console.log(`⚡ TTFB: ${ttfb.toFixed(0)}ms`);

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
    console.log(`✅ Total Generation: ${totalTime.toFixed(0)}ms`);

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
 * توليد TTS سريع مع تشغيل فوري (Streaming Play).
 * يستخدم MediaSource للبدء في سماع الصوت قبل اكتمال تحميل الملف بالكامل.
 */
async function quickTTSPlay(text, options = {}) {
    const token = localStorage.getItem('token');
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    if (!text?.trim()) throw new Error('النص فارغ');

    const t0 = performance.now();
    const audio = new Audio();
    const mediaSource = new MediaSource();
    audio.src = URL.createObjectURL(mediaSource);

    mediaSource.addEventListener('sourceopen', async () => {
        const sourceBuffer = mediaSource.addSourceBuffer('audio/mpeg');

        const response = await fetch(`${API_BASE}/api/tts/quick`, {
            method: 'POST',
            headers: headers,
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
            console.error('TTS Streaming failed:', response.status);
            if(mediaSource.readyState === 'open') mediaSource.endOfStream();
            return;
        }

        const reader = response.body.getReader();
        let firstChunk = true;

        while (true) {
            const { done, value } = await reader.read();
            if (done) {
                if (mediaSource.readyState === 'open') mediaSource.endOfStream();
                break;
            }

            while (sourceBuffer.updating) {
                await new Promise(r => setTimeout(r, 5));
            }
            sourceBuffer.appendBuffer(value);

            if (firstChunk) {
                firstChunk = false;
                console.log(`🎵 Streaming started at: ${(performance.now() - t0).toFixed(0)}ms`);
                audio.play().catch(e => console.warn('Autoplay prevented. User interaction required.'));
            }
        }
    });

    return audio;
}

// تصدير الوظائف للنافذة العالمية
window.quickTTS = quickTTS;
window.quickTTSPlay = quickTTSPlay;
