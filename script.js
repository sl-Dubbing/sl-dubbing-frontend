// ============================================================
// script.js — sl-Dubbing Frontend (ENHANCED & SECURED)
// ============================================================

// ═══════════════════════════════════════════
// CONFIGURATION (Environment-based)
// ═══════════════════════════════════════════

const CONFIG = {
  // Use environment variable or fallback to current host
  API_BASE: window.API_BASE || `${window.location.protocol}//${window.location.host}/api`,
  
  LANGS: [
    {c:'ar', n:'العربية', f:'🇸🇦'},
    {c:'en', n:'English', f:'🇺🇸'},
    {c:'es', n:'Español', f:'🇪🇸'},
    {c:'fr', n:'Français', f:'🇫🇷'},
    {c:'de', n:'Deutsch', f:'🇩🇪'},
    {c:'it', n:'Italiano', f:'🇮🇹'},
    {c:'ru', n:'Русский', f:'🇷🇺'},
    {c:'tr', n:'Türkçe', f:'🇹🇷'},
    {c:'zh', n:'中文', f:'🇨🇳'},
    {c:'hi', n:'हिन्दी', f:'🇮🇳'},
    {c:'fa', n:'فارسی', f:'🇮🇷'},
    {c:'sv', n:'Svenska', f:'🇸🇪'},
    {c:'nl', n:'Nederlands', f:'🇳🇱'},
  ]
};

const STATE = {
  lang: 'ar',
  voiceMode: 'muhamed',
  srtData: [],
  rawSRT: '',
  selectedVoice: null,
  currentUser: null,
  currentCredits: 0,
};

// ════════════════════════════════════════════════════
// VOICES MAP
// ════════════════════════════════════════════════════

const _VOICES = {
  muhamed:    { mode: 'xtts', voice_id: 'muhammad_ar',   voice_url: 'https://res.cloudinary.com/dxbmvzsiz/video/upload/v1773776198/Muhammad_ar.mp3' },
  dmitry:     { mode: 'xtts', voice_id: 'dmitry_ru',     voice_url: 'https://res.cloudinary.com/dxbmvzsiz/video/upload/v1773776793/Dmitry_ru.mp3' },
  baris:      { mode: 'xtts', voice_id: 'baris_tr',      voice_url: 'https://res.cloudinary.com/dxbmvzsiz/video/upload/v1773776793/Barış_tr.mp3' },
  maximilian: { mode: 'xtts', voice_id: 'maximilian_de', voice_url: 'https://res.cloudinary.com/dxbmvzsiz/video/upload/v1773776975/Maximilian_ge.mp3' },
};

const VOICE_MAP = {
  'source': { mode: 'source', voice_id: 'source', voice_url: null },
  'gtts': { mode: 'gtts', voice_id: null, voice_url: null },
  'muhamed': _VOICES.muhamed,
  'dmitry': _VOICES.dmitry,
  'baris': _VOICES.baris,
  'maximilian': _VOICES.maximilian,
};

// ════════════════════════════════════════════════════
// NETWORK HELPERS
// ════════════════════════════════════════════════════

function apiGet(path, timeout = 15000) {
  const user = JSON.parse(localStorage.getItem('sl_user') || '{}');
  return fetch(CONFIG.API_BASE + path, {
    signal: AbortSignal.timeout(timeout),
    headers: {
      'X-User-Email': user.email || '',
    }
  });
}

function apiPost(path, data, timeout = 600000) {
  const user = JSON.parse(localStorage.getItem('sl_user') || '{}');
  return fetch(CONFIG.API_BASE + path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-User-Email': user.email || '',
    },
    body: JSON.stringify(data),
    signal: AbortSignal.timeout(timeout)
  });
}

// ════════════════════════════════════════════════════
// UI & TOAST NOTIFICATIONS
// ════════════════════════════════════════════════════

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = String(text);
    return div.innerHTML;
}

