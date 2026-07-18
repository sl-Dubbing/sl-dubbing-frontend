// # FILE frontend/sl-dubbing-frontend-main/js/dubbing/11-upload-r2.js
// # AR واجهة الدبلجة — رفع، Start، polling، أصوات
// # KW رفع,upload
// # CONVENTION — FN/AR/KW + # block كل ~6 أسطر — FUNCTION_INDEX.md DOMAIN_INDEX.md
// dubbing/11-upload-r2.js — R2 presigned or Go direct streaming upload
(function (global) {
  const DubbingApp = global.DubbingApp;

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
      xhr.open('PUT', url, true);
      xhr.setRequestHeader('Content-Type', contentType || 'application/octet-stream');
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
      xhr.onerror = () => reject(new Error('Network Error during upload'));
      xhr.send(file);
    });
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
    // # block — رفع أو تخزين ملف
    return uploadMediaFileToR2PresignedUrl(uploadUrl, file, file.type, authHeaders);
  }

  DubbingApp.upload = {
    computeMaxDubbingUploadBytes,
    uploadMediaFileToR2PresignedUrl,
    uploadMediaFileFromUploadUrlResponse,
  };

  global.dubbingMaxUploadBytes = computeMaxDubbingUploadBytes;
  global.uploadToR2 = uploadMediaFileToR2PresignedUrl;
})(window);
