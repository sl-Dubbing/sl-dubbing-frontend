// # FILE frontend/sl-dubbing-frontend-main/js/dubbing/18-stream-player.js
// # AR واجهة الدبلجة — رفع، Start، polling، أصوات
// # KW عام,general
// # CONVENTION — FN/AR/KW + # block كل ~6 أسطر — FUNCTION_INDEX.md DOMAIN_INDEX.md
// dubbing/18-stream-player.js — Ultra-low-latency streaming audio player
(function (global) {
  const DubbingApp = global.DubbingApp || (global.DubbingApp = {});
  const S = DubbingApp.state || (DubbingApp.state = {});

  let audioCtx = null;
  let scheduledTime = 0;
  let abortController = null;
  let activeSources = new Set();

  const DEFAULT_MIN_LATENCY = 0.05; // seconds

  // # FN ensureAudioContext
  // # KW عام,general
  function ensureAudioContext() {
    // # شرط — فرع منطقي
    if (!audioCtx) {
      audioCtx = new (global.AudioContext || global.webkitAudioContext)();
      scheduledTime = audioCtx.currentTime + DEFAULT_MIN_LATENCY;
    }
    // # return — إرجاع النتيجة
    return audioCtx;
  }

  // # FN concatUint8
  // # AR دالة concatUint8 (concatUint8)
  // # KW عام,general
  function concatUint8(a, b) {
    const out = new Uint8Array(a.length + b.length);
    out.set(a, 0);
    out.set(b, a.length);
    // # return — إرجاع النتيجة
    return out;
  }

  // # FN int16ToFloat32Buffer
  // # AR دالة int16ToFloat32Buffer (int16ToFloat32Buffer)
  // # KW عام,general
  function int16ToFloat32Buffer(int16Buffer) {
    const l = int16Buffer.length / 2;
    const view = new DataView(int16Buffer.buffer, int16Buffer.byteOffset, int16Buffer.byteLength);
    const out = new Float32Array(l / 1);
    for (let i = 0, j = 0; i < int16Buffer.length; i += 2, ++j) {
      const sample = view.getInt16(i, true);
      // # block — معالجة صوت/استنساخ
      out[j] = sample < 0 ? sample / 0x8000 : sample / 0x7fff;
    }
    // # return — إرجاع النتيجة
    return out;
  }

  // # FN scheduleAudioBuffer
  // # KW عام,general
  function scheduleAudioBuffer(audioBuffer) {
    const ctx = ensureAudioContext();
    const src = ctx.createBufferSource();
    src.buffer = audioBuffer;
    src.connect(ctx.destination);
    const now = ctx.currentTime;
    // # شرط — فرع منطقي
    if (scheduledTime < now + 0.02) scheduledTime = now + 0.02;
    // # try — معالجة عملية قد تفشل
    try {
      src.start(scheduledTime);
    } catch (e) {
      // fallback to immediate start
      src.start();
      scheduledTime = ctx.currentTime + audioBuffer.duration;
      // # block — معالجة أخطاء
      activeSources.add(src);
      src.onended = () => activeSources.delete(src);
      // # return — إرجاع النتيجة
      return;
    }
    activeSources.add(src);
    src.onended = () => activeSources.delete(src);
    // # block — تنفيذ منطق — راجع الأسطر التالية
    scheduledTime += audioBuffer.duration;
  }

  // # FN decodeAndScheduleEncoded
  // # AR دالة decodeAndScheduleEncoded (decodeAndScheduleEncoded)
  // # KW عام,general
  async function decodeAndScheduleEncoded(chunkBuffer) {
    const ctx = ensureAudioContext();
    // # try — معالجة عملية قد تفشل
    try {
      const audioBuf = await ctx.decodeAudioData(chunkBuffer.slice(0));
      scheduleAudioBuffer(audioBuf);
      // # return — إرجاع النتيجة
      return true;
    // # block — معالجة أخطاء
    } catch (e) {
      return false;
    }
  }

  // # FN scheduleRawPcm
  // # KW عام,general
  function scheduleRawPcm(chunkUint8, channels = 1, sampleRate = 24000) {
    const ctx = ensureAudioContext();
    // treat chunkUint8 as Int16LE samples
    // # guard — شرط رفض أو خروج مبكر
    if (chunkUint8.length % 2 !== 0) return false;
    const int16 = new Int16Array(chunkUint8.buffer, chunkUint8.byteOffset, chunkUint8.length / 2);
    const float32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) {
      // # block — فرع شرطي
      const s = int16[i];
      float32[i] = s < 0 ? s / 0x8000 : s / 0x7fff;
    }
    const frames = float32.length / channels;
    const audioBuffer = ctx.createBuffer(channels, frames, sampleRate || ctx.sampleRate);
    // # شرط — فرع منطقي
    if (channels === 1) {
      // # block — معالجة صوت/استنساخ
      audioBuffer.copyToChannel(float32, 0);
    } else {
      // naive deinterleave
      for (let ch = 0; ch < channels; ch++) {
        const chData = new Float32Array(frames);
        for (let i = 0; i < frames; i++) chData[i] = float32[i * channels + ch] || 0;
        audioBuffer.copyToChannel(chData, ch);
      // # block — حلقة/تكرار
      }
    }
    scheduleAudioBuffer(audioBuffer);
    // # return — إرجاع النتيجة
    return true;
  }

  // # FN playStream
  // # KW عام,general
  async function playStream(url, { headers = {}, sampleRate = null, channels = 1 } = {}) {
    stop();
    abortController = new AbortController();
    const signal = abortController.signal;
    ensureAudioContext();

    // small UI hook: mark playing when first chunk scheduled
    let firstScheduled = false;

    // # try — معالجة عملية قد تفشل
    try {
      // # HTTP — طلب إلى API
      const res = await fetch(url, { method: 'GET', headers, signal });
      // # guard — شرط رفض أو خروج مبكر
      if (!res.ok) throw new Error('Stream fetch failed: ' + res.status);
      const reader = res.body.getReader();
      let acc = new Uint8Array(0);
      while (true) {
        // # block — طلب HTTP/API
        const { done, value } = await reader.read();
        // # شرط — فرع منطقي
        if (done) break;
        const chunk = value || new Uint8Array(0);
        // try decode as encoded audio first by appending and trying decodeAudioData
        acc = concatUint8(acc, chunk);
        // Try decode the accumulated buffer
        const tried = await decodeAndScheduleEncoded(acc.buffer);
        // # شرط — فرع منطقي
        if (tried) {
          // # block — فرع شرطي
          acc = new Uint8Array(0);
          // # شرط — فرع منطقي
          if (!firstScheduled) {
            firstScheduled = true;
            // # شرط — فرع منطقي
            if (DubbingApp.ui && typeof DubbingApp.ui.updateDubbingProgressBarUi === 'function') {
              DubbingApp.ui.updateDubbingProgressBarUi('Playing', S.progressPercentMonotonic || 0);
            }
          // # block — فرع شرطي
          }
          continue;
        }
        // If decode failed, try treating this chunk as raw PCM (common for low-latency servers)
        const rawOk = scheduleRawPcm(chunk, channels, sampleRate || (audioCtx && audioCtx.sampleRate));
        // # شرط — فرع منطقي
        if (rawOk && !firstScheduled) {
          firstScheduled = true;
          // # شرط — فرع منطقي
          if (DubbingApp.ui && typeof DubbingApp.ui.updateDubbingProgressBarUi === 'function') {
            DubbingApp.ui.updateDubbingProgressBarUi('Playing', S.progressPercentMonotonic || 0);
          }
        }
        // if neither succeeded, keep acc for next iteration (wait for more bytes)
      }
    } catch (err) {
      // # guard — شرط رفض أو خروج مبكر
      if (err && err.name === 'AbortError') return;
      console.error('Streaming audio error', err);
      global.showToast?.('Streaming audio error: ' + (err.message || err), 'error');
      stop();
    }
  }

  // # FN stop
  // # AR إيقاف (stop)
  // # KW عام,general
  function stop() {
    // # شرط — فرع منطقي
    if (abortController) {
      try { abortController.abort(); } catch (e) {}
      abortController = null;
    }
    // stop active sources
    for (const s of Array.from(activeSources)) {
      // # block — معالجة أخطاء
      try { s.stop(); } catch (e) {}
      activeSources.delete(s);
    }
    // close audio context to release resources; new play will create a fresh one
    // # شرط — فرع منطقي
    if (audioCtx) {
      try { audioCtx.close(); } catch (e) {}
      audioCtx = null;
    // # block — معالجة أخطاء
    }
    scheduledTime = 0;
  }

  DubbingApp.streamPlayer = {
    playStream,
    stop,
  };

  global.addEventListener?.('beforeunload', () => { try { stop(); } catch (e) {} });
})(window);
