// js/tts.js — V2.3 (Full Sync with Dubbing Style)
document.addEventListener('DOMContentLoaded', () => {
    let currentLangCode = 'en-us';
    let selectedVoiceId = null;
    let currentAudio = null;

    function getFlagImg(code) {
        let country = code.split('-')[1];
        if (!country) {
            const map = { 'ar':'sa', 'en':'us', 'fr':'fr', 'es':'es', 'pt':'pt', 'de':'de', 'it':'it', 'ru':'ru', 'ja':'jp' };
            country = map[code.split('-')[0]] || 'un';
        }
        return `<img src="https://hatscripts.github.io/circle-flags/flags/${country.toLowerCase()}.svg" style="width:18px; height:18px; border-radius:50%;">`;
    }

    // 1. القائمة المنسدلة للغات
    const langToggle = document.getElementById('langSelected');
    const langMenu = document.getElementById('langMenu');
    if (langToggle) {
        langToggle.onclick = (e) => { e.stopPropagation(); document.getElementById('langDropdown').classList.toggle('open'); };
        if (window.LANGUAGES) {
            langMenu.innerHTML = window.LANGUAGES.sort((a,b)=>b.popular-a.popular).map(l => `
                <li onclick="selectTtsLang('${l.code}', '${l.name_en}')">${getFlagImg(l.code)} <span style="margin-left:10px;">${l.name_en}</span></li>
            `).join('');
        }
    }
    window.selectTtsLang = (code, name) => {
        currentLangCode = code;
        document.getElementById('currentFlagImg').innerHTML = getFlagImg(code);
        document.querySelector('#langSelected .name').textContent = name;
        document.getElementById('langDropdown').classList.remove('open');
    };

    // 2. القائمة المنسدلة للأصوات (Premium Voices)
    const voiceToggle = document.getElementById('voiceToggle');
    const voicePanel = document.getElementById('voicePanel');
    if (voiceToggle) {
        voiceToggle.onclick = (e) => { e.stopPropagation(); voicePanel.classList.toggle('active'); };
    }
    document.addEventListener('click', () => { 
        voicePanel?.classList.remove('active'); 
        document.getElementById('langDropdown')?.classList.remove('open');
    });

    async function loadPremiumVoices() {
        const grid = document.getElementById('ttsVoicesGrid');
        const supa = window.getSupabase?.();
        if (!supa) return;

        const { data, error } = await supa.from('voices').select('*').order('created_at');
        if (error || !data) return;

        grid.innerHTML = data.map(v => `
            <div class="v-avatar-card ${selectedVoiceId === v.id ? 'selected' : ''}" onclick="window.selectTtsVoice('${v.id}', '${v.name}')">
                <div class="v-img-wrapper">
                    <img src="${v.avatar_url}" alt="${v.name}">
                </div>
                <div class="v-name">${v.name}</div>
            </div>
        `).join('');
    }

    window.selectTtsVoice = (id, name) => {
        selectedVoiceId = id;
        document.getElementById('currentVoiceName').textContent = name;
        voicePanel.classList.remove('active');
        loadPremiumVoices(); // إعادة تحميل لتحديث التحديد (border)
    };

    loadPremiumVoices();

    // 3. تحويل النص لصوت
    const playBtn = document.getElementById('ttsPlayBtn');
    if (playBtn) {
        playBtn.onclick = async () => {
            const text = document.getElementById('ttsInput').value.trim();
            if (!text) return window.showToast?.("Please enter text", "error");

            const originalHtml = playBtn.innerHTML;
            playBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i>';

            try {
                // إرسال الطلب للمحرك
                const result = await window.quickTTS(text, { lang: currentLangCode });
                if (currentAudio) currentAudio.pause();
                currentAudio = result.audio;
                currentAudio.play();
            } catch (e) {
                window.showToast?.(e.message, "error");
            } finally {
                playBtn.innerHTML = originalHtml;
            }
        };
    }

    // عداد الحروف والسرعة
    document.getElementById('ttsInput').oninput = (e) => document.getElementById('charCount').textContent = e.target.value.length;
    document.getElementById('speedSlider').oninput = (e) => document.getElementById('speedVal').textContent = e.target.value == 0 ? 'Normal' : (e.target.value > 0 ? `+${e.target.value}%` : `${e.target.value}%`);
});
