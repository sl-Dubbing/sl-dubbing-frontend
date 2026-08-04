// # FILE frontend/sl-dubbing-frontend-main/js/shared/16-credits-modal.js
// # AR وحدات مشتركة — auth، credits، menu
// # KW نقاط,credits,تنفيذ,local
// # CONVENTION — FN/AR/KW + # block كل ~6 أسطر — FUNCTION_INDEX.md DOMAIN_INDEX.md
// =====================================================================
// 📒 فهرس الدوال — js/shared/16-credits-modal.js
// ---------------------------------------------------------------------
//  هل_الرد_نقص_رصيد              → isInsufficientCreditsResponse
//  عرض_نافذة_شحن_الرصيد_الأنيقة  → showInsufficientCreditsModal
// =====================================================================
(function (global) {
  const SL = global.SLShared || (global.SLShared = {});
  const MODAL_ID = 'glotixInsufficientCreditsModal';

  // # FN ensureCreditsModalStyles
  // # KW نقاط,credits,billing,خصم,تنفيذ,local,cloud,modal,parity
  function ensureCreditsModalStyles() {
    // # guard — شرط رفض أو خروج مبكر
    if (document.getElementById('glotixCreditsModalStyles')) return;
    const style = document.createElement('style');
    style.id = 'glotixCreditsModalStyles';
    style.textContent = `
      .glotix-credits-overlay {
        position: fixed; inset: 0; z-index: 10000;
        display: flex; align-items: center; justify-content: center;
        padding: 24px;
        background: rgba(15, 15, 16, 0.52);
        backdrop-filter: blur(4px);
        animation: glotixCreditsFadeIn 0.2s ease;
      }
      @keyframes glotixCreditsFadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      .glotix-credits-card {
        background: #fff;
        border: 1px solid #e5e7eb;
        border-radius: 20px;
        padding: 36px 32px 28px;
        max-width: 440px;
        width: 100%;
        text-align: center;
        box-shadow: 0 24px 60px rgba(0, 0, 0, 0.14);
        animation: glotixCreditsSlideUp 0.25s cubic-bezier(0.32, 0.72, 0, 1);
      }
      @keyframes glotixCreditsSlideUp {
        from { opacity: 0; transform: translateY(12px) scale(0.98); }
        to { opacity: 1; transform: translateY(0) scale(1); }
      }
      .glotix-credits-icon {
        width: 56px; height: 56px; margin: 0 auto 18px;
        border-radius: 16px;
        background: linear-gradient(135deg, #fef3c7, #fde68a);
        color: #b45309;
        display: flex; align-items: center; justify-content: center;
        font-size: 1.5rem;
      }
      .glotix-credits-card h3 {
        font-size: 1.35rem; font-weight: 800; color: #0f0f10;
        margin: 0 0 10px; letter-spacing: -0.02em;
      }
      .glotix-credits-card .glotix-credits-lead {
        color: #6b7280; font-size: 0.98rem; line-height: 1.6;
        margin: 0 0 18px;
      }
      .glotix-credits-stats {
        display: flex; gap: 12px; justify-content: center;
        margin-bottom: 24px; flex-wrap: wrap;
      }
      .glotix-credits-stat {
        flex: 1; min-width: 120px;
        background: #f9fafb; border: 1px solid #e5e7eb;
        border-radius: 12px; padding: 12px 14px;
      }
      .glotix-credits-stat .lbl {
        font-size: 0.75rem; font-weight: 600; color: #9ca3af;
        text-transform: uppercase; letter-spacing: 0.04em;
        margin-bottom: 4px;
      }
      .glotix-credits-stat .val {
        font-size: 1.25rem; font-weight: 800; color: #0f0f10;
      }
      .glotix-credits-stat.need .val { color: #dc2626; }
      .glotix-credits-actions {
        display: flex; flex-direction: column; gap: 10px;
      }
      .glotix-credits-btn-primary {
        display: inline-flex; align-items: center; justify-content: center;
        gap: 8px; width: 100%; padding: 14px 20px;
        border-radius: 12px; border: none;
        background: #0f0f10; color: #fff;
        font-weight: 700; font-size: 1rem;
        text-decoration: none; cursor: pointer;
        transition: background 0.2s, transform 0.15s;
      }
      .glotix-credits-btn-primary:hover {
        background: #27272a; transform: translateY(-1px);
      }
      .glotix-credits-btn-ghost {
        background: transparent; border: none;
        color: #6b7280; font-weight: 600; font-size: 0.95rem;
        padding: 10px; cursor: pointer;
      }
      .glotix-credits-btn-ghost:hover { color: #0f0f10; }
    `;
    document.head.appendChild(style);
  }

  // # FN formatCreditNum
  // # KW نقاط,credits,billing,خصم,تنفيذ,local,cloud,modal,parity
  function formatCreditNum(n) {
    // # guard — شرط رفض أو خروج مبكر
    if (n === undefined || n === null || n === '' || n === '?') return '—';
    const num = Number(n);
    // # guard — شرط رفض أو خروج مبكر
    if (Number.isFinite(num)) return String(num);
    // # return — إرجاع النتيجة
    return String(n);
  }

  // # FN isInsufficientCreditsResponse
  // # AR النقاط والفوترة (isInsufficientCreditsResponse)
  // # KW نقاط,credits,billing,خصم,تنفيذ,local,cloud,modal,parity
  function isInsufficientCreditsResponse(res, data) {
    const status = res && res.status;
    const err = String((data && (data.error || data.message)) || '').toUpperCase();
    // # return — إرجاع النتيجة
    return (
      status === 402 ||
      err === 'INSUFFICIENT_CREDITS' ||
      // # block — معالجة صوت/استنساخ
      err === 'INSUFFICIENT_CREDITS_FOR_VOICE_CLONE'
    );
  }

  /**
   * @param {object} opts
   * @param {number|string} [opts.required]
   * @param {number|string} [opts.balance]
   * @param {'tts'|'dubbing'|string} [opts.context]
   */
  // # FN showInsufficientCreditsModal
  // # KW نقاط,credits,billing,خصم,تنفيذ,local,cloud,modal,parity
  function showInsufficientCreditsModal(opts) {
    opts = opts || {};
    ensureCreditsModalStyles();
    closeInsufficientCreditsModal();

    const required = formatCreditNum(opts.required);
    const balance = formatCreditNum(opts.balance);
    // # block — نقاط/credits
    const ctx = (opts.context || '').toLowerCase();
    const isVoiceClone = ctx === 'voice_clone';
    const actionLabel =
      ctx === 'tts'
        ? 'this text-to-speech request'
        : ctx === 'dubbing'
          // # block — معالجة صوت/استنساخ
          ? 'this dubbing job'
          : isVoiceClone
            ? 'original voice cloning'
            : 'this action';
    const title = isVoiceClone ? 'Voice clone fee' : 'Not enough credits';
    const lead = isVoiceClone
      // # block — معالجة صوت/استنساخ
      ? `Cloning the original voice from your video adds ${required} credits to this job. Using a saved sample or a site voice is charged at normal dubbing rates only.`
      : `You need more credits to continue. Please top up your balance to run ${actionLabel}.`;

    const overlay = document.createElement('div');
    overlay.id = MODAL_ID;
    overlay.className = 'glotix-credits-overlay';
    overlay.setAttribute('role', 'dialog');
    // # block — نقاط/credits
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'glotixCreditsTitle');

    overlay.innerHTML = `
      <div class="glotix-credits-card">
        <div class="glotix-credits-icon" aria-hidden="true">
          <i class="fas fa-coins"></i>
        </div>
        <h3 id="glotixCreditsTitle">${title}</h3>
        <p class="glotix-credits-lead">
          ${lead}
        </p>
        <div class="glotix-credits-stats">
          <div class="glotix-credits-stat need">
            <div class="lbl">Required</div>
            <div class="val">${required}</div>
          </div>
          <div class="glotix-credits-stat">
            <div class="lbl">Your balance</div>
            <div class="val">${balance}</div>
          </div>
        </div>
        <div class="glotix-credits-actions">
          <a href="/pricing" class="glotix-credits-btn-primary">
            <i class="fas fa-arrow-up-right-from-square"></i> Add credits
          </a>
          <button type="button" class="glotix-credits-btn-ghost" data-glotix-credits-close>
            Not now
          </button>
        </div>
      </div>`;

    // # block — نقاط/credits
    overlay.querySelector('[data-glotix-credits-close]').addEventListener('click', closeInsufficientCreditsModal);
    overlay.addEventListener('click', (e) => {
      // # شرط — فرع منطقي
      if (e.target === overlay) closeInsufficientCreditsModal();
    });
    document.addEventListener('keydown', onCreditsModalEscape);
    document.body.appendChild(overlay);
  }

  // # FN onCreditsModalEscape
  // # AR النقاط والفوترة (onCreditsModalEscape)
  // # KW نقاط,credits,billing,خصم,تنفيذ,local,cloud,modal,parity
  function onCreditsModalEscape(e) {
    // # شرط — فرع منطقي
    if (e.key === 'Escape') closeInsufficientCreditsModal();
  }

  // # FN closeInsufficientCreditsModal
  // # AR إغلاق insufficient credits modal (closeInsufficientCreditsModal)
  // # KW نقاط,credits,billing,خصم,تنفيذ,local,cloud,modal,parity
  function closeInsufficientCreditsModal() {
    document.removeEventListener('keydown', onCreditsModalEscape);
    document.getElementById(MODAL_ID)?.remove();
  }

  SL.creditsModal = {
    isInsufficientCreditsResponse,
    showInsufficientCreditsModal,
    closeInsufficientCreditsModal,
  };
  global.isInsufficientCreditsResponse = isInsufficientCreditsResponse;
  global.showInsufficientCreditsModal = showInsufficientCreditsModal;
  global.closeInsufficientCreditsModal = closeInsufficientCreditsModal;
})(window);
