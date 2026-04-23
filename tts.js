// tts.js - خاص بتحويل النص إلى صوت
let selectedLang = 'en';

function setLang(code) { selectedLang = code; }

async function startTTS() {
    const text = document.getElementById('ttsInput').value;
    if(!text) return showToast("Enter text first");

    const btn = document.getElementById('ttsBtn');
    btn.disabled = true;

    try {
        const res = await fetch(`${API_BASE}/api/tts`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ text: text, lang: selectedLang }),
            credentials: 'include'
        });
        const data = await res.json();
        if(data.success) {
            document.getElementById('audioResult').src = data.audio_url;
            showToast("TTS Ready!", "#065f2c");
        }
    } catch(e) {
        showToast("TTS Failed");
    } finally {
        btn.disabled = false;
    }
}
