// js/shared.js - V33.4 (Final Fix: Timeout 15s + Auth Fix)

const API_BASE     = 'https://api.glotix.ai';
const SUPABASE_URL = 'https://ckjkkxrlgisjdolwddfg.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'; // كودك الأصلي

let _isFetchingCredits = false;

window.checkAuth = async function() {
    try {
        const supa = getSupabase();
        const { data: { session } } = await supa.auth.getSession();

        if (!session) return window.updateDropdownUI(null);
        localStorage.setItem('token', session.access_token);

        if (!_isFetchingCredits) {
            _isFetchingCredits = true;
            try {
                const res = await fetch(`${API_BASE}/api/user/credits`, {
                    headers: { 
                        'Authorization': `Bearer ${session.access_token}`,
                        'X-User-Id': session.user.id 
                    },
                    // زيادة المهلة لـ 15 ثانية لحل مشكلة البطء
                    signal: AbortSignal.timeout(15000)
                });

                if (res.ok) {
                    const d = await res.json();
                    if (d.success) {
                        const userData = {
                            id: session.user.id,
                            name: session.user.user_metadata?.full_name || 'User',
                            credits: d.credits
                        };
                        localStorage.setItem('sl_user_cache', JSON.stringify(userData));
                        window.updateDropdownUI(userData);
                    }
                }
            } finally {
                setTimeout(() => { _isFetchingCredits = false; }, 10000);
            }
        }
    } catch(e) { console.warn('Credits fetch timeout:', e.message); }
};

window.checkServer = async function() {
    try {
        const r = await fetch(`${API_BASE}/api/status`);
        const d = await r.json();
        const badge = document.getElementById('srv');
        if (badge) badge.className = d.is_online ? 'srv-badge on' : 'srv-badge';
    } catch (e) { console.error('Server offline'); }
};

document.addEventListener('DOMContentLoaded', () => {
    window.checkAuth();
    window.checkServer();
});
