// ProfileMenu.jsx
import React, { useState, useEffect, useRef } from 'react';

export default function ProfileMenu({ apiBase }) {
  const [user, setUser] = useState(null);
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState(null);
  const fileRef = useRef();

  useEffect(() => {
    // جلب بيانات المستخدم المحمية (يرسل الكوكي HttpOnly)
    fetch(`${apiBase}/api/user`, { credentials: 'include' })
      .then(r => r.json())
      .then(d => { if (d.success) setUser(d.user); })
      .catch(console.error);
  }, [apiBase]);

  function handleFileChange(e) {
    const f = e.target.files[0];
    if (!f) return;
    const url = URL.createObjectURL(f);
    setPreview({ file: f, url });
  }

  async function uploadAvatar() {
    if (!preview?.file) return alert('اختر صورة أولاً');
    const fd = new FormData();
    fd.append('avatar', preview.file);
    const res = await fetch(`${apiBase}/api/user/avatar`, {
      method: 'POST',
      credentials: 'include',
      body: fd
    });
    const data = await res.json();
    if (data.success) {
      setUser(data.user);
      setPreview(null);
      fileRef.current.value = '';
      alert('تم تحديث الصورة');
    } else {
      alert('فشل التحديث: ' + (data.error || 'خطأ'));
    }
  }

  async function sendEmailWithAvatar() {
    const res = await fetch(`${apiBase}/api/user/send-avatar-email`, {
      method: 'POST',
      credentials: 'include'
    });
    const data = await res.json();
    if (data.success) alert('تم إرسال الإيميل');
    else alert('فشل الإرسال: ' + (data.error || 'خطأ'));
  }

  return (
    <div className="profile-menu">
      <button onClick={() => setOpen(!open)} className="profile-btn">
        <img src={user?.avatar || '/default-avatar.png'} alt="avatar" className="avatar-sm" />
        <span>{user?.name || 'حساب'}</span>
      </button>

      {open && (
        <div className="menu-panel">
          <div className="balance-row">
            <div><strong>Balance</strong></div>
            <div><button className="upgrade-btn">Upgrade</button></div>
          </div>
          <div className="credits">
            <div>Total {user?.total_credits ?? 0} credits</div>
            <div>Remaining {user?.credits ?? 0}</div>
          </div>

          <hr />

          <ul className="menu-list">
            <li><button onClick={() => window.location.href = '/settings'}>Settings</button></li>
            <li><button onClick={() => window.location.href = '/workspace'}>Workspace settings</button></li>
            <li><button onClick={() => window.location.href = '/subscription'}>Subscription</button></li>
            <li><button onClick={() => window.location.href = '/pronunciation'}>Pronunciation dictionaries</button></li>
            <li><button onClick={() => window.location.href = '/theme'}>Theme</button></li>
            <li><button onClick={() => window.location.href = '/payouts'}>Payouts</button></li>
            <li><button onClick={() => window.location.href = '/affiliate'}>Become an affiliate</button></li>
            <li><button onClick={() => window.location.href = '/impact'}>Apply for Impact Program</button></li>
            <li><button onClick={() => window.location.href = '/usage'}>Usage analytics</button></li>
            <li><button onClick={() => window.location.href = '/studio'}>Voiceover Studio</button></li>
            <li><button onClick={() => window.location.href = '/classifier'}>AI Speech Classifier</button></li>
            <li><button onClick={() => window.open('/docs', '_blank')}>Docs and resources</button></li>
            <li><button onClick={() => window.open('/terms', '_blank')}>Terms and privacy</button></li>
          </ul>

          <hr />

          <div className="avatar-section">
            <div className="avatar-preview">
              <img src={preview?.url || user?.avatar || '/default-avatar.png'} alt="preview" className="avatar-lg" />
            </div>
            <div className="avatar-actions">
              <input ref={fileRef} type="file" accept="image/*" onChange={handleFileChange} />
              <div className="btn-row">
                <button onClick={uploadAvatar} className="btn-primary">Upload</button>
                <button onClick={() => { setPreview(null); fileRef.current.value = ''; }} className="btn-muted">Cancel</button>
              </div>
              <div className="email-row">
                <button onClick={sendEmailWithAvatar} className="btn-secondary">Send image in email</button>
              </div>
            </div>
          </div>

          <hr />
          <div className="signout-row">
            <button onClick={async () => {
              await fetch(`${apiBase}/api/logout`, { method: 'POST', credentials: 'include' });
              window.location.reload();
            }}>Sign out</button>
          </div>
        </div>
      )}
    </div>
  );
}