function showToast(msg, duration = 4000, type = 'info') {
  let t = document.getElementById('toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'toast';
    t.className = 'toast';
    document.body.appendChild(t);
  }
  
  // Add type-based styling
  const bgColor = type === 'error' ? '#ef4444' : type === 'success' ? '#10b981' : '#3b82f6';
  t.style.background = bgColor;
  t.innerHTML = escapeHtml(msg);
  t.classList.add('show');
  
  clearTimeout(t._timeout);
  t._timeout = setTimeout(() => {
    t.classList.remove('show');
  }, duration);
}

// ════════════════════════════════════════════════════
// HEADER & USER MANAGEMENT
// ════════════════════════════════════════════════════

function initHeader() {
  const hdr = document.getElementById('hdr');
  if (!hdr) return;
  
  try {
    const u = JSON.parse(localStorage.getItem('sl_user'));
    if (u && u.email) {
      STATE.currentUser = u;
      STATE.currentCredits = u.credits || 0;
      
      hdr.innerHTML = `
        <div class="header-user" style="display:flex; align-items:center; gap:12px; padding:8px 16px; background:#f3f4f6; border-radius:10px;">
          <div class="avatar" style="width:32px;height:32px;border-radius:50%;background:#0f0f10;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;">${u.avatar || '👤'}</div>
          <div style="flex:1;">
            <div style="font-weight:600;font-size:0.9rem;">${escapeHtml(u.name || u.email)}</div>
            <div style="font-size:0.8rem;color:#6b7280;">💰 ${u.credits || 0} أرصدة</div>
          </div>
          <button class="btn-logout" onclick="logout()" style="padding:6px 12px;font-size:0.8rem;background:#fee2e2;border:1px solid #fca5a5;color:#ef4444;border-radius:6px;cursor:pointer;font-weight:600;">خروج</button>
        </div>
      `;
    } else {
      hdr.innerHTML = '<a href="login.html" class="btn-login" style="padding:8px 16px;font-size:0.85rem;background:#0f0f10;color:#fff;border:none;border-radius:8px;cursor:pointer;text-decoration:none;font-weight:600;">تسجيل الدخول</a>';
    }
  } catch(e) {
    console.error('Header init error:', e);
    hdr.innerHTML = '<a href="login.html" class="btn-login">تسجيل الدخول</a>';
  }
}

function logout() {
  if (confirm('هل تريد تسجيل الخروج؟')) {
    localStorage.removeItem('sl_user');
    window.location.href = 'index.html';
  }
}

async function checkServer() {
  const dot = document.getElementById('dot');
  const lbl = document.getElementById('dotLbl');
  if (!dot) return;
  
  try {
    const r = await apiGet('/health', 8000);
    const data = await r.json();
    
    if (r.ok && data.status === 'ok') {
      dot.classList.add('on');
      if (lbl) lbl.textContent = '✓ النظام متصل';
    } else {
      throw new Error('Health check failed');
    }
  } catch(e) {
    console.error('❌ Server check failed:', e);
    dot.classList.remove('on');
    dot.style.background = '#ef4444';
    if (lbl) lbl.textContent = '✗ النظام غير متاح';
  }
}

// ════════════════════════════════════════════════════
// LANGUAGE & VOICE SELECTION
// ════════════════════════════════════════════════════

function initLangs() {
  const el = document.getElementById('langGrid');
  if (!el) return;
  
  el.innerHTML = CONFIG.LANGS.map(l => 
    `<div class="lang-box ${l.c === STATE.lang ? 'active' : ''}" onclick="selectLang('${l.c}', this)" style="cursor:pointer;padding:10px;border:1px solid #e5e7eb;border-radius:10px;text-align:center;transition:all 0.2s;${l.c === STATE.lang ? 'border-color:#0f0f10;background:#a4fec4;' : ''}">
        <span style="font-size:1.2rem;display:block;margin-bottom:4px;">${l.f}</span>
        <span style="font-size:0.85rem;">${l.n}</span>
     </div>`
  ).join('');
}

