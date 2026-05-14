// js/tts.js — V2.4 (Fix Selection & Voice Upload)
document.addEventListener('DOMContentLoaded', () => {
    // القيم الافتراضية
    let currentLangCode = 'en-us';
    let selectedVoiceId = null;
    let customVoiceFile = null;
    let currentAudio = null;

    function getFlagImg(code) {
        let country = code.split('-')[1] || 'us';
        return `<img src="https://hatscripts.github.io/circle-flags/flags/${country.toLowerCase()}.svg" style="width:18px; height:18px; border-radius:50%;">`;
    }

    // ─── 1. إصلاح اختيار اللغة وتفعيلها عند البدء ───
    window.selectTtsLang = (code, name) => {
        currentLangCode = code;
        const flagContainer = document.getElementById('currentFlag');
        const nameContainer = document.querySelector('#langSelected .name');
        
        if(flagContainer) flagContainer.innerHTML = getFlagImg(code);
        if(nameContainer) nameContainer.textContent = name;
        
        document.getElementById('langDropdown').classList.remove('open');
        console.log("Selected Language:", currentLangCode);
    };

    // تعبئة القائمة باللغات عند التحميل
    const langMenu = document.getElementById('langMenu');
    if (langMenu && window.LANGUAGES) {
        langMenu.innerHTML = window.LANGUAGES.sort((a,b)=>b.popular-a.popular).map(l => `
            <li onclick="selectTtsLang('${l.code}', '${l.name_en}')">
                ${getFlagImg(l.code)} <span style="margin-left:10px;">${l.name_en}</span>
            </li>
        `).join('');
        
        // تفعيل اللغة الافتراضية (English US)
        selectTtsLang('en-us', 'English (US)');
    }

    // ─── 2. نظام رفع عينة صوتية مخصصة ───
    const voiceInput = document.getElementById('voiceUploadInput');
    window.triggerVoiceUpload = () => voiceInput.click();

    voiceInput.onchange = (e) => {
        const file = e.target.files[0];
        if (file) {
            customVoiceFile = file;
            selectedVoiceId = 'custom_clone';
            document.getElementById('currentVoiceName').textContent = "Custom Voice";
            document.getElementById('cloneStatus').textContent = "Uploaded!";
            document.getElementById('cloneOption').classList.add('selected');
            document.getElementById('voicePanel').classList.remove('active');
            window.showToast?.("Voice sample uploaded successfully", "success");
        }
    };

    // ─── 3. جلب الأصوات المميزة ───
    async function loadPremiumVoices() {
        const grid = document.getElementById('ttsVoicesGrid');
        const supa = window.getSupabase?.();
        if (!supa || !grid) return;

        const { data } = await supa.from('voices').select('*').order('created_at');
        if (data) {
            grid.innerHTML = data.map(v => `
                <div class="v-avatar-card ${selectedVoiceId === v.id ? 'selected' : ''}" onclick="selectTtsVoice('${v.id}', '${v.name}')">
                    <div class="v-img-wrapper"><img src="${v.avatar_url}"></div>
                    <div class="v-name">${v.name}</div>
                </div>
            `).join('');
        }
    }

    window.selectTtsVoice = (id, name) => {
        selectedVoiceId = id;
        customVoiceFile = null; // إلغاء العينة المرفوعة إذا اختار صوتاً جاهزاً
        document.getElementById('currentVoiceName').textContent = name;
        document.getElementById('cloneOption').classList.remove('selected');
        document.getElementById('cloneStatus').textContent = "Voice Clone";
        document.getElementById('voicePanel').classList.remove('active');
        loadPremiumVoices();
    };

    // ─── 4. التحكم في القوائم المنسدلة ───
    document.getElementById('langSelected').onclick = (e) => {
        e.stopPropagation();
        document.getElementById('langDropdown').classList.toggle('open');
    };
    document.getElementById('voiceToggle').onclick = (e) => {
        e.stopPropagation();
        document.getElementById('voicePanel').classList.toggle('active');
    };
    document.addEventListener('click', () => {
        document.getElementById('langDropdown')?.classList.remove('open');
        document.getElementById('voicePanel')?.classList.remove('active');
    });

    loadPremiumVoices();

    // ─── 5. تشغيل الـ TTS ───
    const playBtn = document.getElementById('ttsPlayBtn');
    playBtn.onclick = async () => {
        const text = document.getElementById('ttsInput').value.trim();
        if (!text) return window.showToast?.("Please enter some text", "error");

        const originalHtml = playBtn.innerHTML;
        playBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Generating...';

        try {
            // هنا يتم إرسال الطلب لمحرك الذكاء الاصطناعي
            const result = await window.quickTTS(text, { 
                lang: currentLangCode,
                voice_id: selectedVoiceId,
                file: customVoiceFile // نرسل الملف المرفوع إذا وُجد
            });

            if (currentAudio) currentAudio.pause();
            currentAudio = result.audio;
            currentAudio.play();
        } catch (e) {
            window.showToast?.(e.message, "error");
        } finally {
            playBtn.innerHTML = originalHtml;
        }
    };
});
