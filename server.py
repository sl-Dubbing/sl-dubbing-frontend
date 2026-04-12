import os
import time
import uuid
import logging
import tempfile
import traceback
from pathlib import Path
from celery import Celery
from dotenv import load_dotenv
import cloudinary
import cloudinary.uploader
from deep_translator import GoogleTranslator

# ============================================================================
# SETUP & CONFIGURATION
# ============================================================================

load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ============================================================================
# REDIS / CELERY CONFIGURATION
# ============================================================================

# Get Redis URL from environment (NEVER hardcode secrets!)
raw_url = os.getenv("CELERY_BROKER_URL", "")
if not raw_url:
    raise ValueError("CELERY_BROKER_URL environment variable not set")

# Safe URL normalization for Upstash
def normalize_redis_url(url):
    """Safely convert redis:// to rediss:// for SSL connections"""
    if not url:
        return ""
    if "upstash.io" in url and url.startswith("redis://"):
        return url.replace("redis://", "rediss://", 1)
    return url

REDIS_URL = normalize_redis_url(raw_url)

celery_app = Celery('tasks', broker=REDIS_URL, backend=REDIS_URL)
celery_app.conf.update(
    broker_use_ssl={'ssl_cert_reqs': 'none'},
    redis_backend_use_ssl={'ssl_cert_reqs': 'none'},
    task_track_started=True,
    task_ignore_result=False,
    result_expires=3600,  # Results expire after 1 hour
    task_soft_time_limit=180,  # 3 minute soft limit for warning
    task_time_limit=240,  # 4 minute hard limit - kill the task
)

# ============================================================================
# CLOUDINARY CONFIGURATION
# ============================================================================

# Get Cloudinary credentials from environment
CLOUDINARY_NAME = os.getenv("CLOUDINARY_CLOUD_NAME")
CLOUDINARY_KEY = os.getenv("CLOUDINARY_API_KEY")
CLOUDINARY_SECRET = os.getenv("CLOUDINARY_API_SECRET")

if not all([CLOUDINARY_NAME, CLOUDINARY_KEY, CLOUDINARY_SECRET]):
    raise ValueError("Missing Cloudinary credentials. Check environment variables.")

cloudinary.config(
    cloud_name=CLOUDINARY_NAME,
    api_key=CLOUDINARY_KEY,
    api_secret=CLOUDINARY_SECRET
)

# ============================================================================
# FILE SYSTEM SETUP
# ============================================================================

BASE_DIR = Path(__file__).parent.absolute()
SPEAKER_DIR = BASE_DIR / 'speakers'

# Create speaker directory if it doesn't exist
SPEAKER_DIR.mkdir(parents=True, exist_ok=True)

# Use system temp directory for audio files (cleaned up automatically)
# Don't create temp_audio - use temporary directories per task instead

# ============================================================================
# XTTS MODEL LAZY LOADING
# ============================================================================

XTTS_MODEL = None

def get_xtts():
    """Lazy load XTTS model on first use"""
    global XTTS_MODEL
    if XTTS_MODEL is not None:
        return XTTS_MODEL
    
    try:
        import torch
        from TTS.api import TTS
        
        logger.info("Loading XTTS v2 model...")
        device = "cuda" if torch.cuda.is_available() else "cpu"
        logger.info(f"Using device: {device}")
        
        XTTS_MODEL = TTS("tts_models/multilingual/multi-dataset/xtts_v2").to(device)
        logger.info("XTTS model loaded successfully")
        
        return XTTS_MODEL
    except Exception as e:
        logger.error(f"Failed to load XTTS model: {str(e)}")
        raise

# ============================================================================
# MAIN TASK
# ============================================================================

