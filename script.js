/* sl-Dubbing Script - FIXED VERSION
 * Improvements:
 * - Proper error handling
 * - Network retry logic
 * - Exponential backoff polling
 * - XSS prevention
 * - JWT token authentication
 * - Better UX (loading states, etc)
 */

const API_BASE = 'https://sl-dubbing-frontend-production.up.railway.app';


let selectedLangs = [];
let srtSegments = [];
let activeSpeakerId = 'muhammad';
let currentTaskId = null;

// ============================================================================
// CONSTANTS
// ============================================================================

const LANGS = [
    { code: 'ar', name: 'العربية', flag: '🇸🇦' },
    { code: 'en', name: 'English', flag: '🇺🇸' },
    { code: 'fr', name: 'French', flag: '🇫🇷' },
    { code: 'de', name: 'German', flag: '🇩🇪' },
    { code: 'tr', name: 'Turkish', flag: '🇹🇷' },
    { code: 'zh-cn', name: '中文', flag: '🇨🇳' },
    { code: 'ja', name: '日本語', flag: '🇯🇵' },
    { code: 'es', name: 'Español', flag: '🇪🇸' }
];

const MAX_FILE_SIZE = 10 * 1024 * 1024;  // 10MB
const MAX_TEXT_LENGTH = 50000;
const RETRY_CONFIG = {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 8000,
    timeout: 10000
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = String(text);
    return div.innerHTML;
}

/**
 * Show error toast
 */
function showError(message) {
    const toast = document.getElementById('toast') || createToast();
    toast.className = 'toast error';
    toast.innerHTML = `❌ ${escapeHtml(message)}`;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 5000);
}

/**
 * Show success toast
 */
function showSuccess(message) {
    const toast = document.getElementById('toast') || createToast();
    toast.className = 'toast success';
    toast.innerHTML = `✅ ${escapeHtml(message)}`;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 5000);
}

/**
 * Create toast element if it doesn't exist
 */
function createToast() {
    const toast = document.createElement('div');
    toast.id = 'toast';
    toast.className = 'toast';
    document.body.appendChild(toast);
    return toast;
}

/**
 * Get JWT token from localStorage
 */
function getAuthToken() {
    try {
        return localStorage.getItem('auth_token');
    } catch (e) {
        return null;
    }
}

/**
 * Check if user is authenticated
 */
function isAuthenticated() {
    const token = getAuthToken();
    if (!token) return false;
    
    try {
        // Decode JWT (without verification - just checking expiration)
        const payload = JSON.parse(atob(token.split('.')[1]));
        const exp = payload.exp * 1000;  // Convert to milliseconds
        return exp > Date.now();
    } catch (e) {
        localStorage.removeItem('auth_token');
        return false;
    }
}

/**
 * Fetch with retry logic and timeout
 */
