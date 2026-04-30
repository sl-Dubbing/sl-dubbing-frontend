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
    const reader = response.body.getReader();
    const chunks = [];
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
    }
    const totalTime = performance.now() - t0;
    const blob = new Blob(chunks, { type: 'audio/mpeg' });
    const url = URL.createObjectURL(blob);
    return {
        audio: new Audio(url), blob, url, ttfb, totalTime,
        remainingCredits: parseInt(response.headers.get('X-Remaining-Credits') || '0')
    };
}

window.quickTTS = quickTTS;
