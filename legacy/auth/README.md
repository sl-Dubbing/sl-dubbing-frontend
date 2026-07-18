# auth — تأكيد الإيميل

> **داخل مستودع `sl-dubbing-frontend-main`**
> صفحة واحدة تُعالج redirect من Supabase عند تأكيد الحساب.

---

## confirm.html

صفحة تأكيد الإيميل:

```
المسار: /auth/confirm.html
يُفعَّل بـ: رابط من Supabase يُرسَل للإيميل عند التسجيل
```

**ما تفعله:**
1. تستخرج `access_token` و`refresh_token` من URL fragment (#)
2. تُرسل `supabase.auth.setSession({access_token, refresh_token})`
3. تُحفظ الجلسة في localStorage
4. تُعيد التوجيه إلى `dubbing.html`

**إذا فشل التأكيد:** تعرض رسالة خطأ + رابط لإعادة الإرسال.
