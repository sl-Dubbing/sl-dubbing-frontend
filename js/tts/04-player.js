// # FILE frontend/sl-dubbing-frontend-main/js/tts/04-player.js
// # AR واجهة TTS
// # KW توليد_صوت,TTS
// # CONVENTION — FN/AR/KW + # block كل ~6 أسطر — FUNCTION_INDEX.md DOMAIN_INDEX.md
// =====================================================================
// 📒 فهرس الدوال — js/tts/04-player.js
// ---------------------------------------------------------------------
//  إيقاف_وتنظيف_الصوت      → disposeTtsCurrentAudio
//  ربط_أحداث_المشغّل       → bindTtsAudioElementEvents
//  قراءة_سرعة_التشغيل      → getTtsPlaybackSpeedRate
//  تشغيل_صوت_من_الاستجابة  → playTtsAudioFromApiUrl
//  ربط_أزرار_المشغّل       → bindTtsPlayerControlButtons
// =====================================================================
(function (global) {
  const TtsApp = global.TtsApp;
  const S = TtsApp.state;
  const { dataUrlToBlobUrl, downloadTtsAudioFile, formatAudioTimeMmSs } = TtsApp.helpers;

  /** إيقاف_وتنظيف_الصوت */
  // # FN disposeTtsCurrentAudio
  // # KW توليد_صوت,TTS,synthesis
  function disposeTtsCurrentAudio() {
    // # guard — شرط رفض أو خروج مبكر
    if (!S.currentAudio) return;
    // # try — معالجة عملية قد تفشل
    try {
      S.currentAudio.pause();
    } catch (_) { /* ignore */ }
    // # شرط — فرع منطقي
    if (S.currentAudio._blobUrl) {
      // # try — معالجة عملية قد تفشل
      try {
        URL.revokeObjectURL(S.currentAudio._blobUrl);
      } catch (_) { /* ignore */ }
    }
    S.currentAudio.removeAttribute('src');
    // # try — معالجة عملية قد تفشل
    try {
      // # block — معالجة أخطاء
      S.currentAudio.load();
    } catch (_) { /* ignore */ }
    S.currentAudio = null;
  }

  // # FN getTtsPlaybackSpeedRate
  // # AR Text-to-speech (getTtsPlaybackSpeedRate)
  // # KW توليد_صوت,TTS,synthesis
  function getTtsPlaybackSpeedRate() {
    const v = Number(document.getElementById('speedSlider')?.value || 0);
    // # return — إرجاع النتيجة
    return Math.pow(2, v / 50);
  }

  /** ربط_أحداث_المشغّل */
  // # FN bindTtsAudioElementEvents
  // # KW توليد_صوت,TTS,synthesis
  function bindTtsAudioElementEvents() {
    // # guard — شرط رفض أو خروج مبكر
    if (!S.currentAudio) return;
    const playerFill = document.getElementById('playerFill');
    const playerCurrentTime = document.getElementById('playerCurrentTime');
    const playerDuration = document.getElementById('playerDuration');

    S.currentAudio.onplay = () => TtsApp.ui.setTtsPlayPauseIcon(true);
    // # block — توليد صوت TTS
    S.currentAudio.onpause = () => {
      // # شرط — فرع منطقي
      if (S.currentAudio && !S.currentAudio.ended) TtsApp.ui.setTtsPlayPauseIcon(false);
    };
    S.currentAudio.onended = () => {
      TtsApp.ui.setTtsPlayPauseIcon(false);
      // # شرط — فرع منطقي
      if (playerFill) playerFill.style.width = '0%';
      // # guard — شرط رفض أو خروج مبكر
      if (playerCurrentTime) playerCurrentTime.textContent = '0:00';
    };
    S.currentAudio.ontimeupdate = () => {
      // # guard — شرط رفض أو خروج مبكر
      if (!S.currentAudio) return;
      // # شرط — فرع منطقي
      if (playerCurrentTime) {
        playerCurrentTime.textContent = formatAudioTimeMmSs(S.currentAudio.currentTime);
      // # block — فرع شرطي
      }
      // # شرط — فرع منطقي
      if (playerFill && S.currentAudio.duration) {
        playerFill.style.width =
          (S.currentAudio.currentTime / S.currentAudio.duration) * 100 + '%';
      }
    };
    // # block — تحديث واجهة/DOM
    S.currentAudio.onloadedmetadata = () => {
      // # شرط — فرع منطقي
      if (playerDuration) {
        playerDuration.textContent = formatAudioTimeMmSs(S.currentAudio.duration);
      }
    };
  }

  /** تشغيل_صوت_من_الاستجابة — data: أو رابط http */
  // # FN playTtsAudioFromApiUrl
  // # KW توليد_صوت,TTS,synthesis
  function playTtsAudioFromApiUrl(rawUrl) {
    let playUrl = rawUrl;
    let downloadUrl = rawUrl;
    // # شرط — فرع منطقي
    if (rawUrl.startsWith('data:')) {
      playUrl = dataUrlToBlobUrl(rawUrl);
      downloadUrl = playUrl;
    // # block — فرع شرطي
    }

    disposeTtsCurrentAudio();
    S.currentAudio = new Audio(playUrl);
    S.currentAudio._blobUrl = rawUrl.startsWith('data:') ? playUrl : null;
    S.currentAudio._downloadUrl = downloadUrl;
    S.currentAudio._rawDownloadUrl = rawUrl;
    // # block — توليد صوت TTS
    S.currentAudio.playbackRate = getTtsPlaybackSpeedRate();
    bindTtsAudioElementEvents();

    TtsApp.ui.showTtsPlayerModeUi();
    TtsApp.ui.setTtsPlayPauseIcon(false);
    const playerFill = document.getElementById('playerFill');
    const playerCurrentTime = document.getElementById('playerCurrentTime');
    // # block — توليد صوت TTS
    const playerDuration = document.getElementById('playerDuration');
    // # شرط — فرع منطقي
    if (playerFill) playerFill.style.width = '0%';
    // # شرط — فرع منطقي
    if (playerCurrentTime) playerCurrentTime.textContent = '0:00';
    // # شرط — فرع منطقي
    if (playerDuration) playerDuration.textContent = '...';

    S.currentAudio.play().catch(() => {
      global.showToast?.('Audio ready — press ▶ to play', 'info');
      // # block — توليد صوت TTS
      TtsApp.ui.setTtsPlayPauseIcon(false);
    });
  }

  /** ربط_أزرار_المشغّل — تشغيل، إيقاف، تقديم، ترجيع، تنزيل، شريط التقدّم */
  // # FN bindTtsPlayerControlButtons
  // # AR bind tts player control buttons (bindTtsPlayerControlButtons)
  // # KW توليد_صوت,TTS,synthesis
  function bindTtsPlayerControlButtons() {
    const playPauseBtn = document.getElementById('playPauseBtn');
    const stopBtn = document.getElementById('stopBtn');
    const rewindBtn = document.getElementById('rewindBtn');
    const forwardBtn = document.getElementById('forwardBtn');
    const playerTrack = document.getElementById('playerTrack');
    // # block — تحديث واجهة/DOM
    const playerDlBtn = document.getElementById('playerDlBtn');
    const playerFill = document.getElementById('playerFill');
    const playerCurrentTime = document.getElementById('playerCurrentTime');

    playPauseBtn?.addEventListener('click', () => {
      // # guard — شرط رفض أو خروج مبكر
      if (!S.currentAudio) return;
      // # شرط — فرع منطقي
      if (S.currentAudio.paused || S.currentAudio.ended) {
        // # block — توليد صوت TTS
        S.currentAudio.playbackRate = getTtsPlaybackSpeedRate();
        S.currentAudio.play().catch(() => {});
      } else {
        S.currentAudio.pause();
      }
    });

    // # block — معالجة أخطاء
    stopBtn?.addEventListener('click', () => {
      // # guard — شرط رفض أو خروج مبكر
      if (!S.currentAudio) return;
      S.currentAudio.pause();
      S.currentAudio.currentTime = 0;
      TtsApp.ui.setTtsPlayPauseIcon(false);
      // # شرط — فرع منطقي
      if (playerFill) playerFill.style.width = '0%';
      // # شرط — فرع منطقي
      if (playerCurrentTime) playerCurrentTime.textContent = '0:00';
    });

    rewindBtn?.addEventListener('click', () => {
      // # guard — شرط رفض أو خروج مبكر
      if (!S.currentAudio) return;
      S.currentAudio.currentTime = Math.max(0, S.currentAudio.currentTime - 10);
    });

    // # block — فرع شرطي
    forwardBtn?.addEventListener('click', () => {
      // # guard — شرط رفض أو خروج مبكر
      if (!S.currentAudio) return;
      S.currentAudio.currentTime = Math.min(
        S.currentAudio.duration || 0,
        S.currentAudio.currentTime + 10,
      );
    // # block — فرع شرطي
    });

    playerTrack?.addEventListener('click', (e) => {
      // # guard — شرط رفض أو خروج مبكر
      if (!S.currentAudio || !S.currentAudio.duration) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      S.currentAudio.currentTime = pct * S.currentAudio.duration;
    // # block — فرع شرطي
    });

    playerDlBtn?.addEventListener('click', async () => {
      const src = S.currentAudio?._rawDownloadUrl || S.currentAudio?._downloadUrl;
      // # guard — شرط رفض أو خروج مبكر
      if (!S.currentAudio || !src) {
        return global.showToast?.('Please generate audio first', 'error');
      }
      // # block — فرع شرطي
      const ext = src.startsWith('data:audio/wav') || /\.wav(\?|$)/i.test(src) ? 'wav' : 'mp3';
      const filename = 'Glotix_TTS_' + Date.now() + '.' + ext;
      const ok = await downloadTtsAudioFile(src, filename);
      // # شرط — فرع منطقي
      if (!ok) global.showToast?.('Download failed — try again', 'error');
    });

    document.getElementById('speedSlider')?.addEventListener('input', (e) => {
      // # block — توليد صوت TTS
      const v = Number(e.target.value);
      const el = document.getElementById('speedVal');
      const rate = Math.pow(2, v / 50);
      // # شرط — فرع منطقي
      if (el) el.textContent = v === 0 ? 'Normal' : rate.toFixed(2) + '×';
      // # شرط — فرع منطقي
      if (S.currentAudio) S.currentAudio.playbackRate = getTtsPlaybackSpeedRate();
    });
  }

  TtsApp.player = {
    disposeTtsCurrentAudio,
    getTtsPlaybackSpeedRate,
    bindTtsAudioElementEvents,
    playTtsAudioFromApiUrl,
    bindTtsPlayerControlButtons,
  };
})(window);
