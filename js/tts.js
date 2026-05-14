// js/tts.js — V2.6 (Complete Logic)
document.addEventListener('DOMContentLoaded', () => {
    let currentLangCode = 'en-us';
    let selectedVoiceId = null;
    let customVoiceFile = null;
    let currentAudio = null;

    function getFlagImg(code) {
        let country = code.split('-')[1] || 'us';
        return `<img src="https://hatscripts.github.io/circle-flags/flags/${country.toLowerCase()}.svg" style="width:18px; height:18px; border-radius:50%;">`;
    }

    // ─── 1. إدارة اللغات ───
    window.selectTtsLang = (code, name) => {
        currentLangCode = code;
        document.getElementById('currentFlag').innerHTML = getFlagImg(code);
        document.querySelector('#langSelected .name').textContent = name;
        document.getElementById('langDropdown').classList.remove('open');
    };

    if (document.getElementById('langMenu') && window.LANGUAGES) {
        document.getElementById('langMenu').innerHTML = window.LANGUAGES.sort((a,b)=>b.popular-a.popular).map(l => `
            <li onclick="selectTtsLang('${l.code}', '${l.name_en}')">
                ${getFlagImg(l.code)} <span style="margin-left:10px;">${l.name_en}</span>
            </li>
        `).join('');
        selectTtsLang('en-us', 'English (US)');
    }

    // ─── 2. إدارة الأصوات (استنساخ وقاعدة بيانات) ───
    window.triggerVoiceUpload = () => document.getElementById('voiceUploadInput').click();

    document.getElementById('voiceUploadInput').onchange = (e) => {
        const file = e.target.files[0];
        if (file) {
            customVoiceFile = file;
            selectedVoiceId = 'custom_clone';
            document.getElementById('currentVoiceName').textContent = "Custom Voice";
            document.getElementById('cloneLabel').textContent = "Uploaded!";
            document.getElementById('cloneIcon').className = "fa-solid fa-check-circle";
            document.getElementById('cloneIcon').style.color = "var(--accent-blue)";
            
            document.querySelectorAll('.v-avatar-card').forEach(c => c.classList.remove('selected'));
            document.getElementById('cloneCard').classList.add('selected');
            document.getElementById('voicePanel').classList.remove('active');
            window.showToast?.("Voice sample uploaded!", "success");
        }
    };

    async function loadPremiumVoices() {
        const grid = document.getElementById('ttsVoicesGrid');
        const supa = window.getSupabase?.();
        if (!supa || !grid) return;

        const { data } = await supa.from('voices').select('*').order('created_at');
        if (data && data.length > 0) {
            grid.innerHTML = data.map(v => `
                <div class="v-avatar-card ${selectedVoiceId === v.id ? 'selected' : ''}" 
                     onclick="selectTtsVoice('${v.id}', '${v.name}')">
                    <div class="v-img-wrapper"><img src="${v.avatar_url}"></div>
                    <div class="v-name">${v.name}</div>
                </div>
            `).join('');
            
            // اختيار أول صوت افتراضياً إذا لم يتم اختيار شيء
            if(!selectedVoiceId && !customVoiceFile) selectTtsVoice(data[0].id, data[0].name);
        }
    }

    window.selectTtsVoice = (id, name) => {
        selectedVoiceId = id;
        customVoiceFile = null;
        document.getElementById('currentVoiceName').textContent = name;
        document.getElementById('cloneLabel').textContent = "Clone Voice";
        document.getElementById('cloneIcon').className = "fa-solid fa-plus";
        document.getElementById('cloneIcon').style.color = "#6b7280";
        document.getElementById('voicePanel').classList.remove('active');
        loadPremiumVoices(); // تحديث التحديد (Border)
    };

    // التحكم بالقوائم المنسدلة للغات والأصوات
    document.getElementById('langSelected').onclick = (e) => {
        e.stopPropagation();
        document.getElementById('langDropdown').classList.toggle('open');
        document.getElementById('voicePanel').classList.remove('active');
    };
    document.getElementById('voiceToggle').onclick = (e) => {
        e.stopPropagation();
        document.getElementById('voicePanel').classList.toggle('active');
        document.getElementById('langDropdown').classList.remove('open');
    };
    document.addEventListener('click', () => {
        document.getElementById('langDropdown')?.classList.remove('open');
        document.getElementById('voicePanel')?.classList.remove('active');
    });

    loadPremiumVoices();

    // ─── 3. التشغيل وإرسال الطلب للسيرفر ───
    const playBtn = document.getElementById('ttsPlayBtn');
    playBtn.onclick = async () => {
        const text = document.getElementById('ttsInput').value.trim();
        if (!text) return window.showToast?.("Please enter text first", "error");

        const originalHtml = playBtn.innerHTML;
        playBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Processing...';

        try {
            // استدعاء السيرفر (تأكد أن مسار الـ API_BASE في config.js هو https://api.glotix.ai)
            const API = (window.API_BASE || 'https://api.glotix.ai').replace(/\/$/, "");
            const token = localStorage.getItem('token') || '';
            
            const res = await fetch(`${API}/api/tts/quick`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    text: text, 
                    lang: currentLangCode, 
                    voice_id: selectedVoiceId 
                })
            });

            const data = await res.json();
            if (!res.ok || !data.success) throw new Error(data.error || "Server failed to generate audio");

            if (currentAudio) currentAudio.pause();
            currentAudio = new Audio(data.url);
            currentAudio.play();

        } catch (e) {
            window.showToast?.(e.message, "error");
        } finally {
            playBtn.innerHTML = originalHtml;
        }
    };

    // ─── 4. أدوات إضافية (العداد والسرعة) ───
    document.getElementById('ttsInput').oninput = (e) => {
        document.getElementById('charCount').textContent = e.target.value.length;
    };
    document.getElementById('speedSlider').oninput = (e) => {
        const v = e.target.value;
        document.getElementById('speedVal').textContent = v == 0 ? 'Normal' : (v > 0 ? `+${v}%` : `${v}%`);
    };
});
