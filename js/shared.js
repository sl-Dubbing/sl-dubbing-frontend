// js/shared.js - V21 (Final Solution)

const API_BASE     = window.APP_CONFIG?.API_BASE     || 'https://api.glotix.ai';
const SUPABASE_URL = window.APP_CONFIG?.SUPABASE_URL || 'https://ckjkkxrlgisjdolwddfg.supabase.co';
const SUPABASE_KEY = window.APP_CONFIG?.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNramtreHJsZ2lzamRvbHdkZGZnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzQ2NTQ5NSwiZXhwIjoyMDkzMDQxNDk1fQ.n5JTt8qB61MDnFsELthn86NfcBRgRuBC6axJpkAwQNs'; // كود المفتاح كاملاً

let supabaseClient = null;
function getSupabase() {
    if (supabaseClient) return supabaseClient;
    if (window.supabase) supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    return supabaseClient;
}

window.updateDropdownUI = function(user) {
    const guestMenu = document.getElementById('guestMenu'), userMenu = document.getElementById('userMenu');
    const nameTxt = document.getElementById('menuUserName'), creditsTxt = document.getElementById('menuCredits'), avatarImg = document.getElementById('menuAvatar');
    if (user && user.id) {
        if (guestMenu) guestMenu.style.display = 'none';
        if (userMenu) userMenu.style.display = 'block';
        if (nameTxt) nameTxt.textContent = user.name;
        if (creditsTxt) creditsTxt.textContent = user.credits;
        if (avatarImg && user.avatar) avatarImg.src = user.avatar;
    } else {
        if (guestMenu) guestMenu.style.display = 'flex';
        if (userMenu) userMenu.style.display = 'none';
    }
};

window.checkAuth = async function() {
    const supa = getSupabase(); if (!supa) return;
    const { data: { session } } = await supa.auth.getSession();
    if (!session) { localStorage.clear(); window.updateDropdownUI(null); return; }
    
    try {
        const res = await fetch(`${API_BASE}/api/user/credits`, { headers: { 'Authorization': `Bearer ${session.access_token}` } });
        const d = await res.json();
        const userData = {
            id: session.user.id,
            name: session.user.user_metadata?.full_name || session.user.email.split('@')[0],
            avatar: session.user.user_metadata?.avatar_url || `https://ui-avatars.com/api/?name=${session.user.email[0]}`,
            credits: d.success ? d.credits : 0
        };
        localStorage.setItem('sl_user_cache', JSON.stringify(userData));
        window.updateDropdownUI(userData);
    } catch(e) {}
};

document.addEventListener('DOMContentLoaded', () => {
    // 1. التحقق من وجود code في الرابط (PKCE Flow) ✅
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('code')) {
        setTimeout(() => window.checkAuth(), 1000);
        return;
    }

    // 2. التحقق من وجود token في الـ hash (Implicit Flow)
    const hash = window.location.hash;
    if (hash.includes('access_token')) {
        const supa = getSupabase();
        supa?.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_IN') {
                window.history.replaceState(null, '', window.location.pathname);
                window.checkAuth();
            }
        });
        return;
    }

    // الـ Menu Toggle والـ Logout المعتاد...
    document.getElementById('menuBtn')?.addEventListener('click', () => document.getElementById('mainMenuDropdown').classList.toggle('active'));
    document.getElementById('logoutBtn')?.addEventListener('click', async () => {
        await getSupabase().auth.signOut(); localStorage.clear(); window.location.reload();
    });

    window.checkAuth();
    setInterval(() => { /* checkServer logic */ }, 300000); // 5 دقائق
});

window._supabaseClient = getSupabase();
