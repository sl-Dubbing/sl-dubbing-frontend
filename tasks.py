import os, time, uuid
from pathlib import Path 
from celery import Celery
from dotenv import load_dotenv
import cloudinary
import cloudinary.uploader
from deep_translator import GoogleTranslator # مكتبة الترجمة

load_dotenv()

# إعدادات Redis
raw_url = os.getenv("CELERY_BROKER_URL", "")
REDIS_URL = raw_url.replace("redis://", "rediss://") if "upstash.io" in raw_url else raw_url

celery_app = Celery('tasks', broker=REDIS_URL, backend=REDIS_URL)
celery_app.conf.update(
    broker_use_ssl={'ssl_cert_reqs': 'none'},
    redis_backend_use_ssl={'ssl_cert_reqs': 'none'}
)

# إعداد Cloudinary
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
    segments = data.get('segments', [])
    target_lang = data.get('lang', 'ar')
    speaker_id = data.get('speaker_id', 'muhammad')
    
    try:
        # 1. مرحلة الترجمة (20%)
        self.update_state(state='PROGRESS', meta={'percent': 20, 'msg': 'جاري تجميع وترجمة النص...'})
        full_text = " ".join([s['text'] for s in segments])
        
        # إذا كانت اللغة المختارة ليست العربية، نترجم النص
        if target_lang != 'ar':
            # تصحيح كود اللغة الصينية ليتوافق مع المترجم
            g_lang = 'zh-CN' if target_lang == 'zh-cn' else target_lang
            full_text = GoogleTranslator(source='auto', target=g_lang).translate(full_text)
        
        # 2. مرحلة تشغيل المحرك (40%)
        self.update_state(state='PROGRESS', meta={'percent': 40, 'msg': 'جاري تشغيل محرك الذكاء الاصطناعي...'})
        xtts = get_xtts()
        wav_ref = str(SPEAKER_DIR / f"{speaker_id}.wav")
        
        if not os.path.exists(wav_ref):
            available = list(SPEAKER_DIR.glob("*.wav"))
            wav_ref = str(available[0]) if available else ""

        # 3. مرحلة توليد الصوت الثقيلة (70%)
        self.update_state(state='PROGRESS', meta={'percent': 70, 'msg': 'الوحش (GPU) يولد الصوت الآن...'})
        out_path = AUDIO_DIR / f"tts_{job_id}.wav"
        xtts.tts_to_file(text=full_text, speaker_wav=wav_ref, language=target_lang, file_path=str(out_path))
        
        # 4. مرحلة الرفع (90%)
        self.update_state(state='PROGRESS', meta={'percent': 90, 'msg': 'جاري رفع الملف للسحاب...'})
        up = cloudinary.uploader.upload(str(out_path), resource_type="video", folder="sl-dubbing/tts")
        
        if out_path.exists(): out_path.unlink() 
        
        return {'status': 'done', 'audio_url': up['secure_url']}
        
    except Exception as e:
        return {'status': 'error', 'error': str(e)}
