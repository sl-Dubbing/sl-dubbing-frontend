// ============================================================
// script.js — sl-Dubbing Frontend (Production Version)
// ============================================================

const CONFIG = {
  // ✅ رابط سيرفرك المليوني الجديد على Railway
  API_BASE: 'https://web-production-14a1.up.railway.app', 
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
};

// ── الأصوات المخصصة (XTTS) ──
const _VOICES = {
  muhamed:    { mode: 'xtts', voice_id: 'muhammad_ar',   voice_url: 'https://res.cloudinary.com/dxbmvzsiz/video/upload/v1773776198/Muhammad_ar.mp3' },
  dmitry:     { mode: 'xtts', voice_id: 'dmitry_ru',     voice_url: 'https://res.cloudinary.com/dxbmvzsiz/video/upload/v1773776793/Dmitry_ru.mp3' },
  baris:      { mode: 'xtts', voice_id: 'baris_tr',      voice_url: 'https://res.cloudinary.com/dxbmvzsiz/video/upload/v1773776793/Barış_tr.mp3' },
  maximilian: { mode: 'xtts', voice_id: 'maximilian_de', voice_url: 'https://res.cloudinary.com/dxbmvzsiz/video/upload/v1773776975/Maximilian_ge.mp3' },
};

// ── خريطة جميع الأصوات (بما فيها صوت المصدر) ──
const VOICE_MAP = {
  'source': { mode: 'source', voice_id: 'source', voice_url: null }, 
  'gtts': { mode: 'gtts', voice_id: null, voice_url: null },
  'muhamed': _VOICES.muhamed,
  'dmitry': _VOICES.dmitry,
  'baris': _VOICES.baris,
  'maximilian': _VOICES.maximilian,
};

// ============================================================================
// Network Helpers (Fetch with long timeout for heavy AI tasks)
// ============================================================================

function apiGet(path, timeout) {
  return fetch(CONFIG.API_BASE + path, {
    signal: AbortSignal.timeout(timeout || 15000)
  });
}

function apiPost(path, data, timeout) {
  return fetch(CONFIG.API_BASE + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
    // 10 دقائق كحد أقصى لعمليات الدبلجة الثقيلة
    signal: AbortSignal.timeout(timeout || 600000) 
  });
}

// ============================================================================
// UI & Toasts
// ============================================================================

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = String(text);
    return div.innerHTML;
}

function showToast(msg, duration = 4000) {
  let t = document.getElementById('toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'toast';
    t.className = 'toast';
    document.body.appendChild(t);
  }
  t.innerHTML = escapeHtml(msg);
  t.classList.add('show');
  
  clearTimeout(t._t);
  t._t = setTimeout(() => {
    t.classList.remove('show');
  }, duration);
}

function initHeader() {
  const hdr = document.getElementById('hdr');
  if (!hdr) return;
  try {
    const u = JSON.parse(localStorage.getItem('sl_user'));
    if (u) {
      hdr.innerHTML = `<div class="pill" style="background:var(--card); color:var(--text); border-color:var(--border);">
                          <div class="avatar" style="width:24px;height:24px;font-size:10px;">${u.avatar || '👤'}</div>
                          <span class="username" style="font-weight:600;margin:0 5px;">${u.name || u.email}</span>
                          <span style="color:#059669; font-weight:700; margin:0 5px;">${u.credits || 0} 🪙</span>
                          <button class="btn-logout" onclick="logout()" style="padding:2px 8px;font-size:10px;">خروج</button>
                       </div>`;
    } else {
      hdr.innerHTML = '<a href="login.html" class="btn-login" style="padding:6px 14px;font-size:.8rem;">تسجيل الدخول</a>';
    }
  } catch(e) {
    hdr.innerHTML = '<a href="login.html" class="btn-login">تسجيل الدخول</a>';
  }
}

function logout() {
  localStorage.removeItem('sl_user');
  location.href = 'index.html';
}

async function checkServer() {
  const dot = document.getElementById('dot');
  const lbl = document.getElementById('dotLbl');
  if (!dot) return;
  
  try {
    const r = await apiGet('/api/health', 8000);
    if (r.ok) {
        dot.classList.add('on');
        if (lbl) lbl.textContent = 'النظام متصل ✓';
    } else {
        throw new Error("Server not OK");
    }
  } catch(e) {
    console.error('❌ Server check failed:', e);
    dot.classList.remove('on');
    dot.style.background = '#ef4444';
    if (lbl) lbl.textContent = 'النظام غير متاح';
  }
}

// ============================================================================
// Setup Selections (Languages & Voices)
// ============================================================================

function initLangs() {
  const el = document.getElementById('langGrid');
  if (!el) return;
  el.innerHTML = CONFIG.LANGS.map(l => 
    `<div class="lang-box ${l.c === STATE.lang ? 'active' : ''}" onclick="selectLang('${l.c}', this)">
        <span class="lang-flag" style="font-size:1.2rem;display:block;margin-bottom:4px;">${l.f}</span>
        <span>${l.n}</span>
     </div>`
  ).join('');
}

window.selectLang = function(code, btn) {
  STATE.lang = code;
  document.querySelectorAll('.lang-box').forEach(b => b.classList.remove('active'));
  if(btn) btn.classList.add('active');
};

function updateVoiceSelection(mode) {
  STATE.voiceMode = mode;
  STATE.selectedVoice = VOICE_MAP[mode] || VOICE_MAP['muhamed'];
  console.log('🎤 Voice Set:', mode);

  if (STATE.selectedVoice && STATE.selectedVoice.voice_url && CONFIG.API_BASE) {
    // إيقاظ السيرفر لتحميل الصوت مسبقاً وتسريع العملية لاحقاً
    apiPost('/api/preload_voice', { 
        voice_id: STATE.selectedVoice.voice_id, 
        voice_url: STATE.selectedVoice.voice_url 
    }, 120000).catch(e => console.log('Preload skipped.'));
  }
}

