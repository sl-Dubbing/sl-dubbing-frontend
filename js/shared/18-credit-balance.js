// # FILE frontend/sl-dubbing-frontend-main/js/shared/18-credit-balance.js
// # AR وحدات مشتركة — auth، credits، menu
// # KW نقاط,credits
// # CONVENTION — FN/AR/KW + # block كل ~6 أسطر — FUNCTION_INDEX.md DOMAIN_INDEX.md
// =====================================================================
// 📒 فهرس الدوال — js/shared/18-credit-balance.js
// ---------------------------------------------------------------------
//  تنسيق_رصيد_الأحرف                  → formatCreditBalanceLabel
//  ضمان_شارة_الرصيد_في_الهيدر       → ensureCreditBalanceBadge
//  تحديث_شارة_رصيد_الأحرف            → updateCreditBalanceBadge
// =====================================================================
(function (global) {
  const SL = global.SLShared || (global.SLShared = {});

  // # FN ensureCreditBalanceStyles
  // # AR النقاط والفوترة (ensureCreditBalanceStyles)
  // # KW نقاط,credits,billing,خصم
  function ensureCreditBalanceStyles() {
    // # guard — رفض/خروج
    if (document.getElementById('glotixCreditBalanceStyles')) return;
    const style = document.createElement('style');
    style.id = 'glotixCreditBalanceStyles';
    style.textContent = `
      .credit-balance-badge {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 8px 14px;
        border-radius: 999px;
        background: #fff;
        border: 1px solid #e5e7eb;
        color: #111827;
        font-weight: 700;
        font-size: 0.86rem;
        text-decoration: none;
        box-shadow: 0 1px 2px rgba(0,0,0,0.04);
        transition: border-color 0.2s, transform 0.15s;
        white-space: nowrap;
      }
      .credit-balance-badge:hover {
        border-color: #cbd5e1;
        transform: translateY(-1px);
      }
      .credit-balance-badge .cb-icon {
        color: #d97706;
        font-size: 0.95rem;
      }
      .credit-balance-badge .cb-value { font-variant-numeric: tabular-nums; }
      .credit-balance-badge .cb-unit {
        color: #6b7280;
        font-weight: 600;
        font-size: 0.78rem;
      }
      .credit-balance-badge.is-empty {
        border-color: #fecaca;
        background: #fef2f2;
        color: #991b1b;
      }
      .credit-balance-badge.is-empty .cb-icon { color: #dc2626; }
      @media (max-width: 640px) {
        .credit-balance-badge .cb-unit { display: none; }
      }
    `;
    document.head.appendChild(style);
  }

  // # FN formatCreditBalanceLabel
  // # AR النقاط والفوترة (formatCreditBalanceLabel)
  // # KW نقاط,credits,billing,خصم
  function formatCreditBalanceLabel(raw) {
    // # guard — رفض/خروج
    if (raw === undefined || raw === null || raw === '...') return '...';
    const n = Number(String(raw).replace(/[^\d.-]/g, ''));
    // # guard — رفض/خروج
    if (!Number.isFinite(n)) return String(raw);
    const fmt =
      SL.pricingPackages?.formatCharacterCount?.(n) ||
      // # block — فرع شرطي
      n.toLocaleString();
    return fmt;
  }

  /** ضمان_شارة_الرصيد_في_الهيدر — injects badge next to Menu in .user-zone */
  // # FN ensureCreditBalanceBadge
  // # AR النقاط والفوترة (ensureCreditBalanceBadge)
  // # KW نقاط,credits,billing,خصم
  function ensureCreditBalanceBadge() {
    ensureCreditBalanceStyles();
    let badge = document.getElementById('creditBalanceBadge');
    // # guard — رفض/خروج
    if (badge) return badge;

    const zone = document.querySelector('.user-zone');
    // # guard — رفض/خروج
    if (!zone) return null;

    // # block — نقاط/credits
    badge = document.createElement('a');
    badge.id = 'creditBalanceBadge';
    badge.className = 'credit-balance-badge';
    badge.href = '/pricing';
    badge.title = 'Character credits remaining';
    badge.setAttribute('aria-label', 'Character credit balance');
    badge.innerHTML = `
      <i class="fas fa-font cb-icon" aria-hidden="true"></i>
      <span class="cb-value" id="creditBalanceValue">...</span>
      <span class="cb-unit">chars</span>`;

    const menuBtn = document.getElementById('menuBtn');
    // # شرط
    if (menuBtn && menuBtn.parentElement === zone) {
      // # block — نقاط/credits
      zone.insertBefore(badge, menuBtn);
    } else {
      zone.prepend(badge);
    }
    return badge;
  }

  /** تحديث_شارة_رصيد_الأحرف — syncs header badge + #menuCredits */
  // # FN updateCreditBalanceBadge
  // # AR النقاط والفوترة (updateCreditBalanceBadge)
  // # KW نقاط,credits,billing,خصم
  function updateCreditBalanceBadge(credits) {
    const badge = ensureCreditBalanceBadge();
    const label = formatCreditBalanceLabel(credits);
    const numeric = Number(String(credits).replace(/[^\d.-]/g, ''));
    const isEmpty = Number.isFinite(numeric) && numeric <= 0;

    // # شرط
    if (badge) {
      // # block — نقاط/credits
      badge.classList.toggle('is-empty', isEmpty);
      const val = badge.querySelector('#creditBalanceValue') || badge.querySelector('.cb-value');
      // # شرط
      if (val) val.textContent = label;
    }

    const menuCredits = document.getElementById('menuCredits');
    // # شرط
    if (menuCredits && credits !== undefined && credits !== null) {
      // # block — نقاط/credits
      menuCredits.textContent = credits === '...' ? '...' : label;
    }

    // # شرط
    if (Number.isFinite(numeric)) {
      global.__glotixUserCredits = numeric;
      global.__glotixCharacterCredits = numeric;
    }

    // Let upload form + pricing usage strip react
    // # try — عملية قد تفشل
    try {
      global.DubbingApp?.costEstimate?.refreshCostEstimateUi?.();
    } catch (_) { /* ignore */ }
    // # try — عملية قد تفشل
    try {
      global.SLShared?.pricingPackages?.refreshUsageStrip?.();
    } catch (_) { /* ignore */ }
  }

  // Patch updateDropdownUI so every credits refresh updates the badge.
  const prevUpdate = global.updateDropdownUI;
  global.updateDropdownUI = function patchedUpdateDropdownUI(user) {
    if (typeof prevUpdate === 'function') prevUpdate(user);
    else if (SL.menuUi?.updateDropdownUI) SL.menuUi.updateDropdownUI(user);
    if (user && user.credits !== undefined && user.credits !== null) {
      updateCreditBalanceBadge(user.credits);
    } else if (!user || !user.id) {
      const badge = document.getElementById('creditBalanceBadge');
      if (badge) badge.style.display = 'none';
    }
  };

  document.addEventListener('DOMContentLoaded', () => {
    ensureCreditBalanceBadge();
  });

  SL.creditBalance = {
    formatCreditBalanceLabel,
    ensureCreditBalanceBadge,
    updateCreditBalanceBadge,
  };
  global.updateCreditBalanceBadge = updateCreditBalanceBadge;
  global.ensureCreditBalanceBadge = ensureCreditBalanceBadge;
})(window);
