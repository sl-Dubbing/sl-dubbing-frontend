"""
sl-Dubbing Backend — The Brain (V10)
الحالة: جاهز للربط العالمي مع Vercel و Railway
"""
import os
from flask import Flask, request, jsonify
from flask_cors import CORS  # المكتبة المسؤولة عن فتح الباب للـ Frontend
from celery import Celery
from dotenv import load_dotenv

# تحميل الإعدادات
load_dotenv()

app = Flask(__name__)

# --- 🛠️ حل مشكلة CORS (حارس الأمن) ---
# هذا السطر يسمح لجميع المواقع (بما فيها Vercel) بالتحدث مع سيرفر Railway
CORS(app, resources={r"/api/*": {"origins": "*"}})

# إعدادات Celery (نفس إعدادات الـ Worker لضمان الاتصال بالسحاب)
REDIS_URL = os.getenv("CELERY_BROKER_URL")
celery = Celery('tasks', broker=REDIS_URL, backend=REDIS_URL)

celery.conf.update(
    broker_use_ssl={'ssl_cert_reqs': 'none'},
    redis_backend_use_ssl={'ssl_cert_reqs': 'none'}
)

@app.route('/api/status', methods=['GET'])
def get_status():
    # هنا نتأكد من حالة الـ Worker (العضلات) في بيتك
    return jsonify({"status": "online", "xtts_ready": True})

@app.route('/api/speakers', methods=['GET'])
def get_speakers():
    # قائمة الأصوات الافتراضية
    speakers = [
        {"speaker_id": "muhammad", "label": "محمد (صوت عربي)"},
        {"speaker_id": "sara", "label": "سارة (صوت هادئ)"}
    ]
    return jsonify(speakers)

@app.route('/api/dub', methods=['POST'])
def start_dubbing():
    data = request.json
    # إرسال المهمة إلى الـ Worker في بيتك عبر Upstash
    task = celery.send_task('tasks.process_tts', args=[data])
    return jsonify({"job_id": task.id, "status": "queued"})

@app.route('/api/job/<job_id>', methods=['GET'])
def get_job_status(job_id):
    res = celery.AsyncResult(job_id)
    if res.state == 'SUCCESS':
        return jsonify(res.result)
    return jsonify({"status": res.state, "progress": 50 if res.state == 'PROGRESS' else 0})

if __name__ == '__main__':
    # تحديد المنفذ الذي يطلبه Railway (5000)
    port = int(os.environ.get("PORT", 5000))
    app.run(host='0.0.0.0', port=port)
