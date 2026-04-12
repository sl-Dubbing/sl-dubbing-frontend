import os, time, uuid
from pathlib import Path 
from celery import Celery
from dotenv import load_dotenv
import cloudinary
import cloudinary.uploader

# تحميل متغيرات البيئة
load_dotenv()

# --- إعدادات Redis ---
raw_url = os.getenv("CELERY_BROKER_URL", "")
REDIS_URL = raw_url.replace("redis://", "rediss://") if "upstash.io" in raw_url else raw_url

celery_app = Celery('tasks', broker=REDIS_URL, backend=REDIS_URL)
celery_app.conf.update(
    broker_use_ssl={'ssl_cert_reqs': 'none'},
    redis_backend_use_ssl={'ssl_cert_reqs': 'none'}
)

# --- إعداد Cloudinary ---
cloudinary.config(
    cloud_name=os.getenv("CLOUDINARY_CLOUD_NAME"),
    api_key=os.getenv("CLOUDINARY_API_KEY"),
    api_secret=os.getenv("CLOUDINARY_API_SECRET")
)

BASE_DIR = Path(__file__).parent.absolute()
AUDIO_DIR = BASE_DIR / 'temp_audio'
SPEAKER_DIR = BASE_DIR / 'speakers'
for d in [AUDIO_DIR, SPEAKER_DIR]: d.mkdir(parents=True, exist_ok=True)

XTTS_MODEL = None

def get_xtts():
    global XTTS_MODEL
    if XTTS_MODEL: return XTTS_MODEL
    import torch
    from TTS.api import TTS
    print("⏳ Loading XTTS v2...")
    device = "cuda" if torch.cuda.is_available() else "cpu"
    XTTS_MODEL = TTS("tts_models/multilingual/multi-dataset/xtts_v2").to(device)
    return XTTS_MODEL

@celery_app.task(bind=True, name='tasks.process_tts')
def process_tts(self, data):
    job_id = str(uuid.uuid4())
    # استلام المقاطع بدلاً من النص الكامل
    segments = data.get('segments', [])
    lang = data.get('lang', 'ar')
    speaker_id = data.get('speaker_id', 'muhammad')
    
    total_segments = len(segments)
    
    try:
        xtts = get_xtts()
        wav_ref = str(SPEAKER_DIR / f"{speaker_id}.wav")
        
        # التأكد من وجود ملف الصوت
        if not os.path.exists(wav_ref):
            available = list(SPEAKER_DIR.glob("*.wav"))
            if not available: raise FileNotFoundError("No speaker wav found!")
            wav_ref = str(available[0])

        # --- ذكاء الدبلجة: دمج النصوص أولاً أو معالجتها مقطعاً مقطعاً ---
        # لغرض شريط التقدم، سنقوم بتجميع النص الكامل مع إرسال تحديثات وهمية سريعة 
        # لأن XTTS يفضل معالجة النص دفعة واحدة للجودة، لكننا سنخدع الواجهة لإظهار التقدم
        
        full_text = ""
        for i, seg in enumerate(segments):
            full_text += seg['text'] + " "
            # تحديث حالة التقدم (الآن الموقع سيراها!)
            self.update_state(state='PROGRESS', meta={'current': i + 1, 'total': total_segments})
            time.sleep(0.1) # سرعة وهمية لتحديث الشريط قبل البدء الفعلي

        out_path = AUDIO_DIR / f"tts_{job_id}.wav"

        # توليد الصوت الفعلي (المرحلة الأثقل)
        print(f"🎙️ Generating audio for {total_segments} segments...")
        xtts.tts_to_file(text=full_text, speaker_wav=wav_ref, language=lang, file_path=str(out_path))
        
        # الرفع للسحاب
        self.update_state(state='PROGRESS', meta={'current': total_segments, 'total': total_segments, 'message': 'رفع الملف...'})
        up = cloudinary.uploader.upload(str(out_path), resource_type="video", folder="sl-dubbing/tts")
        
        if out_path.exists(): out_path.unlink() 
        
        return {'status': 'done', 'audio_url': up['secure_url']}
        
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return {'status': 'error', 'error': str(e)}
