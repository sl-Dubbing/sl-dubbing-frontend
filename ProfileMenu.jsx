import React, { useState, useEffect, useRef } from 'react';

export default function ProfileMenu({ apiBase }) {
  const [user, setUser] = useState(null);
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileRef = useRef();

  // ممانعة تكرار الكود: دالة موحدة لجلب خيارات الـ Fetch
  const getFetchOptions = (method = 'GET', body = null) => {
    const token = localStorage.getItem('token');
    const options = {
      method,
      credentials: 'include',
      headers: {}
    };
    if (token) options.headers['Authorization'] = `Bearer ${token}`;
    if (body && !(body instanceof FormData)) {
      options.headers['Content-Type'] = 'application/json';
    }
    if (body) options.body = body;
    return options;
  };

  useEffect(() => {
    // جلب بيانات المستخدم عند التحميل
    fetch(`${apiBase}/api/user`, getFetchOptions())
      .then(r => r.json())
      .then(d => { 
        if (d.success) setUser(d.user); 
        else if (d.error === "Unauthorized") setUser(null);
      })
      .catch(err => console.error("Auth check failed:", err));
  }, [apiBase]);

  function handleFileChange(e) {
    const f = e.target.files[0];
    if (!f) return;
    const url = URL.createObjectURL(f);
    setPreview({ file: f, url });
  }

  async function uploadAvatar() {
    if (!preview?.file) return alert('الرجاء اختيار صورة أولاً');
    
    setIsUploading(true);
    const fd = new FormData();
    fd.append('avatar', preview.file);

    try {
      const res = await fetch(`${apiBase}/api/user/avatar`, getFetchOptions('POST', fd));
      const data = await res.json();
      
      if (data.success) {
        setUser(data.user);
        setPreview(null);
        if (fileRef.current) fileRef.current.value = '';
        alert('✅ تم تحديث الصورة الشخصية بنجاح');
      } else {
        alert('❌ فشل التحديث: ' + (data.error || 'خطأ غير معروف'));
      }
    } catch (err) {
      alert('❌ حدث خطأ في الاتصال بالسيرفر');
    } finally {
      setIsUploading(false);
    }
  }

  async function sendEmailWithAvatar() {
    try {
      const res = await fetch(`${apiBase}/api/user/send-avatar-email`, getFetchOptions('POST'));
      const data = await res.json();
      if (data.success) alert('📧 تم إرسال الصورة إلى بريدك الإلكتروني');
      else alert('❌ فشل الإرسال: ' + (data.error || 'خطأ'));
    } catch (err) {
      alert('❌ خطأ في الاتصال');
    }
  }

  async function handleSignOut() {
    try {
      await fetch(`${apiBase}/api/logout`, getFetchOptions('POST'));
    } catch (e) {}
    localStorage.removeItem('token');
    window.location.reload();
  }

  return (
    <div className="profile-menu">
      <button onClick={() => setOpen(!open)} className="profile-btn">
        <img 
          src={user?.avatar || 'https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y'} 
          alt="avatar" 
          className="avatar-sm" 
        />
        <span className="user-name-label">{user?.name || 'My Account'}</span>
      </button>

      {open && (
        <div className="menu-panel animated-fade-in">
          <div className="balance-row">
            <div className="balance-label"><strong>Balance</strong></div>
            <div><button className="upgrade-btn">Upgrade</button></div>
          </div>
          <div className="credits-info">
            <div className="credit-item">Total <span>{user?.total_credits ?? 0}</span></div>
            <div className="credit-item highlight">Remaining <span>{user?.credits ?? 0}</span></div>
          </div>

          <hr className="menu-divider" />

          <ul className="menu-list">
            <li><button onClick={() => window.location.href = '/settings'}><i className="fas fa-cog"></i> Settings</button></li>
            <li><button onClick={() => window.location.href = '/subscription'}><i className="fas fa-credit-card"></i> Subscription</button></li>
            <li><button onClick={() => window.location.href = '/usage'}><i className="fas fa-chart-line"></i> Usage analytics</button></li>
            <li><button onClick={() => window.open('/docs', '_blank')}><i className="fas fa-book"></i> Docs</button></li>
          </ul>

          <hr className="menu-divider" />

          <div className="avatar-upload-section">
            <div className="avatar-preview-container">
              <img src={preview?.url || user?.avatar || 'https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y'} alt="preview" className="avatar-lg" />
            </div>
            <div className="avatar-controls">
              <input ref={fileRef} type="file" id="avatarInput" accept="image/*" onChange={handleFileChange} hidden />
              <label htmlFor="avatarInput" className="btn-outline">Change Photo</label>
              
              {preview && (
                <div className="action-btns">
                  <button onClick={uploadAvatar} className="btn-primary" disabled={isUploading}>
                    {isUploading ? 'Uploading...' : 'Save'}
                  </button>
                  <button onClick={() => { setPreview(null); fileRef.current.value = ''; }} className="btn-muted">Cancel</button>
                </div>
              )}
              
              <button onClick={sendEmailWithAvatar} className="btn-email-link">
                <i className="fas fa-envelope"></i> Send to email
              </button>
            </div>
          </div>

          <hr className="menu-divider" />
          <div className="signout-row">
            <button onClick={handleSignOut} className="signout-btn">
              <i className="fas fa-sign-out-alt"></i> Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
