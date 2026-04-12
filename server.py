import os, uuid
from flask import Flask, request, jsonify
from flask_cors import CORS
from celery import Celery
from dotenv import load_dotenv

load_dotenv()
app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*"}})

# إعدادات المجلدات
UPLOAD_SPEAKER_DIR = 'speakers'
if not os.path.exists(UPLOAD_SPEAKER_DIR): os.makedirs(UPLOAD_SPEAKER_DIR)

# إعدادات Celery
REDIS_URL = os.getenv("CELERY_BROKER_URL")
celery = Celery('tasks', broker=REDIS_URL, backend=REDIS_URL)
celery.conf.update(broker_use_ssl={'ssl_cert_reqs': 'none'}, redis_backend_use_ssl={'ssl_cert_reqs': 'none'})

@app.route('/api/status', methods=['GET'])
def get_status():
    return jsonify({"status": "online", "xtts_ready": True})

@app.route('/api/speakers', methods=['GET'])
def get_speakers():
    # جلب قائمة الأصوات الموجودة في مجلد speakers
    speakers = []
    for f in os.listdir(UPLOAD_SPEAKER_DIR):
        if f.endswith(".wav"):
            name = f.replace(".wav", "")
            speakers.append({"speaker_id": name, "label": name.capitalize()})
    return jsonify(speakers)

@app.route('/api/upload_speaker', methods=['POST'])
def upload_speaker():
    # هذا المسار مخصص لاستنساخ صوت جديد
    if 'file' not in request.files: return jsonify({"error": "No file"}), 400
    file = request.files['file']
    label = request.form.get('label', 'New_Voice')
    speaker_id = f"{label}_{uuid.uuid4().hex[:4]}"
    file_path = os.path.join(UPLOAD_SPEAKER_DIR, f"{speaker_id}.wav")
    file.save(file_path)
    return jsonify({"speaker_id": speaker_id, "message": "تم استنساخ الصوت بنجاح!"})

@app.route('/api/dub', methods=['POST'])
def start_dubbing():
    data = request.json
    task = celery.send_task('tasks.process_tts', args=[data])
    return jsonify({"job_id": task.id, "status": "queued"})

if __name__ == '__main__':
    port = int(os.environ.get("PORT", 5000))
    app.run(host='0.0.0.0', port=port)
