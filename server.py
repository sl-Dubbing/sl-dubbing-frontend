import os, uuid
from flask import Flask, request, jsonify
from flask_cors import CORS
from celery import Celery
from dotenv import load_dotenv

# تحميل متغيرات البيئة
load_dotenv()

app = Flask(__name__)

# --- 🛠️ إصلاح الـ CORS (حارس الأمن) ---
# تم حذف الكلمة الزائدة ليعمل السطر بشكل صحيح ويفتح الباب لـ Vercel
CORS(app, resources={r"/api/*": {"origins": "*"}})

# إعدادات المجلدات
UPLOAD_SPEAKER_DIR = 'speakers'
if not os.path.exists(UPLOAD_SPEAKER_DIR): 
    os.makedirs(UPLOAD_SPEAKER_DIR)

# إعدادات Celery (للربط مع Upstash)
REDIS_URL = os.getenv("CELERY_BROKER_URL")
celery = Celery('tasks', broker=REDIS_URL, backend=REDIS_URL)

# تأمين الاتصال مع Upstash
celery.conf.update(
    broker_use_ssl={'ssl_cert_reqs': 'none'},
    redis_backend_use_ssl={'ssl_cert_reqs': 'none'},
    broker_connection_retry_on_startup=True
)

@app.route('/api/status', methods=['GET'])
def get_status():
    return jsonify({"status": "online", "xtts_ready": True})

@app.route('/api/speakers', methods=['GET'])
def get_speakers():
    speakers = []
    if os.path.exists(UPLOAD_SPEAKER_DIR):
        for f in os.listdir(UPLOAD_SPEAKER_DIR):
            if f.endswith(".wav"):
                name = f.replace(".wav", "")
                speakers.append({"speaker_id": name, "label": name.capitalize()})
    return jsonify(speakers)

@app.route('/api/upload_speaker', methods=['POST'])
def upload_speaker():
    if 'file' not in request.files: 
        return jsonify({"error": "No file"}), 400
    file = request.files['file']
    label = request.form.get('label', 'New_Voice')
    speaker_id = f"{label}_{uuid.uuid4().hex[:4]}"
    file_path = os.path.join(UPLOAD_SPEAKER_DIR, f"{speaker_id}.wav")
    file.save(file_path)
    return jsonify({"speaker_id": speaker_id, "message": "تم استنساخ الصوت بنجاح!"})

@app.route('/api/dub', methods=['POST'])
def start_dubbing():
    data = request.json
    # إرسال المهمة إلى الـ Worker في بيتك
    task = celery.send_task('tasks.process_tts', args=[data])
    return jsonify({"job_id": task.id, "status": "queued"})

@app.route('/api/job/<job_id>', methods=['GET'])
def get_job_status(job_id):
    res = celery.AsyncResult(job_id)
    if res.state == 'SUCCESS':
        return jsonify(res.result)
    return jsonify({"status": res.state, "progress": 50 if res.state == 'PROGRESS' else 0})

if __name__ == '__main__':
    # Railway يحدد المنفذ تلقائياً عبر متغير PORT
    port = int(os.environ.get("PORT", 5000))
    app.run(host='0.0.0.0', port=port)
