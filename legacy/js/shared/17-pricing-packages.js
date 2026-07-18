// # FILE frontend/sl-dubbing-frontend-main/js/shared/17-pricing-packages.js
// # AR وحدات مشتركة — auth، credits، menu
// # KW عام,general
// # CONVENTION — FN/AR/KW + # block كل ~6 أسطر — FUNCTION_INDEX.md DOMAIN_INDEX.md
// =====================================================================
// 📒 فهرس الدوال — js/shared/17-pricing-packages.js
// ---------------------------------------------------------------------
// ElevenLabs-style plan cards + higher-margin character pricing
// =====================================================================
(function (global) {
  const SL = global.SLShared || (global.SLShared = {});

  /**
   * Glotix character plans — ElevenLabs-style cards.
   * Retail target: ≈ $0.10 / 1,000 credits (~2–2.5× over $0.04–0.05 COGS).
   * Free = 2,000 credits only (INITIAL_CHARACTER_CREDITS).
   */
  const DEFAULT_CHARACTER_PACKS = {
    price_char_free: {
      credits: 2000,
      amount_cents: 0,
      name: 'Free',
      tier: 'free',
      free: true,
      chars_label: '2k credits',
      features: [
        { text: '2,000 free credits', ok: true },
        { text: 'Dubbing + TTS access', ok: true },
        { text: 'Commercial license', ok: false },
        { text: 'Priority queue', ok: false },
      ],
      includes: '',
    },
    price_char_starter: {
      credits: 90000,
      amount_cents: 900,
      name: 'Starter',
      tier: 'starter',
      chars_label: '90k credits',
      features: [
        { text: '90,000 credits', ok: true },
        { text: '≈ $0.10 per 1k credits', ok: true },
        { text: 'Voice cloning', ok: true },
        { text: 'Commercial license', ok: true },
      ],
      includes: '+ Everything in Free',
    },
    price_char_creator: {
      credits: 220000,
      amount_cents: 2200,
      name: 'Creator',
      tier: 'creator',
      popular: true,
      chars_label: '220k credits',
      features: [
        { text: '220,000 credits', ok: true },
        { text: '≈ $0.10 per 1k credits', ok: true },
        { text: 'Higher concurrency', ok: true },
        { text: '192 kbps audio', ok: true },
      ],
      includes: '+ Everything in Starter',
    },
    price_char_pro: {
      credits: 990000,
      amount_cents: 9900,
      name: 'Pro',
      tier: 'pro',
      chars_label: '990k credits',
      features: [
        { text: '990,000 credits', ok: true },
        { text: '≈ $0.10 per 1k credits', ok: true },
        { text: 'API access', ok: true },
        { text: 'Team-ready workflows', ok: true },
      ],
      includes: '+ Everything in Creator',
    },
    price_char_scale: {
      credits: 3300000,
      amount_cents: 33000,
      name: 'Scale',
      tier: 'scale',
      chars_label: '3.3M credits',
      features: [
        { text: '3,300,000 credits', ok: true },
        { text: '≈ $0.10 per 1k credits', ok: true },
        { text: 'Workspace seats', ok: true },
        { text: 'Priority support', ok: true },
      ],
      includes: '+ Everything in Pro',
    },
    price_char_business: {
      credits: 9900000,
      amount_cents: 99000,
      name: 'Business',
      tier: 'business',
      chars_label: '9.9M credits',
      features: [
        { text: '9,900,000 credits', ok: true },
        { text: '≈ $0.10 per 1k credits', ok: true },
        { text: 'Production volume ready', ok: true },
        { text: 'Dedicated support lane', ok: true },
      ],
      includes: '+ Everything in Scale',
    },
  };

  const USD_PER_1K = 0.1;
  const CUSTOM_MIN_USD = 5;
  let _pricingMeta = {
    usd_per_1k_credits: USD_PER_1K,
    custom_min_cents: CUSTOM_MIN_USD * 100,
    custom_max_cents: 1000000,
  };

  // # FN formatCharacterCount
  // # AR دالة formatCharacterCount (formatCharacterCount)
  // # KW عام,general
  function formatCharacterCount(n) {
    const num = Number(n);
    // # guard — رفض/خروج
    if (!Number.isFinite(num)) return String(n || '—');
    // # guard — رفض/خروج
    if (num >= 1_000_000) {
      const m = num / 1_000_000;
      return (Number.isInteger(m) ? m : m.toFixed(1).replace(/\.0$/, '')) + 'M';
    // # block — فرع شرطي
    }
    // # guard — رفض/خروج
    if (num >= 1000) {
      const k = num / 1000;
      return (Number.isInteger(k) ? k : k.toFixed(0)) + 'k';
    }
    return num.toLocaleString();
  }

  // # FN _orderedPackEntries
  // # AR دالة _orderedPackEntries (_orderedPackEntries)
  // # KW عام,general
  function _orderedPackEntries(packs) {
    const preferred = ['free', 'starter', 'creator', 'pro', 'scale', 'business', 'elite'];
    const entries = Object.entries(packs || {}).filter(
      ([, pack]) => pack && pack.tier !== 'custom',
    );
    entries.sort((a, b) => {
      // # block — تنفيذ منطق — راجع الأسطر التالية
      const ta = String((a[1] && a[1].tier) || '').toLowerCase();
      const tb = String((b[1] && b[1].tier) || '').toLowerCase();
      const ia = preferred.indexOf(ta);
      const ib = preferred.indexOf(tb);
      // # guard — رفض/خروج
      if (ia === -1 && ib === -1) return (a[1].credits || 0) - (b[1].credits || 0);
      // # guard — رفض/خروج
      if (ia === -1) return 1;
      // # guard — رفض/خروج
      if (ib === -1) return -1;
      return ia - ib;
    });
    return entries;
  }

  // # FN _normalizeFeatures
  // # AR دالة _normalizeFeatures (_normalizeFeatures)
  // # KW عام,general
  function _normalizeFeatures(pack, fallback) {
    const raw = pack.features || fallback.features || [];
    return raw.map((f) => {
      // # guard — رفض/خروج
      if (typeof f === 'string') return { text: f, ok: true };
      return { text: f.text || '', ok: f.ok !== false };
    });
  }

  // # FN refreshUsageStrip
  // # AR دالة refreshUsageStrip (refreshUsageStrip)
  // # KW عام,general
  function refreshUsageStrip() {
    const usedEl = document.getElementById('usageCreditsLabel');
    const bar = document.getElementById('usageCreditsBar');
    const planEl = document.getElementById('usagePlanLabel');
    // # guard — رفض/خروج
    if (!usedEl && !bar && !planEl) return;

    const bal =
      // # block — نقاط/credits
      Number(global.__glotixCharacterCredits ?? global.__glotixUserCredits) || 0;
    // Soft "quota feel" for UI — pack ceiling from highest owned-ish balance
    const softCap = Math.max(2000, bal || 2000);
    const used = 0; // top-up model: remaining = balance; used not tracked yet
    const remaining = bal;
    // # شرط
    if (usedEl) {
      usedEl.textContent = `${remaining.toLocaleString()} credits remaining`;
    // # block — نقاط/credits
    }
    // # شرط
    if (bar) {
      const pct = softCap > 0 ? Math.min(100, Math.round((remaining / softCap) * 100)) : 0;
      bar.style.width = pct + '%';
    }
    // # شرط
    if (planEl) {
      // # block — تحديث واجهة/DOM
      planEl.textContent =
        bal <= 0
          ? "You're on Free — buy credits to dub"
          : bal <= 2000
            ? "You're on Free (2,000 starter credits)"
            : bal < 90000
              // # block — نقاط/credits
              ? "You're on Starter-level credits"
              : bal < 220000
                ? "You're on Creator-level credits"
                : bal < 990000
                  ? "You're on Pro-level credits"
                  : bal < 3300000
                    // # block — نقاط/credits
                    ? "You're on Scale-level credits"
                    : bal < 9900000
                      ? "You're on Business-level credits"
                      : "You're on high-volume credits";
    }
  }

  // # FN creditsForUsd
  // # AR النقاط والفوترة (creditsForUsd)
  // # KW نقاط,credits,billing,خصم
  function creditsForUsd(usd) {
    const rate = Number(_pricingMeta.usd_per_1k_credits) || USD_PER_1K;
    const n = Math.max(0, Number(usd) || 0);
    return Math.floor((n / rate) * 1000);
  }

  // # FN _bindCustomCard
  // # AR دالة _bindCustomCard (_bindCustomCard)
  // # KW عام,general
  function _bindCustomCard(grid) {
    const input = grid.querySelector('#customAmountUsd');
    const preview = grid.querySelector('#customCreditsPreview');
    const btn = grid.querySelector('#customBuyBtn');
    // # guard — رفض/خروج
    if (!input || !btn) return;

    // # FN refreshPreview
    // # AR دالة refreshPreview (refreshPreview)
    // # KW عام,general
    const refreshPreview = () => {
      // # block — نقاط/credits
      const usd = Number(input.value);
      const credits = creditsForUsd(usd);
      // # شرط
      if (preview) {
        preview.textContent = Number.isFinite(usd) && usd > 0
          ? `${formatCharacterCount(credits)} credits ($${(usd || 0).toFixed(2)})`
          // # block — نقاط/credits
          : `Enter amount · $${(Number(_pricingMeta.usd_per_1k_credits) || USD_PER_1K).toFixed(2)} / 1k`;
      // # block — نقاط/credits
      }
    };
    input.addEventListener('input', refreshPreview);
    refreshPreview();

    btn.addEventListener('click', () => {
      // # block — تنفيذ منطق — راجع الأسطر التالية
      const usd = Number(input.value);
      // # block — تنفيذ منطق — راجع الأسطر التالية
      const minUsd = (Number(_pricingMeta.custom_min_cents) || 500) / 100;
      // # شرط
      if (!Number.isFinite(usd) || usd < minUsd) {
        // # guard — رفض/خروج
        if (typeof global.showToast === 'function') {
          global.showToast(`Minimum custom purchase is $${minUsd.toFixed(0)}`, 'error');
        }
        // # block — فرع شرطي
        return;
      // # block — فرع شرطي
      }
      purchaseCustomAmount(usd, btn);
    });
  }

  // # FN _customCardHtml
  // # AR دالة _customCardHtml (_customCardHtml)
  // # KW عام,general
  function _customCardHtml() {
    const rate = Number(_pricingMeta.usd_per_1k_credits) || USD_PER_1K;
    const minUsd = (Number(_pricingMeta.custom_min_cents) || 500) / 100;
    return `
      <article class="plan-card is-custom" data-tier="custom">
        <h3 class="plan-name">Custom</h3>
        <div class="plan-price">
          <span class="plan-price-num">Pay what you need</span>
        </div>
        <label class="custom-amount-label" for="customAmountUsd">Amount (USD)</label>
        <div class="custom-amount-row">
          <span class="custom-currency">$</span>
          <input type="number" id="customAmountUsd" class="custom-amount-input"
                 min="${minUsd}" step="1" placeholder="${minUsd}" value="50" />
        </div>
        <p class="custom-preview" id="customCreditsPreview">…</p>
        <button type="button" class="plan-btn plan-btn-primary" id="customBuyBtn">
          Buy credits
        </button>
        <ul class="plan-features">
          <li class="plan-feature-strong">
            <i class="fa-solid fa-check"></i>
            $${rate.toFixed(2)} per 1,000 credits
          </li>
          <li><i class="fa-solid fa-check"></i> Same rate as fixed packs</li>
          <li><i class="fa-solid fa-check"></i> Credits never expire</li>
          <li><i class="fa-solid fa-check"></i> Min $${minUsd.toFixed(0)} · Stripe checkout</li>
        </ul>
      </article>`;
  }

  /** ElevenLabs-style plan cards + Business + Custom */
  // # FN renderPricingPackages
  // # AR دالة renderPricingPackages (renderPricingPackages)
  // # KW عام,general
  function renderPricingPackages(packs, gridEl) {
    const grid = gridEl || document.getElementById('pricingGrid');
    // # guard — رفض/خروج
    if (!grid) return;

    const source = packs && Object.keys(packs).length ? packs : DEFAULT_CHARACTER_PACKS;
    const entries = _orderedPackEntries(source);

    grid.innerHTML =
      // # block — تحديث واجهة/DOM
      entries
        .map(([priceId, pack]) => {
          const fallback =
            Object.values(DEFAULT_CHARACTER_PACKS).find(
              (p) => p.tier === pack.tier || p.credits === pack.credits,
            ) || {};
          // # block — نقاط/credits
          const cents = pack.amount_cents != null ? pack.amount_cents : fallback.amount_cents || 0;
          const dollars = (cents / 100).toFixed(0);
          const popular = pack.popular || fallback.popular;
          const name = pack.name || fallback.name || 'Pack';
          const chars = pack.credits != null ? pack.credits : fallback.credits || 0;
          const isFree = !!(pack.free || cents === 0 || pack.tier === 'free');
          // # block — نقاط/credits
          const features = _normalizeFeatures(pack, fallback);
          const includes = pack.includes || fallback.includes || '';
          const btnClass = popular ? 'plan-btn plan-btn-primary' : 'plan-btn';
          const btnLabel = isFree ? 'Get started' : 'Upgrade';

          return `
          <article class="plan-card ${popular ? 'is-popular' : ''} ${isFree ? 'is-free' : ''}"
                   data-tier="${pack.tier || ''}" data-price-id="${priceId}">
            ${popular ? '<span class="plan-badge">Popular</span>' : ''}
            <h3 class="plan-name">${name}</h3>
            <div class="plan-price">
              ${isFree ? '<span class="plan-price-num">$0</span>' : `<span class="plan-price-num">$${dollars}</span>`}
              <span class="plan-price-unit">/ pack</span>
            </div>
            <button type="button" class="${btnClass}"
              data-buy-pack="${isFree ? '' : priceId}"
              data-free="${isFree ? '1' : '0'}">
              ${btnLabel}
            </button>
            <ul class="plan-features">
              <li class="plan-feature-strong">
                <i class="fa-solid fa-check"></i>
                ${formatCharacterCount(chars)} credits
              </li>
              ${features
                .map(
                  (f) => `
                <li class="${f.ok ? '' : 'is-missing'}">
                  <i class="fa-solid ${f.ok ? 'fa-check' : 'fa-xmark'}"></i>
                  ${f.text}
                </li>`,
                )
                .join('')}
              ${
                includes
                  ? `<li class="plan-includes"><i class="fa-solid fa-plus"></i> ${includes.replace(/^\+\s*/, '')}</li>`
                  : ''
              }
            </ul>
          </article>`;
        })
        .join('') + _customCardHtml();

    grid.querySelectorAll('.plan-btn[data-buy-pack]').forEach((btn) => {
      // # block — تنفيذ منطق — راجع الأسطر التالية
      btn.addEventListener('click', () => {
        // # guard — رفض/خروج
        if (btn.getAttribute('data-free') === '1') {
          window.location.href = '/dubbing';
          return;
        }
        const id = btn.getAttribute('data-buy-pack');
        // # شرط
        if (id) purchaseCharacterPack(id, btn);
      });
    });
    _bindCustomCard(grid);
    refreshUsageStrip();
  }

  // # FN _postCheckout
  // # AR دالة _postCheckout (_postCheckout)
  // # KW عام,general
  async function _postCheckout(body, btn) {
    const headers =
      typeof global.getApiAuthHeaders === 'function' ? global.getApiAuthHeaders() : null;
    // # شرط
    if (!headers) {
      const banner = document.getElementById('guestBanner');
      // # شرط
      if (banner) banner.style.display = 'flex';
      // # شرط
      if (typeof global.showToast === 'function') {
        global.showToast('Please sign in to purchase credits', 'error');
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    // # block — نقاط/credits
    const apiBase = (
      SL.apiBase ||
      (global.APP_CONFIG && global.APP_CONFIG.API_BASE) ||
      global.API_BASE ||
      ''
    ).replace(/\/$/, '');

    // # block — تنفيذ منطق — راجع الأسطر التالية
    const originalText = btn ? btn.innerHTML : '';
    // # شرط
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
    }

    // # try — عملية قد تفشل
    try {
      // # HTTP — طلب API
      const res = await fetch(`${apiBase}/api/payments/checkout`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      // # guard — رفض/خروج
      if (!res.ok || !data.success || !data.url) {
        throw new Error(data.error || 'Checkout failed');
      }
      window.location.href = data.url;
    } catch (err) {
      console.error('Checkout error:', err);
      // # شرط
      if (typeof global.showToast === 'function') {
        global.showToast(err.message || 'Failed to start checkout', 'error');
      }
      // # شرط
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = originalText;
      // # block — فرع شرطي
      }
    }
  }

  // # FN purchaseCharacterPack
  // # AR دالة purchaseCharacterPack (purchaseCharacterPack)
  // # KW عام,general
  async function purchaseCharacterPack(priceId, btn) {
    return _postCheckout({ price_id: priceId }, btn);
  }

  // # FN purchaseCustomAmount
  // # AR دالة purchaseCustomAmount (purchaseCustomAmount)
  // # KW عام,general
  async function purchaseCustomAmount(usd, btn) {
    return _postCheckout({ price_id: 'custom', custom_amount_usd: Number(usd) }, btn);
  }

  // # FN loadAndRenderPricingPackages
  // # AR دالة loadAndRenderPricingPackages (loadAndRenderPricingPackages)
  // # KW عام,general
  async function loadAndRenderPricingPackages(gridEl) {
    const apiBase = (
      SL.apiBase ||
      (global.APP_CONFIG && global.APP_CONFIG.API_BASE) ||
      global.API_BASE ||
      ''
    // # block — تنفيذ منطق — راجع الأسطر التالية
    ).replace(/\/$/, '');
    // # try — عملية قد تفشل
    try {
      // # HTTP — طلب API
      const res = await fetch(`${apiBase}/api/payments/config`);
      const data = await res.json();
      // # شرط
      if (data.success) {
        // # شرط
        if (data.usd_per_1k_credits != null) _pricingMeta.usd_per_1k_credits = data.usd_per_1k_credits;
        // # شرط
        if (data.custom_min_cents != null) _pricingMeta.custom_min_cents = data.custom_min_cents;
        // # شرط
        if (data.custom_max_cents != null) _pricingMeta.custom_max_cents = data.custom_max_cents;
      }
      // # guard — رفض/خروج
      if (data.success && data.top_ups) {
        const merged = { ...DEFAULT_CHARACTER_PACKS, ...data.top_ups };
        renderPricingPackages(merged, gridEl);
        // # block — فرع شرطي
        return;
      }
    } catch (err) {
      console.warn('Failed to load pricing from API, using fallback', err);
    }
    renderPricingPackages(DEFAULT_CHARACTER_PACKS, gridEl);
  }

  // Keep usage strip in sync when credits refresh
  const prevUpdate = global.updateDropdownUI;
  global.updateDropdownUI = function (user) {
    if (typeof prevUpdate === 'function') prevUpdate(user);
    refreshUsageStrip();
  };

  SL.pricingPackages = {
    DEFAULT_CHARACTER_PACKS,
    formatCharacterCount,
    renderPricingPackages,
    purchaseCharacterPack,
    purchaseCustomAmount,
    loadAndRenderPricingPackages,
    refreshUsageStrip,
    creditsForUsd,
  };
  global.renderPricingPackages = renderPricingPackages;
  global.purchaseCharacterPack = purchaseCharacterPack;
  global.purchaseCustomAmount = purchaseCustomAmount;
  global.loadAndRenderPricingPackages = loadAndRenderPricingPackages;
})(window);
