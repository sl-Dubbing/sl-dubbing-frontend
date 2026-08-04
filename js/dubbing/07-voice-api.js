// # FILE frontend/sl-dubbing-frontend-main/js/dubbing/07-voice-api.js
// # AR واجهة الدبلجة — رفع، Start، polling، أصوات
// # KW صوت,استنساخ
// # CONVENTION — FN/AR/KW + # block كل ~6 أسطر — FUNCTION_INDEX.md DOMAIN_INDEX.md
// dubbing/07-voice-api.js — Load/save voice profiles and clones from API
(function (global) {
  const DubbingApp = global.DubbingApp;
  const S = DubbingApp.state;
  const { normalizeApiBaseUrl, getDubbingApiAuthHeaders } = DubbingApp.api;

  // # FN setExtractedVocalsUrlForVoiceSave
  // # KW صوت,استنساخ,voice,clone,sample,فصل_صوت,demucs,vocals,UVR
  function setExtractedVocalsUrlForVoiceSave(url) {
    const clean = (url || '').trim();
    // # guard — شرط رفض أو خروج مبكر
    if (!clean) return;
    global.lastExtractedVocalsUrl = clean;
    // # شرط — فرع منطقي
    if (!S.pendingVoiceSampleUrl) S.pendingVoiceSampleUrl = clean;
    DubbingApp.voiceHtml.refreshVoiceSavePlusCardInGrid();
  }

  // # FN fetchUserVoiceClonesFromApi
  // # AR الصوت والاستنساخ (fetchUserVoiceClonesFromApi)
  // # KW صوت,استنساخ,voice,clone,sample
  async function fetchUserVoiceClonesFromApi() {
    const headers = getDubbingApiAuthHeaders();
    // # guard — شرط رفض أو خروج مبكر
    if (!headers) return [];
    // # try — معالجة عملية قد تفشل
    try {
      // # HTTP — طلب إلى API
      const res = await fetch(`${normalizeApiBaseUrl()}/api/user/voice-clones`, { headers });
      // # parse — قراءة JSON من الاستجابة
      const data = await res.json().catch(() => ({}));
      // # guard — شرط رفض أو خروج مبكر
      if (!res.ok || !Array.isArray(data.clones)) {
        S.userVoiceClonesCache = [];
        DubbingApp.voiceHtml.refreshVoiceSavePlusCardInGrid();
        // # return — إرجاع النتيجة
        return [];
      }
      S.userVoiceClonesCache = data.clones;
      // # block — معالجة صوت/استنساخ
      DubbingApp.voiceHtml.refreshVoiceSavePlusCardInGrid();
      // # return — إرجاع النتيجة
      return S.userVoiceClonesCache;
    } catch (err) {
      // # return — إرجاع النتيجة
      return [];
    }
  }

  // # FN fetchSavedVoiceProfileFromApi
  // # KW صوت,استنساخ,voice,clone,sample
  async function fetchSavedVoiceProfileFromApi() {
    const headers = getDubbingApiAuthHeaders();
    // # guard — شرط رفض أو خروج مبكر
    if (!headers) return null;
    // # try — معالجة عملية قد تفشل
    try {
      // # HTTP — طلب إلى API
      const res = await fetch(`${normalizeApiBaseUrl()}/api/user/saved-voice`, { headers });
      // # parse — قراءة JSON من الاستجابة
      const data = await res.json().catch(() => ({}));
      // # guard — شرط رفض أو خروج مبكر
      if (!res.ok || !data.saved || !data.sample_url) {
        global.savedVoiceProfile = null;
        DubbingApp.voiceHtml.refreshVoiceSavePlusCardInGrid();
        // # return — إرجاع النتيجة
        return null;
      }
      global.savedVoiceProfile = {
        // # block — معالجة صوت/استنساخ
        sample_url: data.sample_url,
        name: data.name || 'My Voice',
      };
      const opt = document.getElementById('voiceOptSaved');
      // # شرط — فرع منطقي
      if (opt) {
        opt.style.display = 'flex';
        // # block — معالجة صوت/استنساخ
        const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(global.savedVoiceProfile.name)}&background=eff6ff&color=2563eb&size=128`;
        opt.setAttribute('data-avatar-url', avatarUrl);
        opt.setAttribute('data-name', global.savedVoiceProfile.name);
      }
      DubbingApp.voiceHtml.refreshVoiceSavePlusCardInGrid();
      // # return — إرجاع النتيجة
      return global.savedVoiceProfile;
    // # block — معالجة صوت/استنساخ
    } catch (err) {
      // # return — إرجاع النتيجة
      return null;
    }
  }

  // # FN applySavedVoiceProfileSelectionInUi
  // # AR تطبيق saved voice profile selection in ui (applySavedVoiceProfileSelectionInUi)
  // # KW صوت,استنساخ,voice,clone,sample
  function applySavedVoiceProfileSelectionInUi() {
    const profile = global.savedVoiceProfile;
    // # guard — شرط رفض أو خروج مبكر
    if (!profile || !profile.sample_url) return;
    const opt = document.getElementById('voiceOptSaved');
    global.usingSavedVoice = true;
    global.selectedSample = profile.sample_url;
    // # block — معالجة صوت/استنساخ
    global.voiceMode = 'clone';
    // # شرط — فرع منطقي
    if (typeof global.selectVoiceOption === 'function') {
      global.selectVoiceOption('clone', profile.sample_url, opt, '', profile.name || 'My Saved Voice');
    }
  }

  DubbingApp.voice = {
    setExtractedVocalsUrlForVoiceSave,
    fetchUserVoiceClonesFromApi,
    fetchSavedVoiceProfileFromApi,
    applySavedVoiceProfileSelectionInUi,
  };

  global.setExtractedVocalsUrl = setExtractedVocalsUrlForVoiceSave;
  global.loadUserVoiceClones = fetchUserVoiceClonesFromApi;
  global.loadSavedVoiceProfile = fetchSavedVoiceProfileFromApi;
  global.applySavedVoiceSelection = applySavedVoiceProfileSelectionInUi;
})(window);
