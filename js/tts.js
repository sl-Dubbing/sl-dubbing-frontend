// js/tts.js - المحرك الخاص بتحويل النص إلى صوت (Optimized for Background Processing)
let selectedLang = 'en';
let selectedVoiceId = 'source'; 

// 🟢 اختيار اللغة وتحديث الألوان في الشبكة
function setLang(code, el) { 
    selectedLang = code;
    document.querySelectorAll('#langGrid .item-card').forEach(x => x.classList.remove('active'));
    if (el) el.classList.add('active');
}

// 🟢 اختيار الصوت (اختياري - إذا كنتِ تضعين قائمة أصوات في صفحة الـ TTS)
function setVoice(id, el) {
    selectedVoiceId = id;
    document.querySelectorAll('#spkGrid .item-card').forEach(x => x.classList.remove('active'));
    if (el) el.classList.add('active');
}

// 🚀 بدء عملية توليد الصوت
async function startTTS() {
    const text = document.getElementById('ttsInput').value;
    if (!text) return showToast("Please enter some text first!", "#b91c1c");

    const btn = document.getElementById('ttsBtn');
    const statusTxt = document.getElementById('statusTxt');
    
    btn.disabled = true;
    if (statusTxt) statusTxt.innerText = "Initializing AI Voice...";

    try {
        const res = await fetch(`${API_BASE}/api/tts`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ 
                text: text, 
                lang: selectedLang,
                voice_id: selectedVoiceId 
            }),
            credentials: 'include'
        });
        
        const data = await res.json();
        
        if (data.success && data.job_id) {
            showToast("AI is thinking...", "#7c3aed");
            startTTSSSE(data.job_id); // البدء بمتابعة التقدم
        } else {
            throw new Error(data.error || "Failed to start TTS");
        }
    } catch(e) {
        showToast(e.message);
        btn.disabled = false;
    }
}

// 📡 متابعة حالة المهمة (SSE) لصفحة الـ TTS
function startTTSSSE(jobId) {
    const source = new EventSource(`${API_BASE}/api/progress/${jobId}`, { withCredentials: true });
    
    source.onmessage = (event) => {
        const data = JSON.parse(event.data);
        const statusTxt = document.getElementById('statusTxt');
        
        if (statusTxt) statusTxt.innerText = "Status: " + data.status;

        if (data.status === 'completed' || data.status === 'done') {
            source.close();
            const audioResult = document.getElementById('audioResult');
            if (audioResult) {
                audioResult.src = data.audio_url;
                audioResult.style.display = 'block';
                audioResult.play(); // تشغيل تلقائي عند الجاهزية
            }
            showToast("Your AI Audio is ready!", "#065f2c");
            document.getElementById('ttsBtn').disabled = false;
            
            // إظهار النص المترجم إذا توفر
            const transResult = document.getElementById('translatedText');
            if (transResult && data.extra_data) {
                transResult.innerText = data.extra_data;
                transResult.style.display = 'block';
            }

        } else if (data.status === 'failed' || data.status === 'error') {
            source.close();
            showToast("TTS Generation Failed", "#b91c1c");
            document.getElementById('ttsBtn').disabled = false;
        }
    };

    source.onerror = () => source.close();
}
