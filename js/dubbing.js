// js/dubbing.js - خاص باستوديو الدبلجة
let selectedVoiceId = 'source';
let selectedLang = 'en';

function setLang(code, el) { 
    selectedLang = code;
    document.querySelectorAll('#langGrid .item-card').forEach(x => x.classList.remove('active'));
    el.classList.add('active');
}

async function startDubbing() {
    const mediaInput = document.getElementById('mediaFile');
    if (!mediaInput.files[0]) return showToast("Please select a file!", "#b91c1c");

    const btn = document.getElementById('dubBtn');
    btn.disabled = true;
    
    const fd = new FormData();
    fd.append('media_file', mediaInput.files[0]);
    fd.append('lang', selectedLang);
    fd.append('voice_id', selectedVoiceId);

    try {
        const res = await fetch(`${API_BASE}/api/dub`, { 
            method: 'POST', 
            body: fd, 
            credentials: 'include' 
        });
        const data = await res.json();
        if (data.success) {
            startSSE(data.job_id); // دالة الاستماع للتقدم
        }
    } catch(e) {
        showToast("Connection Error");
        btn.disabled = false;
    }
}

// دالة الـ SSE لمتابعة التقدم (توضع هنا أيضاً)
function startSSE(jobId) {
    const source = new EventSource(`${API_BASE}/api/progress/${jobId}`, { withCredentials: true });
    source.onmessage = (event) => {
        const data = JSON.parse(event.data);
        document.getElementById('statusTxt').innerText = "Status: " + data.status;
        if (data.status === 'completed') {
            document.getElementById('dubAud').src = data.audio_url;
            showToast("Success!", "#065f2c");
            source.close();
            document.getElementById('dubBtn').disabled = false;
        }
    };
}
