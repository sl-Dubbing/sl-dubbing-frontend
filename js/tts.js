// js/tts.js — V2.2 (SVG Flags & Voice Grid Fix)
document.addEventListener('DOMContentLoaded', () => {
    let currentLangCode = 'en-us';
    let selectedVoiceId = null;
    let currentAudio = null;

    // ─── دالة الأعلام الدائرية (SVG) ───
    function getFlagImg(code) {
        let country = code.split('-')[1];
        if (!country) {
            const map = { 'ar':'sa', 'en':'us', 'fr':'fr', 'es':'es', 'pt':'pt', 'de':'de', 'it':'it', 'ru':'ru', 'ja':'jp' };
            country = map[code.split('-')[0]] || 'un';
        }
        return `<img src="https://hatscripts.github.io/circle-flags/flags/${country.toLowerCase()}.svg" style="width:18px; height:18px; border-radius:50%; vertical-align:middle;">`;
    }

    // 1. بناء قائمة اللغات بالأعلام
    const menuEl = document.getElementById('langMenu');
    if (menuEl && window.LANGUAGES) {
        const sorted = [...window.LANGUAGES].sort((a, b) => b.popular - a.popular);
        menuEl.innerHTML = sorted.map(l => `
            <li onclick="window.selectTtsLang('${l.code}', '${l.name_en}')">
                ${getFlagImg(l.code)} <span style="margin-left:10px;">${l.name_en}</span>
            </li>
        `).join('');
    }

    window.selectTtsLang = (code, name) => {
        currentLangCode = code;
        document.getElementById('langSelected').innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px;">
                ${getFlagImg(code)} <span class="name">${name}</span>
            </div>
            <i class="fa-solid fa-chevron-down" style="color: #9ca3af; font-size: 0.8rem;"></i>`;
        document.getElementById('langDropdown').classList.remove('open');
    };

    // 2. التحكم بالقائمة المنسدلة
    document.getElementById('langSelected').onclick = (e) => {
        e.stopPropagation();
        document.getElementById('langDropdown').classList.toggle('open');
    };
    document.addEventListener('click', () => document.getElementById('langDropdown').classList.remove('open'));

    // 3. جلب الأصوات المميزة (آدم وغيره)
    async function loadVoices() {
        const container = document.getElementById('ttsVoicesContainer');
        const supa = window.getSupabase?.();
        if (!supa) return;

        const { data, error } = await supa.from('voices').select('*').order('created_at');
        if (error || !data) { container.innerHTML = "No voices found"; return; }

        container.innerHTML = data.map(v => `
            <div class="voice-avatar-card ${selectedVoiceId === v.id ? 'selected' : ''}" 
                 onclick="window.selectVoice('${v.id}')" 
                 style="cursor:pointer; text-align:center; width:60px;">
                <div style="position:relative;">
                    <img src="${v.avatar_url}" style="width:50px; height:50px; border-radius:50%; border: 2px solid ${selectedVoiceId === v.id ? '#2563eb' : 'transparent'};">
                </div>
                <div style="font-size:0.75rem; font-weight:600; margin-top:5px; color:var(--text-main);">${v.name}</div>
            </div>
        `).join('');
    }

    window.selectVoice = (id) => {
        selectedVoiceId = id;
        loadVoices(); // إعادة التلوين
    };

    loadVoices();

    // 4. التشغيل والتحويل
    const ttsPlayBtn = document.getElementById('ttsPlayBtn');
    ttsPlayBtn.onclick = async () => {
        const text = document.getElementById('ttsInput').value.trim();
        if (!text) return;
        
        const oldHtml = ttsPlayBtn.innerHTML;
        ttsPlayBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i>';
        
        try {
            const result = await window.quickTTS(text, { lang: currentLangCode });
            if (currentAudio) currentAudio.pause();
            currentAudio = result.audio;
            currentAudio.play();
        } catch (e) { console.error(e); }
        finally { ttsPlayBtn.innerHTML = oldHtml; }
    };
});