@celery_app.task(bind=True, name='tasks.process_tts', autoretry_for=(Exception,), retry_kwargs={'max_retries': 0})
def process_tts(self, data):
    """
    Process text-to-speech dubbing task
    
    Args:
        data: dict with keys:
            - segments: list of dicts with 'text' and optional 'timestamp'
            - lang: target language code
            - speaker_id: speaker WAV file name (without .wav)
            - user_email: email of requesting user (for logging)
    
    Returns:
        dict with status and audio_url on success, or error message on failure
    """
    
    job_id = str(uuid.uuid4())
    temp_dir = None
    
    try:
        # ====================================================================
        # PHASE 1: INPUT VALIDATION
        # ====================================================================
        
        logger.info(f"Task {self.request.id} started. Job ID: {job_id}")
        
        # Validate input data
        if not isinstance(data, dict):
            raise ValueError("Invalid data format - must be a dictionary")
        
        segments = data.get('segments', [])
        target_lang = data.get('lang', 'ar').lower()
        speaker_id = data.get('speaker_id', 'muhammad').lower()
        user_email = data.get('user_email', 'unknown')
        
        # Validate segments
        if not isinstance(segments, list) or len(segments) == 0:
            raise ValueError("Segments must be a non-empty list")
        
        # Validate language
        valid_langs = ['ar', 'en', 'fr', 'de', 'tr', 'zh-cn', 'ja', 'ko', 'es', 'it', 'pt', 'nl', 'pl']
        if target_lang not in valid_langs:
            raise ValueError(f"Unsupported language: {target_lang}. Supported: {', '.join(valid_langs)}")
        
        # Extract and validate text
        text_parts = []
        for i, segment in enumerate(segments):
            if not isinstance(segment, dict):
                raise ValueError(f"Segment {i} is not a dictionary")
            
            text = segment.get('text', '').strip()
            if not text:
                raise ValueError(f"Segment {i} has empty or missing 'text' field")
            
            if len(text) > 5000:
                raise ValueError(f"Segment {i} text too long (max 5000 chars)")
            
            text_parts.append(text)
        
        full_text = " ".join(text_parts)
        
        if len(full_text) > 50000:
            raise ValueError(f"Total text too long (max 50000 chars, got {len(full_text)})")
        
        logger.info(f"Job {job_id} - Language: {target_lang}, Speaker: {speaker_id}, Text length: {len(full_text)}")
        
        # ====================================================================
        # PHASE 2: TRANSLATION (20%)
        # ====================================================================
        
        self.update_state(
            state='PROGRESS',
            meta={'percent': 20, 'msg': 'جاري تجميع وترجمة النص...'}
        )
        
        try:
            # If not already in target language, translate
            if target_lang != 'ar':
                # Normalize Chinese language code
                translate_lang = 'zh-CN' if target_lang == 'zh-cn' else target_lang
                
                logger.info(f"Job {job_id} - Translating to {translate_lang}")
                translated_text = GoogleTranslator(source='auto', target=translate_lang).translate(full_text)
                
                if not translated_text:
                    raise ValueError("Translation returned empty result")
                
                full_text = translated_text
                logger.info(f"Job {job_id} - Translation complete ({len(full_text)} chars)")
            else:
                logger.info(f"Job {job_id} - No translation needed (target is Arabic)")
        
        except Exception as translate_error:
            logger.error(f"Job {job_id} - Translation failed: {str(translate_error)}")
            raise ValueError(f"Translation failed: {str(translate_error)}")
        
        # ====================================================================
        # PHASE 3: VALIDATE SPEAKER FILE (30%)
        # ====================================================================
        
        self.update_state(
            state='PROGRESS',
            meta={'percent': 30, 'msg': 'جاري التحقق من ملف الصوت...'}
        )
        
        # Find speaker WAV file
        speaker_file = SPEAKER_DIR / f"{speaker_id}.wav"
        
        if not speaker_file.exists():
            logger.warning(f"Job {job_id} - Speaker file not found: {speaker_file}")
            
            # Try to find any available speaker
            available_speakers = list(SPEAKER_DIR.glob("*.wav"))
            
            if not available_speakers:
                error_msg = f"No speaker files available in {SPEAKER_DIR}. Please upload speaker WAV files."
                logger.error(f"Job {job_id} - {error_msg}")
                raise FileNotFoundError(error_msg)
            
            # Use first available speaker as fallback
            speaker_file = available_speakers[0]
            logger.warning(f"Job {job_id} - Using fallback speaker: {speaker_file.name}")
        
        speaker_path = str(speaker_file)
        logger.info(f"Job {job_id} - Using speaker: {speaker_path}")
        
        # ====================================================================
        # PHASE 4: LOAD TTS ENGINE (40%)
        # ====================================================================
        
        self.update_state(
            state='PROGRESS',
            meta={'percent': 40, 'msg': 'جاري تشغيل محرك الذكاء الاصطناعي...'}
        )
        
        try:
            xtts = get_xtts()
            logger.info(f"Job {job_id} - XTTS engine ready")
        except Exception as xtts_error:
            logger.error(f"Job {job_id} - Failed to load XTTS: {str(xtts_error)}")
            raise RuntimeError(f"TTS engine initialization failed: {str(xtts_error)}")
        
        # ============================================================
        # PHASE 5: GENERATE AUDIO (70%)
        # ============================================================
        
        self.update_state(
            state='PROGRESS',
            meta={'percent': 70, 'msg': 'الوحش (GPU) يولد الصوت الآن...'}
        )
        
        # Use temporary directory for this task's audio files
        # Automatically cleaned up when context exits
        temp_dir = tempfile.mkdtemp(prefix=f'tts_{job_id}_')
        output_path = Path(temp_dir) / f"output_{job_id}.wav"
        
        try:
            logger.info(f"Job {job_id} - Starting TTS generation...")
            logger.debug(f"  Text length: {len(full_text)}")
            logger.debug(f"  Speaker: {speaker_path}")
            logger.debug(f"  Language: {target_lang}")
            logger.debug(f"  Output: {output_path}")
            
            # Generate speech
            xtts.tts_to_file(
                text=full_text,
                speaker_wav=speaker_path,
                language=target_lang,
                file_path=str(output_path)
            )
            
            if not output_path.exists():
                raise RuntimeError("TTS generation failed - no output file created")
            
            file_size = output_path.stat().st_size
            logger.info(f"Job {job_id} - Audio generated successfully ({file_size} bytes)")
        
        except Exception as tts_error:
            logger.error(f"Job {job_id} - TTS generation failed: {traceback.format_exc()}")
            raise RuntimeError(f"Audio generation failed: {str(tts_error)}")
        
        # ====================================================================
        # PHASE 6: UPLOAD TO CLOUDINARY (90%)
        # ====================================================================
        
        self.update_state(
            state='PROGRESS',
            meta={'percent': 90, 'msg': 'جاري رفع الملف للسحاب...'}
        )
        
        try:
            logger.info(f"Job {job_id} - Uploading to Cloudinary...")
            
            upload_result = cloudinary.uploader.upload(
                str(output_path),
                resource_type="video",  # Cloudinary treats audio as video
                folder="sl-dubbing/tts",
                public_id=f"dubbing_{job_id}",
                overwrite=True,
                timeout=60,
                tags=[f"user:{user_email}", "tts", "dubbing"]
            )
            
            audio_url = upload_result.get('secure_url')
            
            if not audio_url:
                raise ValueError("Cloudinary upload succeeded but no URL returned")
            
            logger.info(f"Job {job_id} - Upload complete: {audio_url}")
        
        except Exception as upload_error:
            logger.error(f"Job {job_id} - Upload to Cloudinary failed: {traceback.format_exc()}")
            raise RuntimeError(f"File upload failed: {str(upload_error)}")
        
        # ====================================================================
        # PHASE 7: CLEANUP & SUCCESS
        # ====================================================================
        
        # Clean up temporary audio files
        if output_path.exists():
            try:
                output_path.unlink()
                logger.info(f"Job {job_id} - Cleaned up temporary file")
            except Exception as cleanup_error:
                logger.warning(f"Job {job_id} - Failed to clean temporary file: {str(cleanup_error)}")
        
        # Clean up temp directory
        if temp_dir and Path(temp_dir).exists():
            try:
                import shutil
                shutil.rmtree(temp_dir)
                logger.info(f"Job {job_id} - Cleaned up temporary directory")
            except Exception as cleanup_error:
                logger.warning(f"Job {job_id} - Failed to clean temporary directory: {str(cleanup_error)}")
        
        # Return success
        result = {
            'status': 'done',
            'audio_url': audio_url,
            'duration': 0,  # Could parse from Cloudinary metadata if needed
            'job_id': job_id
        }
        
        logger.info(f"Job {job_id} - Task completed successfully")
        return result
    
    # ========================================================================
    # ERROR HANDLING
    # ========================================================================
    
    except ValueError as e:
        """Validation errors - don't retry"""
        error_msg = str(e)
        logger.warning(f"Job {job_id} - Validation error: {error_msg}")
        
        self.update_state(
            state='FAILURE',
            meta={'error': error_msg, 'error_type': 'validation'}
        )
        
        return {
            'status': 'error',
            'error': error_msg,
            'error_type': 'validation',
            'job_id': job_id
        }
    
    except FileNotFoundError as e:
        """File errors - don't retry"""
        error_msg = str(e)
        logger.warning(f"Job {job_id} - File not found: {error_msg}")
        
        self.update_state(
            state='FAILURE',
            meta={'error': error_msg, 'error_type': 'file'}
        )
        
        return {
            'status': 'error',
            'error': error_msg,
            'error_type': 'file',
            'job_id': job_id
        }
    
    except Exception as e:
        """Unexpected errors - log full traceback"""
        error_msg = str(e)
        logger.error(f"Job {job_id} - Unexpected error: {traceback.format_exc()}")
        
        self.update_state(
            state='FAILURE',
            meta={'error': error_msg, 'error_type': 'system'}
        )
        
        return {
            'status': 'error',
            'error': "Processing failed. Please try again.",
            'error_type': 'system',
            'job_id': job_id
        }
    
    finally:
        # Always clean up temp directory, even on error
        if temp_dir and Path(temp_dir).exists():
            try:
                import shutil
                shutil.rmtree(temp_dir)
            except Exception:
                pass  # Ignore cleanup errors in finally block
