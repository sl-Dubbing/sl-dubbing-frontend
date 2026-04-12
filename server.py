import os, uuid
from flask import Flask, request, jsonify
from flask_cors import CORS # تأكد أن هذه المكتبة موجودة في requirements.txt
from celery import Celery
from dotenv import load_dotenv

load_dotenv()
app = Flask(__name__)

# --- 🛡️ تفعيل التصريح الشامل (أبسط نسخة تعمل دائماً) ---
CORS(app) 

# إعدادات السحاب (Upstash)
REDIS_URL = os.getenv("CELERY_BROKER_URL")
celery = Celery('tasks', broker=REDIS_URL, backend=REDIS_URL)

celery.conf.update(
    broker_use_ssl={'ssl_cert_reqs': 'none'},
    redis_backend_use_ssl={'ssl_cert_reqs': 'none'},
    broker_connection_retry_on_startup=True
)

@app.route('/api/status', methods=['GET'])
def get_status():
    return jsonify({"status": "online", "message": "Backend is running!"})

@app.route('/api/speakers', methods=['GET'])
def get_speakers():
    speakers = []
    spk_dir = 'speakers'
    if os.path.exists(spk_dir):
        for f in os.listdir(spk_dir):
            if f.endswith(".wav"):
                name = f.replace(".wav", "")
                speakers.append({"speaker_id": name, "label": name.capitalize()})
    # إذا كان المجلد فارغاً، نرسل صوتاً وهمياً للتجربة
    if not speakers: speakers = [{"speaker_id": "muhammad", "label": "Muhammad (Default)"}]
    return jsonify(speakers)

@app.route('/api/dub', methods=['POST'])
def start_dubbing():
    data = request.json
    task = celery.send_task('tasks.process_tts', args=[data])
    return jsonify({"job_id": task.id, "status": "queued"})

@app.route('/api/job/<job_id>', methods=['GET'])
def get_job_status(job_id):
    res = celery.AsyncResult(job_id)
    if res.state == 'SUCCESS': return jsonify(res.result)
    return jsonify({"status": res.state, "progress": 50 if res.state == 'PROGRESS' else 0})

if __name__ == '__main__':
    port = int(os.environ.get("PORT", 5000))
    app.run(host='0.0.0.0', port=port)
