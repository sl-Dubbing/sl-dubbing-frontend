// # FILE frontend/sl-dubbing-frontend-main/js/dubbing/11-upload-r2.js
// # AR واجهة الدبلجة — رفع، Start، polling، أصوات
// # KW رفع,upload
// # CONVENTION — FN/AR/KW + # block كل ~6 أسطر — FUNCTION_INDEX.md DOMAIN_INDEX.md
// dubbing/11-upload-r2.js — R2 presigned or Go direct streaming upload
(function (global) {
  const DubbingApp = global.DubbingApp;
  const MULTIPART_THRESHOLD_BYTES = 16 * 1024 * 1024;
  const MULTIPART_CHUNK_BYTES = 8 * 1024 * 1024;
  const MULTIPART_CONCURRENCY = 4;

  // # FN computeMaxDubbingUploadBytes
  // # AR رفع الملفات والتخزين (computeMaxDubbingUploadBytes)
  // # KW رفع,upload,R2,storage
  function computeMaxDubbingUploadBytes() {
    const mb = Number(global.APP_CONFIG && global.APP_CONFIG.MAX_UPLOAD_MB);
    // # return — إرجاع النتيجة
    return (mb > 0 ? mb : 500) * 1024 * 1024;
  }

  // # FN uploadMediaFileToR2PresignedUrl
  // # KW رفع,upload,R2,storage
  function uploadMediaFileToR2PresignedUrl(url, file, contentType, authHeaders) {
    // # return — إرجاع النتيجة
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const isDirect = typeof url === 'string' && url.includes('/api/upload/direct');
      const resolvedType =
        (contentType && String(contentType).trim()) ||
        (file && file.type) ||
        'application/octet-stream';
      xhr.open('PUT', url, true);
      xhr.setRequestHeader('Content-Type', resolvedType);
      // # شرط — فرع منطقي
      if (isDirect && authHeaders) {
        // # شرط — فرع منطقي
        if (authHeaders.Authorization) xhr.setRequestHeader('Authorization', authHeaders.Authorization);
        // # شرط — فرع منطقي
        if (authHeaders['X-User-Id']) xhr.setRequestHeader('X-User-Id', authHeaders['X-User-Id']);
      }
      xhr.upload.onprogress = (e) => {
        // # شرط — فرع منطقي
        if (e.lengthComputable) {
          // # block — رفع أو تخزين ملف
          const pct = Math.round((e.loaded / e.total) * 100);
          DubbingApp.ui.updateDubbingProgressBarUi('Uploading File...', 10 + pct * 0.4);
        }
      };
      xhr.onload = () =>
        xhr.status >= 200 && xhr.status < 300
          // # block — رفع أو تخزين ملف
          ? resolve()
          : reject(new Error('Storage Upload Failed: HTTP ' + xhr.status));
      xhr.onerror = () =>
        reject(
          new Error(
            'Network Error during upload (R2 blocked the browser response — retry once; if it persists, refresh and sign in again)'
          )
        );
      xhr.send(file);
    });
  }

  async function postMultipartJson(path, payload, authHeaders) {
    const response = await fetch(`${DubbingApp.api.normalizeApiBaseUrl()}${path}`, {
      method: 'POST',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `Multipart upload failed: HTTP ${response.status}`);
    return data;
  }

  function uploadMultipartPart(url, blob, onProgress, attempt = 1) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', url, true);
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) onProgress(event.loaded);
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          onProgress(blob.size);
          resolve();
        } else {
          reject(new Error(`R2 multipart part failed: HTTP ${xhr.status}`));
        }
      };
      xhr.onerror = () => reject(new Error('R2 multipart part network error'));
      xhr.send(blob);
    }).catch(async (error) => {
      if (attempt >= 3) throw error;
      await new Promise((resolve) => setTimeout(resolve, 400 * 2 ** (attempt - 1)));
      return uploadMultipartPart(url, blob, onProgress, attempt + 1);
    });
  }

  // # FN uploadMediaFileResumableToR2
  // # AR Upload once: parallel multipart for medium/large media, direct PUT for small files.
  // # KW رفع,upload,R2,storage,multipart,resume,سرعة
  async function uploadMediaFileResumableToR2(file, authHeaders, options) {
    const opts = options || {};
    const contentType = opts.contentType || file.type || 'application/octet-stream';
    const progressLabel = opts.progressLabel || 'Uploading File (parallel)...';
    const reportProgress = (ratio) => {
      if (typeof opts.onProgress === 'function') {
        opts.onProgress(ratio, Math.round(ratio * file.size), file.size);
        return;
      }
      DubbingApp.ui.updateDubbingProgressBarUi(progressLabel, 10 + ratio * 40);
    };
    if (file.size < MULTIPART_THRESHOLD_BYTES) {
      const response = await fetch(`${DubbingApp.api.normalizeApiBaseUrl()}/api/upload-url`, {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: file.name || opts.filename || 'upload.bin',
          content_type: contentType,
        }),
      });
      const grant = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(grant.error || `upload-url failed: HTTP ${response.status}`);
      await uploadMediaFileFromUploadUrlResponse(grant, file, authHeaders);
      reportProgress(1);
      return grant;
    }

    const session = await postMultipartJson(
      '/api/uploads/multipart/initiate',
      {
        filename: file.name || opts.filename || 'upload.bin',
        content_type: contentType,
        file_size: file.size,
      },
      authHeaders,
    );
    const chunks = [];
    for (let offset = 0, partNumber = 1; offset < file.size; partNumber += 1) {
      const end = Math.min(file.size, offset + MULTIPART_CHUNK_BYTES);
      chunks.push({ partNumber, blob: file.slice(offset, end) });
      offset = end;
    }
    let cursor = 0;
    let completedBytes = 0;
    const activeBytes = new Map();
    const report = () => {
      const active = [...activeBytes.values()].reduce((sum, value) => sum + value, 0);
      const ratio = Math.min(1, (completedBytes + active) / file.size);
      reportProgress(ratio);
    };
    const uploadNext = async () => {
      while (cursor < chunks.length) {
        const chunk = chunks[cursor++];
        const signed = await postMultipartJson(
          '/api/uploads/multipart/part',
          {
            file_key: session.file_key,
            upload_id: session.upload_id,
            part_number: chunk.partNumber,
          },
          authHeaders,
        );
        await uploadMultipartPart(signed.upload_url, chunk.blob, (loaded) => {
          activeBytes.set(chunk.partNumber, loaded);
          report();
        });
        activeBytes.delete(chunk.partNumber);
        completedBytes += chunk.blob.size;
        report();
      }
    };
    try {
      await Promise.all(
        Array.from(
          { length: Math.min(MULTIPART_CONCURRENCY, chunks.length) },
          () => uploadNext(),
        ),
      );
      const completed = await postMultipartJson(
        '/api/uploads/multipart/complete',
        {
          file_key: session.file_key,
          upload_id: session.upload_id,
          parts: [],
        },
        authHeaders,
      );
      return { ...session, ...completed };
    } catch (error) {
      postMultipartJson(
        '/api/uploads/multipart/abort',
        { file_key: session.file_key, upload_id: session.upload_id },
        authHeaders,
      ).catch(() => {});
      throw error;
    }
  }

  /** يرفع الملف عبر presigned R2 أو Go direct stream حسب استجابة upload-url */
  // # FN uploadMediaFileFromUploadUrlResponse
  // # AR رفع media file from رفع url response (uploadMediaFileFromUploadUrlResponse)
  // # KW رفع,upload,R2,storage
  async function uploadMediaFileFromUploadUrlResponse(urlData, file, authHeaders) {
    let uploadUrl = urlData.upload_url;
    // # شرط — فرع منطقي
    if (urlData.use_direct && uploadUrl && !uploadUrl.startsWith('http')) {
      const base = DubbingApp.api.normalizeApiBaseUrl();
      uploadUrl = base + (uploadUrl.startsWith('/') ? uploadUrl : '/' + uploadUrl);
    }
    const contentType =
      (urlData.content_type && String(urlData.content_type).trim()) ||
      (file && file.type) ||
      'application/octet-stream';
    // # block — رفع أو تخزين ملف
    return uploadMediaFileToR2PresignedUrl(uploadUrl, file, contentType, authHeaders);
  }

  DubbingApp.upload = {
    computeMaxDubbingUploadBytes,
    uploadMediaFileToR2PresignedUrl,
    uploadMediaFileFromUploadUrlResponse,
    uploadMediaFileResumableToR2,
  };

  global.dubbingMaxUploadBytes = computeMaxDubbingUploadBytes;
  global.uploadToR2 = uploadMediaFileToR2PresignedUrl;
})(window);