async function fetchWithRetry(url, options = {}, retryCount = 0) {
    const { maxRetries, baseDelay, timeout } = RETRY_CONFIG;
    
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        
        const response = await fetch(url, {
            ...options,
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        // Automatically retry on 5xx errors
        if (response.status >= 500 && retryCount < maxRetries) {
            const delay = baseDelay * Math.pow(2, retryCount);
            await new Promise(resolve => setTimeout(resolve, delay));
            return fetchWithRetry(url, options, retryCount + 1);
        }
        
        return response;
        
    } catch (error) {
        if (error.name === 'AbortError') {
            error.message = 'Request timeout';
        }
        
        if (retryCount < maxRetries) {
            const delay = baseDelay * Math.pow(2, retryCount);
            console.warn(`Retry ${retryCount + 1}/${maxRetries} after ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            return fetchWithRetry(url, options, retryCount + 1);
        }
        
        throw error;
    }
}

/**
 * Make authenticated API call
 */
async function apiCall(endpoint, options = {}) {
    const token = getAuthToken();
    
    if (!token) {
        window.location.href = 'login.html';
        throw new Error('Authentication required');
    }
    
    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        ...options.headers
    };
    
    const response = await fetchWithRetry(`${API_BASE}${endpoint}`, {
        ...options,
        headers
    });
    
    if (response.status === 401) {
        // Token expired
        localStorage.removeItem('auth_token');
        window.location.href = 'login.html';
        throw new Error('Session expired. Please login again.');
    }
    
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}`);
    }
    
    return response.json();
}

/**
 * Safely render content
 */
function setTextContent(element, text) {
    if (element) {
        element.textContent = String(text || '');
    }
}

/**
 * SRT Parser - Extract text segments from SRT file
 */
function parseSRT(content) {
    const segments = [];
    
    try {
        // Split by double newlines (subtitle blocks)
        const blocks = content.split(/\n\s*\n/);
        
        for (const block of blocks) {
            const lines = block.trim().split('\n');
            
            if (lines.length < 2) continue;
            
            // Skip sequence number (lines[0])
            // Skip timestamp (lines[1])
            // Extract subtitle text (lines[2+])
            
            const text = lines.slice(2).join(' ').trim();
            
            if (text) {
                segments.push({
                    text: text,
                    timestamp: lines[1] || ''
                });
            }
        }
        
        if (segments.length === 0) {
            throw new Error('No valid subtitle segments found in SRT file');
        }
        
        return segments;
        
    } catch (error) {
        throw new Error(`SRT parsing error: ${error.message}`);
    }
}

// ============================================================================
// UI FUNCTIONS
// ============================================================================

/**
 * Populate language and speaker grids
 */
function populateGrids() {
    // Speaker grid
    const spkGrid = document.getElementById('spkGrid');
    if (spkGrid) {
        spkGrid.innerHTML = `
            <div class="spk-card active" id="spk-muhammad" onclick="selectSpeaker('muhammad')">
                <i class="fas fa-check-circle chk" style="display:block"></i>
                <div class="spk-av">M</div>
                <div class="spk-nm">محمد (افتراضي)</div>
            </div>
        `;
    }
    
    // Language grid
    const langGrid = document.getElementById('langGrid');
    if (langGrid) {
        langGrid.innerHTML = '';
        LANGS.forEach(lang => {
            const box = document.createElement('div');
            box.className = 'lang-box';
            box.id = `lang-${lang.code}`;
            box.textContent = `${lang.flag} ${lang.name}`;
            box.onclick = () => selectLanguage(lang.code);
            langGrid.appendChild(box);
        });
    }
}

/**
 * Select speaker
 */
window.selectSpeaker = function(id) {
    activeSpeakerId = id;
    document.querySelectorAll('.spk-card').forEach(c => c.classList.remove('active'));
    const card = document.getElementById(`spk-${id}`);
    if (card) card.classList.add('active');
    checkReady();
};

/**
 * Select language
 */
window.selectLanguage = function(code) {
    selectedLangs = [code];
    document.querySelectorAll('.lang-box').forEach(b => b.classList.remove('active'));
    const box = document.getElementById(`lang-${code}`);
    if (box) box.classList.add('active');
    checkReady();
};

/**
 * Check if all required fields are filled
 */
function checkReady() {
    const btn = document.getElementById('startBtn');
    if (!btn) return;
    
    const isReady = srtSegments.length > 0 && selectedLangs.length > 0;
    btn.disabled = !isReady;
    btn.style.opacity = isReady ? '1' : '0.5';
    btn.style.cursor = isReady ? 'pointer' : 'not-allowed';
}

/**
 * Update server status indicator
 */
async function updateStatus() {
    const dot = document.getElementById('dot');
    const dotLbl = document.getElementById('dotLbl');
    
    if (!dot || !dotLbl) return;
    
    try {
        await fetchWithRetry(`${API_BASE}/api/health`, {}, 1);
        dot.classList.add('on');
        setTextContent(dotLbl, 'System Online');
    } catch (e) {
        dot.classList.remove('on');
        setTextContent(dotLbl, 'System Offline');
    }
}

/**
 * Handle YouTube URL input
 */
window.onUrlUpdate = function(url) {
    const infoDiv = document.getElementById('ytInfo');
    const thumb = document.getElementById('ytThumb');
    const title = document.getElementById('ytTitle');
    
    if (!infoDiv) return;
    
    url = (url || '').trim();
    
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
        try {
            // Extract video ID
            let videoId;
            if (url.includes('v=')) {
                videoId = url.split('v=')[1].split('&')[0];
            } else {
                videoId = url.split('/').pop().split('?')[0];
            }
            
            if (videoId && videoId.length === 11) {
                if (thumb) thumb.src = `https://img.youtube.com/vi/${escapeHtml(videoId)}/mqdefault.jpg`;
                if (title) setTextContent(title, 'Video ready for processing');
                infoDiv.style.display = 'flex';
            }
        } catch (e) {
            infoDiv.style.display = 'none';
        }
    } else {
        infoDiv.style.display = 'none';
    }
};

/**
 * Handle SRT file upload
 */
document.addEventListener('DOMContentLoaded', () => {
    const srtFile = document.getElementById('srtFile');
    
    if (srtFile) {
        srtFile.addEventListener('change', function(e) {
            const file = e.target.files[0];
            
            if (!file) return;
            
            // Validate file size
            if (file.size > MAX_FILE_SIZE) {
                showError(`File too large (max ${MAX_FILE_SIZE / 1024 / 1024}MB)`);
                e.target.value = '';
                return;
            }
            
            // Validate file type
            if (!file.name.endsWith('.srt')) {
                showError('Please upload an SRT file');
                e.target.value = '';
                return;
            }
            
            const reader = new FileReader();
            
            reader.onload = function(ev) {
                try {
                    const content = ev.target.result;
                    srtSegments = parseSRT(content);
                    
                    const zone = document.getElementById('srtZone');
                    if (zone) {
                        zone.classList.add('ok');
                        setTextContent(
                            zone.querySelector('#srtStatusTxt'),
                            `✅ ${file.name} (${srtSegments.length} segments)`
                        );
                    }
                    
                    checkReady();
                    
                } catch (error) {
                    showError(error.message);
                    e.target.value = '';
                    srtSegments = [];
                }
            };
            
            reader.onerror = function() {
                showError('Error reading file');
                e.target.value = '';
            };
            
            reader.readAsText(file);
        });
    }
    
    // Initialize UI
    populateGrids();
    updateStatus();
    
    // Refresh status every 30 seconds
    setInterval(updateStatus, 30000);
});

// ============================================================================
// DUBBING WORKFLOW
// ============================================================================

/**
 * Start dubbing process
 */
window.start = async function() {
    const btn = document.getElementById('startBtn');
    
    if (!btn || btn.disabled) return;
    
    // Check authentication
    if (!isAuthenticated()) {
        showError('Please login first');
        window.location.href = 'login.html';
        return;
    }
    
    // Disable button and show loading state
    btn.disabled = true;
    const originalText = btn.innerHTML;
    btn.innerHTML = '⏳ جاري المعالجة...';
    
    const progressArea = document.getElementById('progressArea');
    if (progressArea) progressArea.style.display = 'block';
    
    try {
        const response = await apiCall('/api/dub', {
            method: 'POST',
            body: JSON.stringify({
                segments: srtSegments,
                lang: selectedLangs[0],
                speaker_id: activeSpeakerId
            })
        });
        
        if (response.task_id) {
            currentTaskId = response.task_id;
            showSuccess('Processing started! 🎬');
            
            // Start polling for results
            await pollStatus(response.task_id, 1000);
        }
        
    } catch (error) {
        showError(error.message || 'Failed to start processing');
        btn.disabled = false;
        btn.innerHTML = originalText;
        if (progressArea) progressArea.style.display = 'none';
    }
};

/**
 * Poll task status with exponential backoff
 */
async function pollStatus(taskId, delayMs = 1000) {
    const INITIAL_DELAY = 1000;
    const MAX_DELAY = 8000;
    
    try {
        const response = await apiCall(`/api/status/${taskId}`);
        
        // Update progress
        if (response.percent !== undefined) {
            updateProgress(response.percent, response.msg);
        }
        
        if (response.status === 'done') {
            finishDubbing(response.audio_url);
            return;
        }
        
        if (response.status === 'error') {
            showError(`Processing failed: ${response.error}`);
            resetUI();
            return;
        }
        
        // Schedule next poll with exponential backoff
        const nextDelay = Math.min(delayMs * 1.5, MAX_DELAY);
        setTimeout(() => pollStatus(taskId, nextDelay), delayMs);
        
    } catch (error) {
        console.warn('Poll error:', error);
        
        // Retry on network error
        setTimeout(() => pollStatus(taskId, Math.min(delayMs * 1.5, MAX_DELAY)), delayMs);
    }
}

/**
 * Update progress display
 */
function updateProgress(percent, message) {
    const progBar = document.getElementById('progBar');
    const pctTxt = document.getElementById('pctTxt');
    const statusTxt = document.getElementById('statusTxt');
    
    if (progBar) progBar.style.width = `${Math.min(percent, 100)}%`;
    if (pctTxt) setTextContent(pctTxt, `${Math.round(percent)}%`);
    if (statusTxt) setTextContent(statusTxt, escapeHtml(message || 'Processing...'));
}

/**
 * Show result and finish
 */
function finishDubbing(audioUrl) {
    // Validate URL
    try {
        new URL(audioUrl);
    } catch (e) {
        showError('Invalid audio URL received');
        resetUI();
        return;
    }
    
    const progressArea = document.getElementById('progressArea');
    const resCard = document.getElementById('resCard');
    const resList = document.getElementById('resList');
    
    if (progressArea) progressArea.style.display = 'none';
    if (resCard) resCard.style.display = 'block';
    
    if (resList) {
        resList.innerHTML = `
            <audio controls style="width:100%; margin-bottom:20px;">
                <source src="${escapeHtml(audioUrl)}" type="audio/mpeg">
                Your browser does not support the audio element.
            </audio>
            <a href="${escapeHtml(audioUrl)}" download class="btn-go" style="text-align:center;">
                <i class="fas fa-download"></i> Download Audio
            </a>
        `;
    }
    
    showSuccess('Processing complete! ✨');
}

/**
 * Reset UI to initial state
 */
function resetUI() {
    const btn = document.getElementById('startBtn');
    const progressArea = document.getElementById('progressArea');
    const resCard = document.getElementById('resCard');
    
    if (btn) {
        btn.disabled = false;
        btn.innerHTML = 'ابدأ الدبلجة 🚀';
    }
    if (progressArea) progressArea.style.display = 'none';
    if (resCard) resCard.style.display = 'none';
}

// ============================================================================
// ERROR BOUNDARY
// ============================================================================

window.addEventListener('error', (event) => {
    console.error('Uncaught error:', event.error);
    showError('An unexpected error occurred. Please refresh the page.');
});

window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled rejection:', event.reason);
    showError('A network error occurred. Please try again.');
});
