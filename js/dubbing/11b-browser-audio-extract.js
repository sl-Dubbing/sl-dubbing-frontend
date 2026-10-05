// # FILE frontend/sl-dubbing-frontend-main/js/dubbing/11b-browser-audio-extract.js
// # AR Extract a small compressed mono MP3 in-browser so ASR can start before full video upload
// # KW صوت_معالجة,ffmpeg,WASM,رفع,upload,سرعة,تفريغ
(function (global) {
  const DubbingApp = global.DubbingApp;
  const CORE_BASE = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm';
  const MIN_BYTES = 2 * 1024 * 1024;
  const MAX_BYTES = 768 * 1024 * 1024;

  let ffmpegPromise = null;

  function isVideoFile(file) {
    return (
      !!file &&
      (String(file.type || '').startsWith('video/') ||
        /\.(mp4|mov|webm|mkv|m4v)$/i.test(file.name || ''))
    );
  }

  // # FN shouldExtractAudioForFastPath
  // # AR Prefer browser audio extract for Fast dub when lipsync is off and the file is a video
  // # KW صوت_معالجة,ffmpeg,رفع,upload,سرعة
  function shouldExtractAudioForFastPath(file, options) {
    const opts = options || {};
    if (opts.forceOriginal || opts.enableLipsync) return false;
    if (!isVideoFile(file)) return false;
    const size = Number(file.size) || 0;
    return size >= MIN_BYTES && size <= MAX_BYTES;
  }

  async function loadFfmpeg(onProgress) {
    if (ffmpegPromise) return ffmpegPromise;
    ffmpegPromise = (async () => {
      const [{ FFmpeg }, { toBlobURL }] = await Promise.all([
        import('https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.15/+esm'),
        import('https://cdn.jsdelivr.net/npm/@ffmpeg/util@0.12.2/+esm'),
      ]);
      const ffmpeg = new FFmpeg();
      if (typeof onProgress === 'function') {
        ffmpeg.on('progress', (event) => onProgress(event));
      }
      await ffmpeg.load({
        coreURL: await toBlobURL(`${CORE_BASE}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${CORE_BASE}/ffmpeg-core.wasm`, 'application/wasm'),
      });
      return ffmpeg;
    })().catch((error) => {
      ffmpegPromise = null;
      throw error;
    });
    return ffmpegPromise;
  }

  // # FN extractCompressedAudioBlob
  // # AR Convert selected video to mono 16 kHz 64 kbps MP3 for fast R2 upload and ASR
  // # KW صوت_معالجة,ffmpeg,WASM,تفريغ,سرعة
  async function extractCompressedAudioBlob(file, options) {
    const opts = options || {};
    const { fetchFile } = await import('https://cdn.jsdelivr.net/npm/@ffmpeg/util@0.12.2/+esm');
    const ffmpeg = await loadFfmpeg(opts.onProgress);
    const extension = (file.name || 'bin').split('.').pop()?.replace(/[^a-z0-9]/gi, '') || 'bin';
    const inputName = `input-${Date.now()}.${extension}`;
    const outputName = `audio-${Date.now()}.mp3`;
    await ffmpeg.writeFile(inputName, await fetchFile(file));
    try {
      await ffmpeg.exec([
        '-i',
        inputName,
        '-vn',
        '-ac',
        '1',
        '-ar',
        '16000',
        '-b:a',
        '64k',
        '-c:a',
        'libmp3lame',
        outputName,
      ]);
      const result = await ffmpeg.readFile(outputName);
      if (typeof result === 'string') throw new Error('FFmpeg returned an invalid audio buffer');
      const bytes = Uint8Array.from(result);
      const base = (file.name || 'audio').replace(/\.[^.]+$/, '') || 'audio';
      return new File([bytes], `${base}.mp3`, {
        type: 'audio/mpeg',
        lastModified: Date.now(),
      });
    } finally {
      await Promise.allSettled([ffmpeg.deleteFile(inputName), ffmpeg.deleteFile(outputName)]);
    }
  }

  // # FN prepareFastPathMedia
  // # AR Extract compressed audio when safe; otherwise fall back to uploading the original media
  // # KW صوت_معالجة,ffmpeg,رفع,upload,سرعة
  async function prepareFastPathMedia(file, options) {
    const opts = options || {};
    if (!shouldExtractAudioForFastPath(file, opts)) {
      return { mode: 'original', audioFile: null, originalFile: file };
    }
    opts.onStatus?.('Extracting audio locally…');
    try {
      const audioFile = await extractCompressedAudioBlob(file, {
        onProgress: opts.onProgress,
      });
      opts.onStatus?.(
        `Local audio ready (${Math.max(1, Math.round(audioFile.size / (1024 * 1024)))} MB)`,
      );
      return { mode: 'audio-first', audioFile, originalFile: file };
    } catch (error) {
      console.warn('[fast-path] browser extract failed; uploading original', error);
      opts.onStatus?.('Local extract unavailable — uploading original media…');
      return { mode: 'original', audioFile: null, originalFile: file };
    }
  }

  DubbingApp.browserAudio = {
    shouldExtractAudioForFastPath,
    extractCompressedAudioBlob,
    prepareFastPathMedia,
  };
})(window);
