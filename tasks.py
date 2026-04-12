"""
sl-Dubbing Worker — The Engine (V11 - Final Cloud Fix)
الحالة: جاهز تماماً للعمل السحابي مع Upstash
"""
import os, time, uuid
from pathlib import Path 
from celery import Celery
from dotenv import load_dotenv
import cloudinary
import cloudinary.uploader

# تحميل متغيرات البيئة من ملف .env
load_dotenv()

# --- إعدادات الاتصال السحابي (Redis) ---
raw_url = os.getenv("CELERY_BROKER_URL", "")

# كود ذكي لتصحيح الرابط تلقائياً إذا نقص حرف الـ s
if raw_url.startswith("redis://") and "upstash.io" in raw_url:
    REDIS_URL = raw_url.replace("redis://", "rediss://")
else:
    REDIS_URL = raw_url

celery_app = Celery('tasks', broker=REDIS_URL, backend=REDIS_URL)

# تأمين الاتصال المشفر مع Upstash
celery_app.conf.update(
    broker_use_ssl={'ssl_cert_reqs': 'none'},
    redis_backend_use_ssl={'ssl_cert_reqs': 'none'},
    task_serializer='json',
    accept_content=['json'],
    result_serializer='json',
    timezone='UTC',
    enable_utc=True,
    # حل مشكلة انقطاع الاتصال في الويندوز
    broker_connection_retry_on_startup=True
)

# --- إعداد Cloudinary ---
cloudinary.config(
    cloud_name=os.getenv("CLOUDINARY_CLOUD_NAME"),
    api_key=os.getenv("CLOUDINARY_API_KEY"),
    api_secret=os.getenv("CLOUDINARY_API_SECRET")
)

# المجلدات المؤقتة
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
    print("⏳ Loading XTTS v2 on Worker...")
    device = "cuda" if torch.cuda.is_available() else "cpu"
    XTTS_MODEL = TTS("tts_models/multilingual/multi-dataset/xtts_v2").to(device)
    return XTTS_MODEL

@celery_app.task(bind=True, name='tasks.process_tts')
def process_tts(self, data):
    job_id = data.get('job_id', str(uuid.uuid4()))
    text, lang = data['text'], data['lang']
    speaker_id = data.get('speaker_id', 'muhammad')
    
    self.update_state(state='PROGRESS', meta={'progress': 20, 'message': 'تحضير المحرك...'})
    
    try:
        xtts = get_xtts()
        wav_ref = str(SPEAKER_DIR / f"{speaker_id}.wav")
        
        if not os.path.exists(wav_ref):
            # البحث عن أي ملف صوتي متاح كبديل
            available_voices = list(SPEAKER_DIR.glob("*.wav"))
            if available_voices:
                wav_ref = str(available_voices[0])
            else:
                raise FileNotFoundError("لم يتم العثور على ملفات صوتية في مجلد speakers")

        out_name = f"tts_{job_id}.wav"
        out_path = AUDIO_DIR / out_name

        # توليد الصوت
        xtts.tts_to_file(text=text, speaker_wav=wav_ref, language=lang, file_path=str(out_path))
        
        self.update_state(state='PROGRESS', meta={'progress': 80, 'message': 'رفع النتيجة للسحاب...'})
        
        # الرفع لـ Cloudinary
        up = cloudinary.uploader.upload(
            str(out_path), 
            resource_type="video", 
            folder="sl-dubbing/tts"
        )
        
        if out_path.exists(): out_path.unlink() 
        
        return {
            'status': 'done', 
            'progress': 100, 
            'audio_url': up['secure_url'], 
            'message': 'اكتمل التوليد بنجاح!'
        }
    except Exception as e:
        print(f"❌ Error in Worker: {str(e)}")
        return {'status': 'error', 'error': str(e)}