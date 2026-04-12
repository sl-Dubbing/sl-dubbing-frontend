<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>sl-Dubbing | منصة الدبلجة الذكية</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <style>
        :root{--bg:#f5f5f7;--card:#fff;--border:#e5e7eb;--text:#111827;--muted:#6b7280;--primary:#0f0f10;--mint:#a4fec4;--green-dk:#065f2c;--radius:14px;--shadow:0 1px 3px rgba(0,0,0,.07)}
        *{margin:0;padding:0;box-sizing:border-box;font-family:'Segoe UI',system-ui,sans-serif}
        body{background:var(--bg);color:var(--text);min-height:100vh;text-align:right;line-height:1.6}
        .topbar{background:var(--primary);padding:13px 28px;display:flex;align-items:center;justify-content:space-between}
        .logo{font-size:1.15rem;font-weight:800;color:#fff;letter-spacing:-.02em}.logo span{color:var(--mint)}
        .pill{display:flex;align-items:center;gap:6px;font-size:.75rem;color:#fff;border:1px solid rgba(255,255,255,.2);padding:4px 12px;border-radius:20px}
        .dot{width:7px;height:7px;border-radius:50%;background:#6b7280;transition:background .4s}
        .dot.on{background:var(--mint);box-shadow:0 0 6px var(--mint)}
        .wrap{max-width:900px;margin:0 auto;padding:32px 18px 60px}
        .card{background:var(--card);border:1px solid var(--border);border-radius:var(--radius);padding:26px 28px;margin-bottom:18px;box-shadow:var(--shadow)}
        .ttl{font-size:.95rem;font-weight:700;display:flex;align-items:center;gap:9px;margin-bottom:20px}
        .ttl i{color:var(--muted);font-size:.9rem}
        .badge{font-size:.62rem;font-weight:700;padding:2px 8px;border-radius:20px;background:var(--mint);color:var(--green-dk);text-transform:uppercase;letter-spacing:.04em}
        input[type=text],select{width:100%;padding:10px 14px;border:1px solid #d1d5db;border-radius:10px;font-size:.9rem;outline:none;transition:border-color .18s}
        .srt-zone{border:1.5px dashed var(--border);border-radius:10px;padding:20px;background:#fafafa;text-align:center;cursor:pointer;min-height:90px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px}
        .srt-zone.ok{border-color:#059669;background:#f0fdf4}
        .spk-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:10px}
        .spk-card{border:1.5px solid var(--border);border-radius:10px;padding:13px 10px;cursor:pointer;text-align:center;position:relative}
        .spk-card.active{border-color:var(--primary);background:var(--mint)}
        .lang-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(108px,1fr));gap:9px;margin-bottom:20px}
        .lang-box{padding:10px 7px;background:#fff;border-radius:10px;text-align:center;cursor:pointer;border:1px solid var(--border);font-size:.85rem}
        .lang-box.active{border-color:var(--primary);background:var(--mint);font-weight:700}
        .btn-go{background:var(--primary);color:#fff;border:none;padding:14px;border-radius:10px;width:100%;font-size:1rem;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:9px}
        #progressArea{display:none;margin-top:20px;padding-top:20px;border-top:1px solid var(--border)}
        .prog-bar-wrap{background:#e5e7eb;border-radius:8px;height:7px;overflow:hidden;margin-top:10px}
        .prog-bar{background:var(--primary);width:0%;height:100%;transition:width .4s}
        .res-card{display:none}
        #ytInfo{display:none;background:#f9fafb;border:1px solid var(--border);border-radius:10px;padding:13px 16px;align-items:center;gap:16px;margin-top:10px}
        #ytThumb{width:100px;border-radius:6px}
    </style>
</head>
<body>
    <div class="topbar">
        <div class="logo">sl<span>-Dubbing</span></div>
        <div class="pill"><div class="dot" id="dot"></div><span id="dotLbl">جاري التحقق...</span></div>
    </div>
    <div class="wrap">
        <div class="card">
            <div class="ttl"><i class="fas fa-photo-film"></i> المصدر</div>
            <input type="text" id="ytUrl" placeholder="ضع رابط يوتيوب هنا..." oninput="onUrlUpdate(this.value)">
            <div id="ytInfo">
                <img id="ytThumb" src="" alt="Thumbnail">
                <div><div id="ytTitle" style="font-weight:600; font-size:0.9rem;"></div></div>
            </div>
        </div>
        <div class="card">
            <div class="ttl"><i class="fas fa-file-lines"></i> ملف الترجمة SRT <span class="badge">إلزامي</span></div>
            <input type="file" id="srtFile" accept=".srt" style="display:none">
            <div class="srt-zone" id="srtZone" onclick="document.getElementById('srtFile').click()">
                <i class="fas fa-upload"></i>
                <div id="srtStatusTxt">انقر لرفع ملف SRT</div>
            </div>
        </div>
        <div class="card">
            <div class="ttl"><i class="fas fa-microphone-lines"></i> صوت المتحدث</div>
            <div class="spk-grid" id="spkGrid"></div>
            <input type="file" id="spkFile" style="display:none">
        </div>
        <div class="card">
            <div class="ttl"><i class="fas fa-language"></i> لغة الدبلجة</div>
            <div class="lang-grid" id="langGrid"></div>
            <button class="btn-go" id="startBtn" onclick="start()" style="opacity:0.5; cursor:not-allowed;">ابدأ الدبلجة 🚀</button>
            <div id="progressArea">
                <div style="display:flex; justify-content:space-between; font-size:0.85rem;">
                    <span id="statusTxt">جاري العمل...</span>
                    <span id="pctTxt">0%</span>
                </div>
                <div class="prog-bar-wrap"><div class="prog-bar" id="progBar"></div></div>
            </div>
        </div>
        <div class="card res-card" id="resCard">
            <div class="ttl"><i class="fas fa-circle-check"></i> النتيجة النهائية</div>
            <div id="resList"></div>
        </div>
    </div>
    <script src="script.js"></script>
</body>
</html>
