// # FILE frontend/sl-dubbing-frontend-main/js/dubbing/06-voice-html.js
// # AR واجهة الدبلجة — رفع، Start، polling، أصوات
// # KW صوت,استنساخ
// # CONVENTION — FN/AR/KW + # block كل ~6 أسطر — FUNCTION_INDEX.md DOMAIN_INDEX.md
// dubbing/06-voice-html.js — Voice picker cards HTML and grid rendering
(function (global) {
  const DubbingApp = global.DubbingApp;
  const S = DubbingApp.state;

  // # FN escapeHtmlForVoiceCardLabels
  // # AR الصوت والاستنساخ (escapeHtmlForVoiceCardLabels)
  // # KW صوت,استنساخ,voice,clone,sample
  function escapeHtmlForVoiceCardLabels(value) {
    // # return — إرجاع النتيجة
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // # FN buildLanguageFlagImgHtml
  // # KW صوت,استنساخ,voice,clone,sample,لغة,language,dialect
  function buildLanguageFlagImgHtml(langCode) {
    let country = langCode.split('-')[1];
    // # شرط — فرع منطقي
    if (!country) {
      const map = global.LANG_FLAG_COUNTRY || {
        ar: 'sa', en: 'us', fr: 'fr', es: 'es', pt: 'pt', zh: 'cn',
        de: 'de', it: 'it', ru: 'ru', ja: 'jp', ko: 'kr', tr: 'tr',
        // # block — معالجة أخطاء
        hi: 'in', nl: 'nl', pl: 'pl', sv: 'se', id: 'id',
        bg: 'bg', hr: 'hr', cs: 'cz', da: 'dk', fil: 'ph', fi: 'fi',
        el: 'gr', hu: 'hu', ms: 'my', no: 'no', ro: 'ro', sk: 'sk',
        ta: 'in', uk: 'ua', vi: 'vn',
      };
      country = map[langCode.split('-')[0]] || 'un';
    // # block — معالجة أخطاء
    }
    return (
      `<span class="lang-flag-shell" style="--flag-size:18px">` +
      `<img class="lang-flag" src="https://hatscripts.github.io/circle-flags/flags/${country.toLowerCase()}.svg" alt="flag"></span>`
    );
  }

  // # FN buildSavedUserVoiceCardHtmlFragment
  // # AR الصوت والاستنساخ (buildSavedUserVoiceCardHtmlFragment)
  // # KW صوت,استنساخ,voice,clone,sample
  function buildSavedUserVoiceCardHtmlFragment() {
    const profile = global.savedVoiceProfile;
    // # guard — شرط رفض أو خروج مبكر
    if (!profile || !profile.sample_url) return '';
    const name = escapeHtmlForVoiceCardLabels(profile.name || 'My Voice');
    const url = escapeHtmlForVoiceCardLabels(profile.sample_url);
    const avatarUrl = escapeHtmlForVoiceCardLabels(
      // # block — معالجة صوت/استنساخ
      `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.name || 'My Voice')}&background=eff6ff&color=2563eb&size=128`,
    );
    const selected = global.selectedSample === profile.sample_url ? ' selected' : '';
    // # return — إرجاع النتيجة
    return `
        <div class="voice-avatar-card voice-saved-user-card${selected}" data-sample-url="${url}" data-name="${name}" data-engine="" data-avatar-url="${avatarUrl}"
             onclick="onPremiumVoiceCardClick(this)" title="Your saved voice — instant dubbing">
            <div class="voice-avatar-wrapper">
                <div class="voice-save-plus-inner"><i class="fa-solid fa-fingerprint"></i></div>
                <div class="voice-play-overlay" onclick="playVoicePreview(event, '${url}', this.parentElement.parentElement)">
                    <i class="fa-solid fa-play"></i>
                </div>
            </div>
            <span class="voice-name-label">${name}</span>
        </div>`;
  }

  // # FN buildUserVoiceCloneCardsHtmlFragment
  // # KW صوت,استنساخ,voice,clone,sample
  function buildUserVoiceCloneCardsHtmlFragment() {
    const clones = Array.isArray(S.userVoiceClonesCache) ? S.userVoiceClonesCache : [];
    // # return — إرجاع النتيجة
    return clones
      .map((voice) => {
        const name = escapeHtmlForVoiceCardLabels(voice.name || 'Voice');
        const url = escapeHtmlForVoiceCardLabels(voice.sample_url || '');
        // # block — معالجة صوت/استنساخ
        const sampleText = escapeHtmlForVoiceCardLabels(voice.sample_text || '');
        const engine = escapeHtmlForVoiceCardLabels(voice.engine || '');
        const avatarUrl = escapeHtmlForVoiceCardLabels(
          `https://ui-avatars.com/api/?name=${encodeURIComponent(voice.name || 'Voice')}&background=eff6ff&color=2563eb&size=128`,
        );
        const selected = global.selectedSample === voice.sample_url ? ' selected' : '';
        // # return — إرجاع النتيجة
        return `
            <div class="voice-avatar-card voice-user-clone-card${selected}" data-sample-url="${url}" data-sample-text="${sampleText}" data-name="${name}" data-engine="${engine}" data-avatar-url="${avatarUrl}"
                 onclick="onPremiumVoiceCardClick(this)" title="Your saved voice">
                <div class="voice-avatar-wrapper">
                    <div class="voice-save-plus-inner"><i class="fa-solid fa-user"></i></div>
                    <div class="voice-play-overlay" onclick="playVoicePreview(event, '${url}', this.parentElement.parentElement)">
                        <i class="fa-solid fa-play"></i>
                    </div>
                </div>
                <span class="voice-name-label">${name}</span>
            </div>`;
      })
      // # block — معالجة صوت/استنساخ
      .join('');
  }

  // # FN buildVoiceSavePlusCardHtmlFragment
  // # KW صوت,استنساخ,voice,clone,sample
  function buildVoiceSavePlusCardHtmlFragment() {
    const ready = !!(global.lastExtractedVocalsUrl || S.pendingVoiceSampleUrl);
    const stateClass = ready ? 'ready' : 'disabled';
    const hint = ready
      ? 'Click to save your footprint'
      : 'Dub a video first to extract footprint';
    // # return — إرجاع النتيجة
    return `
        <div class="voice-avatar-card voice-save-plus-card ${stateClass}" id="voiceSavePlusCard"
             onclick="onVoiceSavePlusClick(event)" title="${escapeHtmlForVoiceCardLabels(hint)}">
            <div class="voice-avatar-wrapper">
                <div class="voice-save-plus-inner"><i class="fa-solid fa-plus"></i></div>
            </div>
            <span class="voice-name-label">Save Voice</span>
        </div>`;
  }

  // # FN buildVoiceRecordMicCardHtmlFragment
  // # AR الصوت والاستنساخ (buildVoiceRecordMicCardHtmlFragment)
  // # KW صوت,استنساخ,voice,clone,sample
  function buildVoiceRecordMicCardHtmlFragment() {
    // # return — إرجاع النتيجة
    return `
        <div class="voice-avatar-card voice-record-card" id="voiceRecordCard"
             onclick="openVoiceRecordModal()" title="Record a voice sample with your mic">
            <div class="voice-avatar-wrapper">
                <div class="voice-save-plus-inner" style="border-color:#ef4444;color:#ef4444;background:#fef2f2;">
                    <i class="fa-solid fa-microphone"></i>
                </div>
            </div>
            <span class="voice-name-label">Record</span>
        </div>`;
  }

  // # FN buildPremiumAndUserVoiceCardsHtml
  // # KW صوت,استنساخ,voice,clone,sample
  function buildPremiumAndUserVoiceCardsHtml(voices) {
    const list = Array.isArray(voices) ? voices : [];
    const cards = list
      .map((voice) => {
        const name = escapeHtmlForVoiceCardLabels(voice.name || 'Voice');
        const url = escapeHtmlForVoiceCardLabels(voice.sample_url || '');
        // # block — معالجة صوت/استنساخ
        const sampleText = escapeHtmlForVoiceCardLabels(voice.sample_text || '');
        const engine = escapeHtmlForVoiceCardLabels(voice.engine || '');
        const avatar = escapeHtmlForVoiceCardLabels(
          voice.avatar_url ||
            `https://ui-avatars.com/api/?name=${encodeURIComponent(voice.name || 'V')}&background=f3f4f6&color=111827`,
        );
        // # block — معالجة صوت/استنساخ
        const selected = global.selectedSample === voice.sample_url ? ' selected' : '';
        // # return — إرجاع النتيجة
        return `
            <div class="voice-avatar-card${selected}" data-sample-url="${url}" data-sample-text="${sampleText}" data-name="${name}" data-engine="${engine}" data-avatar-url="${avatar}"
                 onclick="onPremiumVoiceCardClick(this)">
                <div class="voice-avatar-wrapper">
                    <img src="${avatar}" alt="${name}">
                    <div class="voice-play-overlay" onclick="playVoicePreview(event, '${url}', this.parentElement.parentElement)">
                        <i class="fa-solid fa-play"></i>
                    </div>
                </div>
                <span class="voice-name-label">${name}</span>
            </div>`;
      // # block — معالجة صوت/استنساخ
      })
      .join('');
    // # return — إرجاع النتيجة
    return (
      cards +
      buildUserVoiceCloneCardsHtmlFragment() +
      buildSavedUserVoiceCardHtmlFragment() +
      // # block — معالجة صوت/استنساخ
      buildVoiceSavePlusCardHtmlFragment() +
      buildVoiceRecordMicCardHtmlFragment()
    );
  }

  // # FN renderPremiumVoicesGridInDom
  // # KW صوت,استنساخ,voice,clone,sample
  function renderPremiumVoicesGridInDom(voices) {
    S.premiumVoicesCache = Array.isArray(voices) ? voices : [];
    const container = document.getElementById('supabaseVoicesContainer');
    // # guard — شرط رفض أو خروج مبكر
    if (!container) return;
    // # شرط — فرع منطقي
    if (!S.premiumVoicesCache.length && !global.savedVoiceProfile) {
      container.innerHTML =
        // # block — معالجة صوت/استنساخ
        (buildVoiceSavePlusCardHtmlFragment() ||
          '<div style="padding:10px;text-align:center;">No voices</div>') +
        buildVoiceRecordMicCardHtmlFragment();
      // # return — إرجاع النتيجة
      return;
    }
    container.innerHTML = buildPremiumAndUserVoiceCardsHtml(S.premiumVoicesCache);
    // # block — معالجة صوت/استنساخ
    syncVoiceSelectTriggerFromCurrentSelection();
  }

  // # FN resolveVoiceAvatarFromElement
  // # AR الصوت والاستنساخ (resolveVoiceAvatarFromElement)
  // # KW صوت,استنساخ,voice,clone,sample
  function resolveVoiceAvatarFromElement(element, name) {
    // # guard — شرط رفض أو خروج مبكر
    if (!element) return '';
    const fromData = (element.getAttribute('data-avatar-url') || '').trim();
    // # guard — شرط رفض أو خروج مبكر
    if (fromData) return fromData;
    const img = element.querySelector('.voice-avatar-wrapper img');
    // # guard — شرط رفض أو خروج مبكر
    if (img && img.getAttribute('src')) return img.getAttribute('src');
    // # block — معالجة صوت/استنساخ
    const label = name || element.getAttribute('data-name') || 'Voice';
    // # شرط — فرع منطقي
    if (
      element.classList.contains('voice-saved-user-card') ||
      element.classList.contains('voice-user-clone-card') ||
      element.id === 'voiceOptSaved'
    ) {
      // # block — معالجة صوت/استنساخ
      return `https://ui-avatars.com/api/?name=${encodeURIComponent(label)}&background=eff6ff&color=2563eb&size=128`;
    }
    // # return — إرجاع النتيجة
    return '';
  }

  // # FN updateVoiceSelectTriggerUI
  // # KW صوت,استنساخ,voice,clone,sample
  function updateVoiceSelectTriggerUI({ mode, sampleUrl, name, element, avatarUrl } = {}) {
    const iconEl = document.getElementById('voiceSelectIcon');
    const labelEl = document.getElementById('voiceSelectLabel');
    // # guard — شرط رفض أو خروج مبكر
    if (!labelEl) return;

    const displayName = name || 'Voice Clone';
    labelEl.textContent = displayName;
    // # block — معالجة صوت/استنساخ
    labelEl.style.color = 'var(--text-main)';
    // # guard — شرط رفض أو خروج مبكر
    if (!iconEl) return;

    let resolvedAvatar = (avatarUrl || '').trim() || resolveVoiceAvatarFromElement(element, displayName);
    // # شرط — فرع منطقي
    if (!resolvedAvatar && sampleUrl && Array.isArray(S.premiumVoicesCache)) {
      const match = S.premiumVoicesCache.find((v) => v.sample_url === sampleUrl);
      // # شرط — فرع منطقي
      if (match?.avatar_url) resolvedAvatar = match.avatar_url;
      else if (match?.name) {
        resolvedAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(match.name)}&background=f3f4f6&color=111827&size=128`;
      }
    }

    // # guard — شرط رفض أو خروج مبكر
    if (resolvedAvatar) {
      iconEl.innerHTML = `<img src="${escapeHtmlForVoiceCardLabels(resolvedAvatar)}" alt="" class="voice-select-trigger-avatar">`;
      // # return — إرجاع النتيجة
      return;
    }
    // # guard — شرط رفض أو خروج مبكر
    if (mode === 'default') {
      iconEl.innerHTML = '<i class="fa-solid fa-robot" style="font-size:1.1rem;color:#6b7280;"></i>';
      // # return — إرجاع النتيجة
      return;
    }
    // # block — فرع شرطي
    iconEl.innerHTML = '<i class="fa-solid fa-microphone-lines" style="font-size:1.1rem;color:#6b7280;"></i>';
  }

  // # FN syncVoiceSelectTriggerFromCurrentSelection
  // # KW صوت,استنساخ,voice,clone,sample
  function syncVoiceSelectTriggerFromCurrentSelection() {
    const sampleUrl = (global.selectedSample || '').trim();
    // # شرط — فرع منطقي
    if (sampleUrl) {
      const container = document.getElementById('supabaseVoicesContainer');
      const safeUrl = typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(sampleUrl) : sampleUrl.replace(/"/g, '\\"');
      const card = container?.querySelector(`[data-sample-url="${safeUrl}"]`);
      // # شرط — فرع منطقي
      if (card) {
        updateVoiceSelectTriggerUI({
          mode: global.voiceMode || 'clone',
          sampleUrl,
          name: card.getAttribute('data-name') || document.getElementById('voiceSelectLabel')?.textContent,
          element: card,
        // # block — معالجة صوت/استنساخ
        });
        // # return — إرجاع النتيجة
        return;
      }
      const match = S.premiumVoicesCache?.find((v) => v.sample_url === sampleUrl);
      // # شرط — فرع منطقي
      if (match) {
        const fallbackAvatar = match.avatar_url
          // # block — معالجة صوت/استنساخ
          || `https://ui-avatars.com/api/?name=${encodeURIComponent(match.name || 'Voice')}&background=f3f4f6&color=111827&size=128`;
        updateVoiceSelectTriggerUI({
          mode: global.voiceMode || 'clone',
          sampleUrl,
          name: match.name || 'Voice',
          avatarUrl: fallbackAvatar,
        // # block — معالجة صوت/استنساخ
        });
        // # return — إرجاع النتيجة
        return;
      }
    }
    updateVoiceSelectTriggerUI({
      mode: global.voiceMode || 'clone',
      // # block — معالجة صوت/استنساخ
      sampleUrl: '',
      name: document.getElementById('voiceSelectLabel')?.textContent || 'Voice Clone',
      element: null,
    });
  }

  // # FN refreshVoiceSavePlusCardInGrid
  // # AR الصوت والاستنساخ (refreshVoiceSavePlusCardInGrid)
  // # KW صوت,استنساخ,voice,clone,sample
  function refreshVoiceSavePlusCardInGrid() {
    renderPremiumVoicesGridInDom(S.premiumVoicesCache);
  }

  // # FN handlePremiumVoiceCardClickSelection
  // # KW صوت,استنساخ,voice,clone,sample
  function handlePremiumVoiceCardClickSelection(cardEl) {
    // # guard — شرط رفض أو خروج مبكر
    if (!cardEl) return;
    const sampleUrl = (cardEl.getAttribute('data-sample-url') || '').trim();
    const sampleText = (cardEl.getAttribute('data-sample-text') || '').trim();
    const name = cardEl.getAttribute('data-name') || 'Voice';
    const engine = cardEl.getAttribute('data-engine') || '';
    // # block — معالجة صوت/استنساخ
    global.usingSavedVoice = cardEl.classList.contains('voice-saved-user-card');
    global.selectedSample = sampleUrl;
    global.selectedSampleText = sampleText;
    global.voiceMode = 'clone';
    global.forceEngine = engine;
    global.selectedCloneSource = cardEl.classList.contains('voice-user-clone-card')
      // # block — معالجة صوت/استنساخ
      ? 'library'
      : cardEl.classList.contains('voice-saved-user-card')
        ? 'saved'
        : 'premium';
    // # شرط — فرع منطقي
    if (typeof global.selectVoiceOption === 'function') {
      global.selectVoiceOption('clone', sampleUrl, cardEl, engine, name);
    // # block — معالجة صوت/استنساخ
    }
    global.selectedSample = sampleUrl;
    global.voiceMode = 'clone';
    global.usingSavedVoice = cardEl.classList.contains('voice-saved-user-card');
  }

  // # FN handleVoiceSavePlusCardClick
  // # AR معالجة voice حفظ plus card click (handleVoiceSavePlusCardClick)
  // # KW صوت,استنساخ,voice,clone,sample
  function handleVoiceSavePlusCardClick(event) {
    event?.stopPropagation?.();
    event?.preventDefault?.();
    const url = (global.lastExtractedVocalsUrl || S.pendingVoiceSampleUrl || '').trim();
    // # شرط — فرع منطقي
    if (!url) {
      global.showToast?.(
        // # block — معالجة صوت/استنساخ
        'Upload a video and choose Voice Clone first to extract footprint',
        'info',
      );
      // # return — إرجاع النتيجة
      return;
    }
    // # شرط — فرع منطقي
    if (S.userVoiceClonesCache.length >= 10) {
      // # block — معالجة صوت/استنساخ
      global.showToast?.(
        'You can only save up to 10 voice clones. Please delete one from My Files first.',
        'error',
      );
      // # return — إرجاع النتيجة
      return;
    }
    // # block — معالجة صوت/استنساخ
    S.pendingVoiceSampleUrl = url;
    // # شرط — فرع منطقي
    if (DubbingApp.voiceSave?.showVoiceSaveNameModal) {
      DubbingApp.voiceSave.showVoiceSaveNameModal(url);
    }
  }

  DubbingApp.voiceHtml = {
    escapeHtmlForVoiceCardLabels,
    buildLanguageFlagImgHtml,
    renderPremiumVoicesGridInDom,
    refreshVoiceSavePlusCardInGrid,
    handlePremiumVoiceCardClickSelection,
    handleVoiceSavePlusCardClick,
    updateVoiceSelectTriggerUI,
    syncVoiceSelectTriggerFromCurrentSelection,
  };

  global.escapeVoiceHtml = escapeHtmlForVoiceCardLabels;
  global.getFlagImg = buildLanguageFlagImgHtml;
  global.buildPremiumVoicesHtml = buildPremiumAndUserVoiceCardsHtml;
  global.renderPremiumVoicesGrid = renderPremiumVoicesGridInDom;
  global.updateVoiceSavePlusCard = refreshVoiceSavePlusCardInGrid;
  global.updateVoiceSelectTriggerUI = updateVoiceSelectTriggerUI;
  global.syncVoiceSelectTriggerFromCurrentSelection = syncVoiceSelectTriggerFromCurrentSelection;
  global.onPremiumVoiceCardClick = handlePremiumVoiceCardClickSelection;
  global.onVoiceSavePlusClick = handleVoiceSavePlusCardClick;
})(window);
