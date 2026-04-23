// js/tts.js - المحرك المطور لتحويل النص إلى صوت
let selectedLang = 'en';
let selectedVoiceId = 'source'; 

// 🟢 اختيار اللغة وتحديث الألوان
function setLang(code, el) { 
    selectedLang = code;
    document.querySelectorAll('#langGrid .item-card').forEach(x => x.classList.remove('active'));
    if (el) el.classList.add('active');
}

// 🚀 بدء عملية توليد الصوت
async function startTTS() {
    const textInput = document.getElementById('ttsInput');
    const text = textInput.value.trim();
    
    if (!text) return showToast("Please enter some text first!", "#b91c1c");

    const btn = document.getElementById('ttsBtn');
    const statusTxt = document.getElementById('statusTxt');
    const resultArea = document.getElementById('resultArea');
    
    btn.disabled = true;
    if (statusTxt) statusTxt.innerText = "Initializing AI Voice...";
    if (resultArea) resultArea.style.display = 'none'; // إخفاء النتائج السابقة

    try {
        // جلب التوكن من LocalStorage لضمان صلاحية الطلب
        const token = localStorage.getItem('token');

        const res = await fetch(`${API_BASE}/api/tts`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}` // إضافة التوكن للحماية
            },
            body: JSON.stringify({ 
                text: text, 
                lang: selectedLang,
                voice_id: selectedVoiceId 
            })
        });
        
        const data = await res.json();
        
        if (data.success && data.job_id) {
            showToast("AI is processing your text...", "#7c3aed");
            startTTSSSE(data.job_id); 
        } else {
            throw new Error(data.error || "Failed to start TTS");
        }
    } catch(e) {
        showToast(e.message, "#b91c1c");
        btn.disabled = false;
    }
}

// 📡 متابعة حالة المهمة (SSE) بالوقت الحقيقي
function startTTSSSE(jobId) {
    const source = new EventSource(`${API_BASE}/api/progress/${jobId}`);
    const statusTxt = document.getElementById('statusTxt');
    
    source.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (statusTxt) statusTxt.innerText = "Status: " + data.status;

        if (data.status === 'completed') {
            source.close();
            
            // إظهار منطقة النتائج وتعبئة البيانات
            const resultArea = document.getElementById('resultArea');
            const audioResult = document.getElementById('audioResult');
            const transResult = document.getElementById('translatedText');

            if (resultArea) resultArea.style.display = 'block';
            
            if (audioResult) {
                audioResult.src = data.audio_url;
                audioResult.play(); 
            }

            if (transResult && data.extra_data) {
                transResult.innerText = data.extra_data;
            }

            showToast("Your AI Audio is ready!", "#065f2c");
            document.getElementById('ttsBtn').disabled = false;

        } else if (data.status === 'failed') {
            source.close();
            showToast("TTS Generation Failed. Check your credits.", "#b91c1c");
            document.getElementById('ttsBtn').disabled = false;
        }
    };

    source.onerror = () => {
        source.close();
        document.getElementById('ttsBtn').disabled = false;
    };
}
