// # FILE frontend/sl-dubbing-frontend-main/js/shared/theme.js
// # AR Light/dark theme that follows OS + optional user override
(function (global) {
  const STORAGE_KEY = 'glotix_theme'; // system | light | dark

  // # FN resolvePreferredTheme
  // # AR Resolve system / light / dark preference
  // # KW عام,general
  function resolvePreferredTheme() {
    let mode = 'system';
    // # try — عملية قد تفشل
    try {
      mode = localStorage.getItem(STORAGE_KEY) || 'system';
    } catch (_) {}
    // # guard — رفض/خروج
    if (mode === 'light' || mode === 'dark') return mode;
    // # block — تحديث واجهة/DOM
    return global.matchMedia && global.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
  }

  // # FN applyThemeMode
  // # AR Apply theme to <html data-theme>
  // # KW عام,general
  function applyThemeMode(mode) {
    const root = document.documentElement;
    const resolved =
      mode === 'light' || mode === 'dark'
        ? mode
        : resolvePreferredTheme();
    // # block — تنفيذ منطق — راجع الأسطر التالية
    root.setAttribute('data-theme', resolved);
    root.style.colorScheme = resolved;
    return resolved;
  }

  // # FN initThemeFromStorage
  // # AR Boot theme before paint (also call from <head> inline)
  // # KW رفع,upload,R2,storage
  function initThemeFromStorage() {
    let stored = 'system';
    // # try — عملية قد تفشل
    try {
      stored = localStorage.getItem(STORAGE_KEY) || 'system';
    } catch (_) {}
    // # شرط
    if (stored === 'light' || stored === 'dark') {
      // # block — تحديث واجهة/DOM
      applyThemeMode(stored);
    } else {
      const auto = resolvePreferredTheme();
      document.documentElement.setAttribute('data-theme', auto);
      document.documentElement.style.colorScheme = auto;
    }
  }

  // # FN cycleThemeMode
  // # AR Toggle light ↔ dark in one click (no silent system step)
  // # KW عام,general
  function cycleThemeMode() {
    const current =
      document.documentElement.getAttribute('data-theme') ||
      resolvePreferredTheme();
    const next = current === 'dark' ? 'light' : 'dark';
    // # try — عملية قد تفشل
    try {
      // # block — تحديث واجهة/DOM
      localStorage.setItem(STORAGE_KEY, next);
    } catch (_) {}
    applyThemeMode(next);
    return { mode: next, applied: next };
  }

  // # FN bindThemeToggleButton
  // # KW عام,general
  function bindThemeToggleButton(btn) {
    // # guard — رفض/خروج
    if (!btn || btn.dataset.themeBound) return;
    btn.dataset.themeBound = '1';
    btn.addEventListener('click', () => {
      const r = cycleThemeMode();
      btn.setAttribute('aria-label', `Theme: ${r.mode}`);
      // # block — فرع شرطي
      btn.title = `Theme: ${r.mode}`;
    });
  }

  initThemeFromStorage();

  if (global.matchMedia) {
    try {
      global.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
        let stored = 'system';
        try {
          stored = localStorage.getItem(STORAGE_KEY) || 'system';
        } catch (_) {}
        if (stored === 'system') initThemeFromStorage();
      });
    } catch (_) {}
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[data-theme-toggle]').forEach(bindThemeToggleButton);
  });

  global.GlotixTheme = {
    initThemeFromStorage,
    applyThemeMode,
    cycleThemeMode,
    resolvePreferredTheme,
    bindThemeToggleButton,
  };
})(window);
