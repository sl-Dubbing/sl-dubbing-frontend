import os, uuid
from flask import Flask, request, jsonify
from flask_cors import CORS
from celery import Celery
from dotenv import load_dotenv

load_dotenv()
app = Flask(__name__)

# فتح الصلاحيات لـ Vercel وللجميع لضمان عمل الموقع
CORS(app)

# إعدادات الربط مع Upstash
REDIS_URL = os.getenv("CELERY_BROKER_URL")
celery = Celery('tasks', broker=REDIS_URL, backend=REDIS_URL)

celery.conf.update(
    broker_use_ssl={'ssl_cert_reqs': 'none'},
    redis_backend_use_ssl={'ssl_cert_reqs': 'none'},
    broker_connection_retry_on_startup=True
)

@app.route('/api/status', methods=['GET'])
def get_status():
    return jsonify({"status": "online", "engine": "ready"})

@app.route('/api/speakers', methods=['GET'])
def get_speakers():
    speakers = []
    spk_dir = 'speakers'
    if os.path.exists(spk_dir):
        for f in os.listdir(spk_dir):
            if f.endswith(".wav"):
                name = f.replace(".wav", "")
                speakers.append({"speaker_id": name, "label": name.capitalize()})
    
    # إذا لم توجد ملفات، نرسل صوتاً افتراضياً لكي لا تظهر القائمة فارغة
    if not speakers:
        speakers = [{"speaker_id": "muhammad", "label": "Muhammad (Default)"}]
    return jsonify(speakers)

@app.route('/api/dub', methods=['POST'])
def start_dubbing():
    try:
        data = request.json
        # إرسال المهمة للـ Worker في منزلك عبر السحاب
        task = celery.send_task('tasks.process_tts', args=[data])
        return jsonify({"job_id": task.id, "status": "queued"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/job/<job_id>', methods=['GET'])
def get_job_status(job_id):
    res = celery.AsyncResult(job_id)
    if res.state == 'SUCCESS': return jsonify(res.result)
    return jsonify({"status": res.state, "progress": 50 if res.state == 'PROGRESS' else 0})

if __name__ == '__main__':
    # جلب المنفذ من Railway أو استخدام 8080 كافتراضي
    port = int(os.environ.get("PORT", 8080))
    app.run(host='0.0.0.0', port=port)