function selectLang(code, btn) {
  STATE.lang = code;
  document.querySelectorAll('.lang-box').forEach(b => {
    b.style.borderColor = '#e5e7eb';
    b.style.background = '#fff';
    b.style.fontWeight = 'normal';
  });
  btn.style.borderColor = '#0f0f10';
  btn.style.background = '#a4fec4';
  btn.style.fontWeight = '700';
  console.log('🌍 Language selected:', code);
}

function updateVoiceSelection(mode) {
  STATE.voiceMode = mode;
  STATE.selectedVoice = VOICE_MAP[mode] || VOICE_MAP['muhamed'];
  console.log('🎤 Voice selected:', mode, STATE.selectedVoice.voice_id);
}

const originalSelectVoice = window.selectVoice;
window.selectVoice = function(id, el) {
  if(originalSelectVoice) originalSelectVoice(id, el);
  updateVoiceSelection(id);
};

// ════════════════════════════════════════════════════
// SRT FILE HANDLING
// ════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {
  const srtFileInput = document.getElementById('srtFile');
  if(srtFileInput) {
    srtFileInput.addEventListener('change', loadSRTFile);
  }
});

function loadSRTFile(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  // Validate file type
  if (!file.name.endsWith('.srt') && !file.name.endsWith('.txt')) {
    showToast('❌ يرجى رفع ملف SRT أو TXT فقط', 4000, 'error');
    event.target.value = '';
    return;
  }
  
  // Validate file size (max 5MB)
  if (file.size > 5 * 1024 * 1024) {
    showToast('❌ حجم الملف كبير جداً (الحد الأقصى 5 MB)', 4000, 'error');
    event.target.value = '';
    return;
  }
  
  const reader = new FileReader();
  reader.onload = function(e) {
    STATE.rawSRT = e.target.result;
    parseSRT(STATE.rawSRT);
    
    const zone = document.getElementById('srtZone');
    if(zone) {
      zone.classList.add('ok');
      zone.innerHTML = `
        <i class="fas fa-check-circle" style="color:#059669; font-size:1.8rem; margin-bottom:8px;"></i>
        <div style="color:#059669; font-weight:700;">✓ تم استلام: ${escapeHtml(file.name)}</div>
        <div style="font-size:0.75rem;color:#059669;margin-top:5px;">(${STATE.srtData.length} مقطع زمني)</div>
      `;
    }
    
    showToast(`✓ تم تحميل ${STATE.srtData.length} مقطع من الترجمة`, 3000, 'success');
  };
  
  reader.onerror = function() {
    showToast('❌ خطأ في قراءة الملف', 4000, 'error');
  };
  
  reader.readAsText(file);
}

function parseSRT(content) {
  STATE.srtData = [];
  let cur = null;
  const lines = content.split('\n');
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) { 
      if (cur) STATE.srtData.push(cur); 
      cur = null; 
      continue; 
    }
    if (/^\d+$/.test(line)) { 
      if (cur) STATE.srtData.push(cur); 
      cur = {i: parseInt(line), t: '', x: ''}; 
    }
    else if (line.includes('-->')) { 
      if (cur) cur.t = line; 
    }
    else if (cur) { 
      cur.x += line + ' '; 
    }
  }
  if (cur) STATE.srtData.push(cur);
  
  console.log(`✅ Parsed ${STATE.srtData.length} subtitle blocks`);
}

// ════════════════════════════════════════════════════
// MAIN DUBBING FUNCTION
// ════════════════════════════════════════════════════

