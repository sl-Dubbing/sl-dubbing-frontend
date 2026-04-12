import os
from flask import Flask, request, jsonify
from flask_cors import CORS
from celery import Celery  # ⬅️ تأكد من وجود هذا السطر!

app = Flask(__name__)

# إعدادات CORS الشاملة للسماح لموقع Vercel بالوصول للسيرفر
CORS(app, resources={r"/*": {"origins": "*"}}, supports_credentials=True)

# إعدادات Upstash (الرابط المشفر)
REDIS_URL = "rediss://default:gQAAAAAAAXrOAAIncDIyYWIyMzA5NTE2NTU0M2YzYjk0MGM0ZTVjZjRiZjA5M3AyOTY5NzQ@primary-muskrat-96974.upstash.io:6379"

celery_app = Celery('tasks', broker=REDIS_URL, backend=REDIS_URL)
celery_app.conf.update(
    broker_use_ssl={'ssl_cert_reqs': 'none'},
    redis_backend_use_ssl={'ssl_cert_reqs': 'none'},
    task_track_started=True,
    task_ignore_result=False,
    broker_connection_retry_on_startup=True
)

# ----------------------------------------------------
# 1. مسارات الواجهة الأساسية (لإضاءة اللمبة الخضراء)
# ----------------------------------------------------

@app.route('/api/status', methods=['GET', 'OPTIONS'])
def system_status():
    return jsonify({"status": "online"})

@app.route('/api/speakers', methods=['GET', 'OPTIONS'])
def get_speakers():
    return jsonify([])

@app.route('/api/upload_speaker', methods=['POST', 'OPTIONS'])
def upload_speaker():
    return jsonify({"message": "تمت العملية"})

# ----------------------------------------------------
# 2. مسارات الدبلجة السحابية
# ----------------------------------------------------

@app.route('/dub', methods=['POST', 'OPTIONS'])
def start_dubbing():
    if request.method == 'OPTIONS':
        return jsonify({"status": "ok"}), 200
    try:
        data = request.json
        # إرسال المهمة للـ Worker في RunPod
        task = celery_app.send_task('tasks.process_tts', args=[data])
        return jsonify({
            "task_id": task.id, 
            "status": "processing",
            "message": "Task sent to Cloud GPU"
        }), 202
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/status/<task_id>', methods=['GET', 'OPTIONS'])
def get_status(task_id):
    if request.method == 'OPTIONS':
        return jsonify({"status": "ok"}), 200
        
    task = celery_app.AsyncResult(task_id)
    
    if task.state == 'SUCCESS':
        return jsonify({
            "status": "done", 
            "audio_url": task.result.get('audio_url') if task.result else None
        })
    elif task.state == 'FAILURE':
        return jsonify({
            "status": "error", 
            "message": str(task.info)
        })
    elif task.state == 'PROGRESS':
        return jsonify({
            "status": "processing",
            "percent": task.info.get('percent', 0),
            "msg": task.info.get('msg', 'جاري العمل...')
        })
    else:
        return jsonify({
            "status": "processing",
            "percent": 5,
            "msg": "في الانتظار..."
        })

if __name__ == '__main__':
    port = int(os.environ.get("PORT", 5000))
    app.run(host='0.0.0.0', port=port)
