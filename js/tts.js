// js/tts.js — V2.7 (X-User-Id for /api/tts/quick)

function createTtsFlagImg(code) {
    let country = code.split('-')[1] || 'us';
    const img = document.createElement('img');
    img.src = 'https://hatscripts.github.io/circle-flags/flags/' + country.toLowerCase() + '.svg';
    img.style.width = '18px';
    img.style.height = '18px';
    img.style.borderRadius = '50%';
    img.alt = '';
    return img;
}

document.addEventListener('DOMContentLoaded', () => {
    let currentLangCode = 'en-us';
    let selectedVoiceId = null;
    let customVoiceFile = null;
    let currentAudio = null;

    function disposeCurrentAudio() {
        if (!currentAudio) return;
        try {
            currentAudio.pause();
        } catch (_) {}
        const src = currentAudio.src;
        if (src && src.indexOf('blob:') === 0) {
            try { URL.revokeObjectURL(src); } catch (_) {}
        }
        currentAudio.removeAttribute('src');
        try { currentAudio.load(); } catch (_) {}
        currentAudio = null;
    }

    // ─── 1. إدارة اللغات ───
    window.selectTtsLang = (code, name) => {
        currentLangCode = code;
        const flagHost = document.getElementById('currentFlag');
        if (flagHost) {
            flagHost.replaceChildren();
            flagHost.appendChild(createTtsFlagImg(code));
        }
        document.querySelector('#langSelected .name').textContent = name;
        document.getElementById('langDropdown').classList.remove('open');
    };

    const langMenuEl = document.getElementById('langMenu');
    if (langMenuEl && window.LANGUAGES) {
        langMenuEl.replaceChildren();
        [...window.LANGUAGES].sort((a, b) => b.popular - a.popular).forEach((l) => {
            const li = document.createElement('li');
            li.appendChild(createTtsFlagImg(l.code));
            const span = document.createElement('span');
            span.style.marginLeft = '10px';
            span.textContent = l.name_en;
            li.appendChild(span);
            li.addEventListener('click', () => window.selectTtsLang(l.code, l.name_en));
            langMenuEl.appendChild(li);
        });
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

        let data = null;
        let error = null;
        try {
            const res = await supa.from('voices').select('*').order('created_at');
            data = res.data;
            error = res.error;
        } catch (err) {
            console.error('[tts] voices query threw', err);
            window.showToast?.(err && err.message ? err.message : 'Could not load voices', 'error');
            return;
        }

        if (error) {
            console.error('[tts] voices query failed', error);
            window.showToast?.(error.message || 'Could not load voices', 'error');
            return;
        }

        if (data && data.length > 0) {
            grid.replaceChildren();
            data.forEach((v) => {
                const card = document.createElement('div');
                card.className = 'v-avatar-card' + (selectedVoiceId === v.id ? ' selected' : '');
                card.addEventListener('click', () => window.selectTtsVoice(v.id, v.name));

                const wrap = document.createElement('div');
                wrap.className = 'v-img-wrapper';
                const img = document.createElement('img');
                img.alt = '';
                img.src = v.avatar_url || '';
                wrap.appendChild(img);
                card.appendChild(wrap);

                const nameEl = document.createElement('div');
                nameEl.className = 'v-name';
                nameEl.textContent = v.name != null ? String(v.name) : '';
                card.appendChild(nameEl);

                grid.appendChild(card);
            });

            // اختيار أول صوت افتراضياً إذا لم يتم اختيار شيء
            if (!selectedVoiceId && !customVoiceFile) selectTtsVoice(data[0].id, data[0].name);
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
    document.addEventListener('click', (e) => {
        const langDd = document.getElementById('langDropdown');
        const voicePanel = document.getElementById('voicePanel');
        const langSelected = document.getElementById('langSelected');
        const voiceToggle = document.getElementById('voiceToggle');
        if (langDd && !langDd.contains(e.target) && !(langSelected && langSelected.contains(e.target))) {
            langDd.classList.remove('open');
        }
        if (voicePanel && !voicePanel.contains(e.target) && !(voiceToggle && voiceToggle.contains(e.target))) {
            voicePanel.classList.remove('active');
        }
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
            const API = (window.API_BASE || 'https://api.glotix.ai').replace(/\/$/, "").replace(/([^:]\/)\/+/g, "$1");
            const token = localStorage.getItem('token') || '';
            const userId = typeof window.parseJwtSub === 'function' ? window.parseJwtSub(token) : null;
            const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };
            if (userId) headers['X-User-Id'] = userId;

            const res = await fetch(`${API}/api/tts/quick`, {
                method: 'POST',
                headers,
                body: JSON.stringify({ 
                    text: text, 
                    lang: currentLangCode, 
                    voice_id: selectedVoiceId 
                })
            });

            const data = await res.json();
            if (!res.ok || !data.success) throw new Error(data.error || "Server failed to generate audio");

            disposeCurrentAudio();
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