window.startDubbing = async function() {
  // Validate user is logged in
  if (!STATE.currentUser || !STATE.currentUser.email) {
    showToast('⚠️ يرجى تسجيل الدخول أولاً', 4000, 'error');
    setTimeout(() => window.location.href = 'login.html', 2000);
    return;
  }
  
  // Validate SRT file
  if (!STATE.srtData.length) { 
    showToast('⚠️ الرجاء رفع ملف الترجمة (SRT) أولاً', 4000, 'error'); 
    return; 
  }
  
  const btn = document.getElementById('startBtn');
  const progArea = document.getElementById('progressArea');
  const progBar = document.getElementById('progBar');
  const pctTxt = document.getElementById('pctTxt');
  const statusTxt = document.getElementById('statusTxt');
  
  // UI state
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري المعالجة...';
  progArea.style.display = 'block';
  progBar.style.width = '0%';
  statusTxt.innerText = 'تهيئة المحرك الصوتي...';
  
  const fullText = STATE.srtData.map(item => item.x.trim()).join('\n');
  const textLength = fullText.length;
  
  // Check credits
  if (STATE.currentCredits < textLength) {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-bolt"></i> ابدأ معالجة الدبلجة';
    progArea.style.display = 'none';
    showToast(`⚠️ رصيدك غير كافٍ: تحتاج ${textLength} أرصدة، لديك ${STATE.currentCredits}`, 6000, 'error');
    return;
  }
  
  // Progress bar animation
  let p = 0;
  const iv = setInterval(() => {
    p = Math.min(p + 1.2, 88);
    progBar.style.width = p + '%';
    pctTxt.innerText = Math.floor(p) + '%';
    if(p > 20) statusTxt.innerText = 'الذكاء الاصطناعي يولد الصوت الآن...';
    if(p > 50) statusTxt.innerText = 'جاري دمج الصوت مع التوقيت الزمني...';
    if(p > 80) statusTxt.innerText = 'اللمسات النهائية، يرجى الانتظار...';
  }, 1000);

  try {
    const voiceData = STATE.selectedVoice || VOICE_MAP['muhamed'];
    const ytInput = document.getElementById('ytUrl');
    const mediaUrl = ytInput ? ytInput.value.trim() : null;

    if (voiceData.mode === 'source' && !mediaUrl) {
      throw new Error("يجب وضع رابط يوتيوب لاستنساخ صوت المصدر");
    }

    const payload = {
      text: fullText,
      srt: STATE.rawSRT,
      lang: STATE.lang,
      email: STATE.currentUser.email,
      voice_mode: voiceData.mode,
      voice_id: voiceData.voice_id,
      voice_url: voiceData.voice_url,
      media_url: mediaUrl
    };

    console.log('🚀 Sending to Backend:', {
      email: payload.email,
      lang: payload.lang,
      voice_mode: payload.voice_mode,
      text_length: textLength
    });

    const res = await apiPost('/dub', payload);
    clearInterval(iv);
    
    const d = await res.json();
    console.log('📦 Server Response:', d);

    if (!res.ok || !d.success) {
      throw new Error(d.error || 'خطأ من السيرفر');
    }

    // Success!
    progBar.style.width = '100%';
    pctTxt.innerText = '100%';
    statusTxt.innerText = 'اكتملت المعالجة بنجاح! ✨';
    
    // Update user credits
    if (d.remaining_credits !== undefined) {
      STATE.currentCredits = d.remaining_credits;
      STATE.currentUser.credits = d.remaining_credits;
      localStorage.setItem('sl_user', JSON.stringify(STATE.currentUser));
      initHeader();
    }
    
    setTimeout(() => {
      progArea.style.display = 'none';
      document.getElementById('resCard').style.display = 'block';
      
      const aud = document.getElementById('dubAud');
      const dl = document.getElementById('dlBtn');
      
      aud.src = d.audio_url;
      dl.href = d.audio_url;
      
      showToast('🎉 الدبلجة جاهزة للتحميل!', 5000, 'success');
    }, 1500);

  } catch(e) {
    clearInterval(iv);
    console.error('❌ Dubbing Error:', e);
    progBar.style.backgroundColor = '#ef4444';
    statusTxt.innerText = 'حدث خطأ!';
    showToast('❌ عذراً: ' + e.message, 6000, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-bolt"></i> ابدأ معالجة الدبلجة';
  }
};

// ════════════════════════════════════════════════════
// INITIALIZATION
// ════════════════════════════════════════════════════

window.onload = function() {
  console.log('🚀 sl-Dubbing Frontend Loaded');
  console.log('📡 API Base:', CONFIG.API_BASE);
  
  initHeader();
  initLangs();
  checkServer();
  updateVoiceSelection('muhamed');
};