// دمج اختيار الصوت مع HTML
const originalSelectVoice = window.selectVoice;
window.selectVoice = function(id, el) {
    if(originalSelectVoice) originalSelectVoice(id, el);
    updateVoiceSelection(id);
};

// ============================================================================
// SRT Handling
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
    const srtFileInput = document.getElementById('srtFile');
    if(srtFileInput) {
        srtFileInput.addEventListener('change', loadSRTFile);
    }
});

function loadSRTFile(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  if (!file.name.endsWith('.srt') && !file.name.endsWith('.txt')) {
      showToast('❌ يرجى رفع ملف بصيغة SRT أو TXT فقط', 4000);
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
        zone.innerHTML = `<i class="fas fa-check-circle" style="color:#059669; font-size:1.8rem; margin-bottom:8px;"></i>
                          <div class="srt-lbl" style="color:#059669; font-weight:700;">تم استلام: ${escapeHtml(file.name)}</div>
                          <div style="font-size:.75rem;color:#059669;margin-top:5px;">(${STATE.srtData.length} مقطع زمني)</div>`;
    }
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
}

// ============================================================================
// Core Dubbing Execution
// ============================================================================

window.startDubbing = async function() {
  if (!STATE.srtData.length) { 
      showToast('⚠️ الرجاء رفع ملف الترجمة (SRT) أولاً', 4000); 
      return; 
  }
  
  const user = JSON.parse(localStorage.getItem('sl_user'));
  if (!user) {
      showToast('⚠️ يرجى تسجيل الدخول للبدء بالدبلجة', 4000);
      setTimeout(() => window.location.href = 'login.html', 2000);
      return;
  }

  const btn = document.getElementById('startBtn');
  const progArea = document.getElementById('progressArea');
  const progBar = document.getElementById('progBar');
  const pctTxt = document.getElementById('pctTxt');
  const statusTxt = document.getElementById('statusTxt');
  
  // تفعيل واجهة التحميل
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري المعالجة السحابية...';
  progArea.style.display = 'block';
  progBar.style.width = '0%';
  statusTxt.innerText = 'تهيئة المحرك الصوتي...';
  
  const fullText = STATE.srtData.map(item => item.x.trim()).join('\n');
  
  // محاكاة تقدم وهمي لكسر الملل أثناء معالجة الباك إند
  let p = 0;
  const iv = setInterval(() => {
    p = Math.min(p + 1.2, 88); 
    progBar.style.width = p + '%';
    pctTxt.innerText = Math.floor(p) + '%';
    if(p > 20) statusTxt.innerText = 'الذكاء الاصطناعي يولد الصوت الآن...';
    if(p > 50) statusTxt.innerText = 'جاري دمج الصوت مع التوقيت الزمني (SRT)...';
    if(p > 80) statusTxt.innerText = 'اللمسات النهائية، يرجى الانتظار...';
  }, 1000);

  try {
    const voiceData = STATE.selectedVoice || VOICE_MAP['muhamed'];
    const ytInput = document.getElementById('ytUrl');
    const mediaUrl = ytInput ? ytInput.value.trim() : null;

    if (voiceData.mode === 'source' && !mediaUrl) {
        throw new Error("يجب وضع رابط يوتيوب لاستنساخ صوت المصدر.");
    }

    const payload = {
      text: fullText,
      srt: STATE.rawSRT,
      lang: STATE.lang,
      email: user.email,
      voice_mode: voiceData.mode,
      voice_id: voiceData.voice_id,
      voice_url: voiceData.voice_url,
      media_url: mediaUrl 
    };

    console.log('🚀 Sending to Railway Server:', payload);

    const res = await apiPost('/api/dub', payload);
    clearInterval(iv);
    
    const d = await res.json();
    console.log('📦 Server Response:', d);

    if (!res.ok || !d.success) {
        throw new Error(d.error || 'خطأ غير معروف من السيرفر');
    }

    // النجاح
    progBar.style.width = '100%';
    pctTxt.innerText = '100%';
    statusTxt.innerText = 'اكتملت المعالجة بنجاح! ✨';
    
    // تحديث رصيد المستخدم محلياً
    if (d.remaining_credits !== undefined) {
        user.credits = d.remaining_credits;
        localStorage.setItem('sl_user', JSON.stringify(user));
        initHeader(); // تحديث الرصيد في الأعلى
    }
    
    setTimeout(() => {
        progArea.style.display = 'none';
        document.getElementById('resCard').style.display = 'block';
        
        const aud = document.getElementById('dubAud');
        const dl = document.getElementById('dlBtn');
        
        aud.src = d.audio_url;
        dl.href = d.audio_url;
        
        showToast('🎉 الدبلجة جاهزة للتحميل!', 5000);
    }, 1500);

  } catch(e) {
    clearInterval(iv);
    console.error('❌ Dubbing Error:', e);
    progBar.style.backgroundColor = '#ef4444'; 
    statusTxt.innerText = 'حدث خطأ!';
    showToast('❌ عذراً: ' + e.message, 6000);
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-bolt"></i> ابدأ معالجة الدبلجة';
  }
};

// ============================================================================
// Initialization on Load
// ============================================================================

window.onload = function() {
  console.log('🚀 sl-Dubbing Application Loaded');
  initHeader();
  initLangs();
  checkServer();
  updateVoiceSelection('muhamed');
};
