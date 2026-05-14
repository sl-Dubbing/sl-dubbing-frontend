# app.py — V32.6 (Ironclad CORS)
import os, uuid, logging
from flask import Flask, request, jsonify
from flask_cors import CORS
from shared import config, r2_client
from shared.celery_setup import celery_app, QUEUE_DUBBING, QUEUE_STT, QUEUE_TTS
from shared.models import db, DubbingJob, STTJob, TTSJob

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

app = Flask(__name__)

# ─── 🛡️ نظام CORS الشامل والنهائي ───
# هذا الإعداد أقوى بكثير ويتعامل مع OPTIONS تلقائياً عبر جميع المسارات
CORS(app, 
     resources={r"/api/*": {"origins": "*"}},
     supports_credentials=True,
     allow_headers=["Content-Type", "Authorization", "X-Requested-With"],
     methods=["GET", "POST", "OPTIONS", "PUT", "DELETE"])

# تمت إزالة دوال handle_preflight و add_cors_headers اليدوية لأنها قد تتداخل مع flask_cors

# ─── إعداد قاعدة البيانات ───
db_url = config.DATABASE_URL
if db_url and db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql://", 1)

app.config['SQLALCHEMY_DATABASE_URI'] = db_url
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db.init_app(app)

with app.app_context():
    try:
        db.create_all()
        logger.info("✅ Database connected successfully.")
    except Exception as e:
        logger.error(f"❌ DB Error: {e}")

# ─── المسارات الأساسية (Endpoints) ───
@app.route('/api/status', methods=['GET'])
def api_status():
    return jsonify({"is_online": True, "version": "32.6"}), 200

@app.route('/api/user/credits', methods=['GET'])
def get_credits():
    return jsonify({"credits": 16100, "success": True}), 200

@app.route('/api/upload-url', methods=['POST'])
def get_upload_url():
    try:
        data = request.get_json(silent=True) or {}
        res = r2_client.generate_upload_url("default_user", data.get('filename', 'file.mp4'), content_type=data.get('content_type'))
        if res: return jsonify({**res, 'success': True})
        return jsonify({'success': False, 'error': 'Failed to generate upload URL'}), 500
    except Exception as e: return jsonify({'success': False, 'error': str(e)}), 500

# ─── مسار TTS السريع ───
@app.route('/api/tts/quick', methods=['POST', 'OPTIONS'])
def quick_tts():
    if request.method == 'OPTIONS':
        return '', 204 # إضافة حماية يدوية إضافية لهذا المسار بالذات

    try:
        data = request.get_json(silent=True) or {}
        text = data.get('text', '')
        lang = data.get('lang', 'en-us')
        voice_id = data.get('voice_id')
        
        return jsonify({
            "success": True,
            "url": "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3" 
        }), 200
    except Exception as e:
        logger.error(f"❌ Quick TTS Error: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

# ─── مسارات الدبلجة والمهام ───
@app.route('/api/dub', methods=['POST'])
def start_dub():
    try:
        data = request.get_json(silent=True) or {}
        job_id = str(uuid.uuid4())
        lang = data.get('lang', 'ar')
        file_key = data.get('file_key')
        
        if not file_key: return jsonify({'success': False, 'error': 'Missing file_key'}), 400

        new_job = DubbingJob(id=job_id, user_id="default_user", language=lang, status='pending')
        db.session.add(new_job)
        db.session.commit()

        voice_config = {'source': data.get('voice_mode', 'original'), 'sample_url': data.get('sample_file', '')}
        celery_app.send_task('tasks_dubbing.process_dub', kwargs={
            'job_id': job_id, 'user_id': "default_user", 'file_key': file_key,
            'lang': lang, 'voice_config': voice_config, 'return_video': data.get('video_output', True)
        }, queue=QUEUE_DUBBING)
        
        return jsonify({'success': True, 'job_id': job_id}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/job/<job_id>', methods=['GET'])
def check_job(job_id):
    job = DubbingJob.query.get(job_id) or STTJob.query.get(job_id) or TTSJob.query.get(job_id)
    if not job: return jsonify({'status': 'not_found'}), 404
    return jsonify({'id': job.id, 'status': job.status, 'output_url': job.output_url, 'error': job.error}), 200

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=int(os.environ.get("PORT", 5000)))
