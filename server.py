import os
from flask import Flask, request, jsonify
from flask_cors import CORS
from celery import Celery

app = Flask(__name__)

# تفعيل CORS بشكل عالمي وصحيح
CORS(app, resources={r"/*": {"origins": "*"}})

REDIS_URL = "rediss://default:gQAAAAAAAXrOAAIncDIyYWIyMzA5NTE2NTU0M2YzYjk0MGM0ZTVjZjRiZjA5M3AyOTY5NzQ@primary-muskrat-96974.upstash.io:6379"

celery_app = Celery('tasks', broker=REDIS_URL, backend=REDIS_URL)
celery_app.conf.update(
    broker_use_ssl={'ssl_cert_reqs': 'none'},
    redis_backend_use_ssl={'ssl_cert_reqs': 'none'},
    task_track_started=True,
    task_ignore_result=False
)

@app.route('/api/status', methods=['GET'])
def system_status():
    return jsonify({"status": "online"})

@app.route('/dub', methods=['POST'])
def start_dubbing():
    try:
        data = request.json
        task = celery_app.send_task('tasks.process_tts', args=[data])
        return jsonify({"task_id": task.id, "status": "processing"}), 202
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/status/<task_id>', methods=['GET'])
def get_status(task_id):
    task = celery_app.AsyncResult(task_id)
    if task.state == 'SUCCESS':
        return jsonify({"status": "done", "audio_url": task.result.get('audio_url')})
    elif task.state == 'PROGRESS':
        return jsonify({"status": "processing", "percent": task.info.get('percent', 0), "msg": task.info.get('msg', '')})
    return jsonify({"status": "processing"})

if __name__ == '__main__':
    # استخدام المنفذ الممرر من النظام
    port = int(os.environ.get("PORT", 5000))
    app.run(host='0.0.0.0', port=port)
