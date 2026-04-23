// js/dubbing.js - النسخة النهائية المطورة
let selectedVoiceId = 'source';
let selectedLang = 'en';
let customVoiceBase64 = ''; // لتخزين عينة الصوت المنسوخ

// دالة اختيار اللغة
function setLang(code, el) { 
    selectedLang = code;
    document.querySelectorAll('#langGrid .item-card').forEach(x => x.classList.remove('active'));
    el.classList.add('active');
}

// دالة معالجة عينة الصوت المخصص (استنساخ الصوت)
async function handleCustomVoice(input) {
    const file = input.files[0];
    if (!file) return;

    // تحويل الملف إلى Base64 لإرساله للسيرفر
    const reader = new FileReader();
    reader.onload = function(e) {
        customVoiceBase64 = e.target.result.split(',')[1]; // نأخذ الجزء النصي فقط
        selectedVoiceId = 'custom'; // نغير الـ ID ليقوم السيرفر بالتبديل
        showToast("Voice sample uploaded successfully!", "#1e40af");
    };
    reader.readAsDataURL(file);
}

// الدالة الأساسية لبدء الدبلجة
async function startDubbing() {
    const mediaInput = document.getElementById('mediaFile');
    if (!mediaInput.files[0]) return showToast("Please select a file!", "#b91c1c");

    const btn = document.getElementById('dubBtn');
    const progressArea = document.getElementById('progressArea');
    
    btn.disabled = true;
    progressArea.style.display = 'block'; // إظهار منطقة التقدم
    
    const fd = new FormData();
    fd.append('media_file', mediaInput.files[0]);
    fd.append('lang', selectedLang);
    fd.append('voice_id', selectedVoiceId);
    
    // إذا كان هناك صوت مخصص، نرسله
    if (selectedVoiceId === 'custom' && customVoiceBase64) {
        fd.append('sample_b64', customVoiceBase64);
    }

    try {
        // جلب التوكن من LocalStorage (بافتراض أنكِ تخزنينه هناك عند تسجيل الدخول)
        const token = localStorage.getItem('token');

        const res = await fetch(`${API_BASE}/api/dub`, { 
            method: 'POST', 
            body: fd, 
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const data = await res.json();
        if (data.success) {
            startSSE(data.job_id);
        } else {
            showToast(data.error || "Dubbing failed", "#b91c1c");
            btn.disabled = false;
        }
    } catch(e) {
        showToast("Connection Error", "#b91c1c");
        btn.disabled = false;
    }
}

// دالة الـ SSE لمتابعة التقدم بالوقت الحقيقي
function startSSE(jobId) {
    const statusTxt = document.getElementById('statusTxt');
    const progFill = document.getElementById('progFill');
    const resCard = document.getElementById('resCard');
    
    // استخدام EventSource للاستماع للسيرفر
    const source = new EventSource(`${API_BASE}/api/progress/${jobId}`);
    
    source.onmessage = (event) => {
        const data = JSON.parse(event.data);
        statusTxt.innerText = "Status: " + data.status;

        // تحديث شريط التقدم وهمياً بناءً على الحالة
        if (data.status === 'processing') progFill.style.width = "50%";
        
        if (data.status === 'completed') {
            progFill.style.width = "100%";
            document.getElementById('dubAud').src = data.audio_url;
            resCard.style.display = 'block';
            
            showToast("Success!", "#065f2c");
            source.close();
            document.getElementById('dubBtn').disabled = false;
        }

        if (data.status === 'failed') {
            showToast("Processing failed. Credits refunded.", "#b91c1c");
            source.close();
            document.getElementById('dubBtn').disabled = false;
        }
    };

    source.onerror = () => {
        source.close();
        document.getElementById('dubBtn').disabled = false;
    };
}
