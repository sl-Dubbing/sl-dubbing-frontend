# server.py - FIXED VERSION
# Copy this file to replace the existing server.py

import os
import logging
import jwt
from datetime import datetime, timedelta
from functools import wraps
from flask import Flask, request, jsonify, redirect
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from werkzeug.security import check_password_hash, generate_password_hash
from celery import Celery
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# ============================================================================
# CONFIGURATION
# ============================================================================

app = Flask(__name__)
app.config['JSON_SORT_KEYS'] = False

# Security Configuration
SECRET_KEY = os.getenv("SECRET_KEY")
if not SECRET_KEY:
    raise ValueError("SECRET_KEY environment variable not set! Generate with: python -c \"import secrets; print(secrets.token_urlsafe(32))\"")

ENV = os.getenv('ENV', 'development')
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000,http://localhost:5000").split(",")

# Redis Configuration
REDIS_URL = os.getenv("CELERY_BROKER_URL")
if not REDIS_URL:
    raise ValueError("CELERY_BROKER_URL environment variable not set")

# ============================================================================
# LOGGING
# ============================================================================

if not os.path.exists('logs'):
    os.mkdir('logs')

from logging.handlers import RotatingFileHandler
file_handler = RotatingFileHandler('logs/app.log', maxBytes=10240000, backupCount=10)
file_handler.setFormatter(logging.Formatter(
    '%(asctime)s %(levelname)s: %(message)s [in %(pathname)s:%(lineno)d]'
))
file_handler.setLevel(logging.INFO)
app.logger.addHandler(file_handler)
app.logger.setLevel(logging.INFO)

# ============================================================================
# MIDDLEWARE
# ============================================================================

# CORS Configuration - Secure
CORS(app, 
     resources={r"/api/*": {
         "origins": ALLOWED_ORIGINS,
         "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
         "allow_headers": ["Content-Type", "Authorization"],
         "expose_headers": ["Content-Type", "X-RateLimit-Limit", "X-RateLimit-Remaining"],
         "supports_credentials": True,
         "max_age": 3600
     }}
)

# Rate Limiting
limiter = Limiter(
    app=app,
    key_func=get_remote_address,
    storage_uri=REDIS_URL,
    default_limits=[],
    strategy="moving-window"
)

@app.errorhandler(429)
def ratelimit_handler(e):
    app.logger.warning(f"Rate limit exceeded for {get_remote_address()}")
    return jsonify({"error": "Rate limit exceeded. Please try again later."}), 429

# ============================================================================
# SECURITY HEADERS
# ============================================================================

@app.before_request
def enforce_https():
    """Force HTTPS in production"""
    if ENV == 'production':
        if request.headers.get('X-Forwarded-Proto', 'http') != 'https':
            url = request.url.replace('http://', 'https://', 1)
            return redirect(url, code=301)

@app.after_request
def set_security_headers(response):
    """Add security headers to all responses"""
    response.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['X-Frame-Options'] = 'DENY'
    response.headers['X-XSS-Protection'] = '1; mode=block'
    response.headers['Content-Security-Policy'] = "default-src 'self'; script-src 'self' cdnjs.cloudflare.com; style-src 'self' 'unsafe-inline' cdnjs.cloudflare.com"
    response.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'
    return response

# ============================================================================
# CELERY SETUP
# ============================================================================

def make_celery(app):
    celery = Celery(
        app.import_name,
        backend=REDIS_URL,
        broker=REDIS_URL
    )
    celery.conf.update(
        broker_use_ssl={'ssl_cert_reqs': 'none'},
        redis_backend_use_ssl={'ssl_cert_reqs': 'none'},
        task_track_started=True,
        task_ignore_result=False,
        result_expires=3600,  # Results expire after 1 hour
        task_soft_time_limit=180,  # 3 minute soft limit
        task_time_limit=240,  # 4 minute hard limit
    )
    
    class ContextTask(celery.Task):
        def __call__(self, *args, **kwargs):
            with app.app_context():
                return self.run(*args, **kwargs)
    
    celery.Task = ContextTask
    return celery

celery_app = make_celery(app)

# ============================================================================
# AUTHENTICATION
# ============================================================================

# Mock user database (use real database in production!)
USERS_DB = {
    "abd199641@gmail.com": {
        "password_hash": generate_password_hash("demo_password_123"),  # CHANGE THIS!
        "name": "ALHASHMI Design",
        "role": "admin"
    },
    "ahlil.ma@gmail.com": {
        "password_hash": generate_password_hash("user_password_456"),  # CHANGE THIS!
        "name": "Mona Alhil",
        "role": "user"
    }
}

JWT_EXPIRATION = timedelta(hours=24)

def token_required(f):
    """Decorator to require valid JWT token"""
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        
        # Check Authorization header
        if 'Authorization' in request.headers:
            auth_header = request.headers['Authorization']
            try:
                token = auth_header.split(" ")[1]
            except IndexError:
                app.logger.warning(f"Malformed auth header from {get_remote_address()}")
                return jsonify({"error": "Malformed authorization header"}), 401
        
        if not token:
            return jsonify({"error": "Token required"}), 401
        
        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=['HS256'])
            request.user = payload
            request.user_email = payload['email']
        except jwt.ExpiredSignatureError:
            app.logger.warning(f"Expired token used by {get_remote_address()}")
            return jsonify({"error": "Token expired"}), 401
        except jwt.InvalidTokenError as e:
            app.logger.warning(f"Invalid token from {get_remote_address()}: {str(e)}")
            return jsonify({"error": "Invalid token"}), 401
        
        return f(*args, **kwargs)
    
    return decorated

# ============================================================================
# AUTH ENDPOINTS
# ============================================================================

@app.route('/api/auth/login', methods=['POST'])
@limiter.limit("5 per hour")
def login():
    """Secure login endpoint with JWT token generation"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({"error": "Request body required"}), 400
        
        email = data.get('email', '').lower().strip()
        password = data.get('password', '')
        
        # Validate input
        if not email or not password:
            app.logger.warning(f"Login attempt with missing credentials from {get_remote_address()}")
            return jsonify({"error": "Email and password required"}), 400
        
        if len(password) < 6:
            return jsonify({"error": "Invalid credentials"}), 401
        
        user = USERS_DB.get(email)
        
        # Don't reveal which emails exist in database
        if not user or not check_password_hash(user['password_hash'], password):
            app.logger.warning(f"Failed login attempt for {email} from {get_remote_address()}")
            return jsonify({"error": "Invalid credentials"}), 401
        
        # Generate JWT token
        payload = {
            'email': email,
            'name': user['name'],
            'role': user.get('role', 'user'),
            'iat': datetime.utcnow(),
            'exp': datetime.utcnow() + JWT_EXPIRATION
        }
        token = jwt.encode(payload, SECRET_KEY, algorithm='HS256')
        
        app.logger.info(f"Successful login for {email}")
        
        return jsonify({
            "token": token,
            "user": {
                "email": email,
                "name": user['name']
            }
        }), 200
        
    except Exception as e:
        app.logger.error(f"Login error: {str(e)}")
        return jsonify({"error": "Authentication failed"}), 500

@app.route('/api/auth/refresh', methods=['POST'])
@token_required
def refresh_token():
    """Refresh JWT token before expiration"""
    try:
        email = request.user['email']
        user = USERS_DB.get(email)
        
        if not user:
            return jsonify({"error": "User not found"}), 404
        
        payload = {
            'email': email,
            'name': user['name'],
            'role': user.get('role', 'user'),
            'iat': datetime.utcnow(),
            'exp': datetime.utcnow() + JWT_EXPIRATION
        }
        token = jwt.encode(payload, SECRET_KEY, algorithm='HS256')
        
        return jsonify({"token": token}), 200
        
    except Exception as e:
        app.logger.error(f"Token refresh error: {str(e)}")
        return jsonify({"error": "Token refresh failed"}), 500

# ============================================================================
# HEALTH & STATUS ENDPOINTS
# ============================================================================

@app.route('/api/health', methods=['GET'])
def health_check():
    """System health check"""
    try:
        # Check Celery connection
        celery_app.control.inspect().active()
        return jsonify({"status": "online", "timestamp": datetime.utcnow().isoformat()}), 200
    except Exception as e:
        app.logger.error(f"Health check failed: {str(e)}")
        return jsonify({"status": "offline", "error": str(e)}), 503

@app.route('/api/status/<task_id>', methods=['GET'])
@limiter.limit("60 per hour")
def get_status(task_id):
    """Get task status"""
    try:
        # Validate task_id format (UUID)
        if not isinstance(task_id, str) or len(task_id) < 10:
            return jsonify({"error": "Invalid task ID"}), 400
        
        task = celery_app.AsyncResult(task_id)
        
        if task.state == 'PENDING':
            return jsonify({"status": "pending"}), 200
        
        elif task.state == 'PROGRESS':
            return jsonify({
                "status": "processing",
                "percent": task.info.get('percent', 0),
                "msg": task.info.get('msg', 'Processing...')
            }), 200
        
        elif task.state == 'SUCCESS':
            result = task.result
            return jsonify({
                "status": "done",
                "audio_url": result.get('audio_url', ''),
                "duration": result.get('duration', 0)
            }), 200
        
        elif task.state == 'FAILURE':
            app.logger.error(f"Task {task_id} failed: {task.info}")
            return jsonify({
                "status": "error",
                "error": str(task.info)
            }), 200
        
        else:
            return jsonify({"status": task.state}), 200
            
    except Exception as e:
        app.logger.error(f"Status check error: {str(e)}")
        return jsonify({"error": "Failed to get status"}), 500

# ============================================================================
# DUBBING ENDPOINTS
# ============================================================================

@app.route('/api/dub', methods=['POST'])
@limiter.limit("3 per hour")
@token_required
def start_dubbing():
    """Start video dubbing task"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({"error": "Request body required"}), 400
        
        # Validate request structure
        segments = data.get('segments', [])
        lang = data.get('lang', 'ar')
        speaker_id = data.get('speaker_id', 'muhammad')
        
        if not isinstance(segments, list) or len(segments) == 0:
            return jsonify({"error": "Segments must be a non-empty list"}), 400
        
        if not isinstance(segments[0], dict) or 'text' not in segments[0]:
            return jsonify({"error": "Each segment must have 'text' field"}), 400
        
        # Validate language
        valid_langs = ['ar', 'en', 'fr', 'de', 'tr', 'zh-cn', 'ja', 'ko', 'es', 'it', 'pt', 'nl', 'pl']
        if lang not in valid_langs:
            return jsonify({"error": f"Unsupported language: {lang}"}), 400
        
        # Validate text length
        total_text = sum(len(s.get('text', '')) for s in segments)
        if total_text > 50000:
            return jsonify({"error": "Text too long (max 50000 characters)"}), 400
        
        # Queue task
        task = celery_app.send_task('tasks.process_tts', args=[{
            'segments': segments,
            'lang': lang,
            'speaker_id': speaker_id,
            'user_email': request.user_email
        }])
        
        app.logger.info(f"Dubbing task {task.id} started by {request.user_email}")
        
        return jsonify({
            "task_id": task.id,
            "status": "processing"
        }), 202
        
    except Exception as e:
        app.logger.error(f"Dubbing start error: {str(e)}")
        return jsonify({"error": "Failed to start dubbing"}), 500

# ============================================================================
# ERROR HANDLERS
# ============================================================================

@app.errorhandler(400)
def bad_request(error):
    return jsonify({"error": "Bad request"}), 400

@app.errorhandler(401)
def unauthorized(error):
    return jsonify({"error": "Unauthorized"}), 401

@app.errorhandler(403)
def forbidden(error):
    return jsonify({"error": "Forbidden"}), 403

@app.errorhandler(404)
def not_found(error):
    return jsonify({"error": "Not found"}), 404

@app.errorhandler(500)
def internal_error(error):
    app.logger.error(f"Internal server error: {str(error)}")
    return jsonify({"error": "Internal server error"}), 500

# ============================================================================
# STARTUP
# ============================================================================

if __name__ == '__main__':
    app.logger.info(f"Starting server in {ENV} mode")
    
    if ENV == 'development':
        app.run(
            host='0.0.0.0',
            port=int(os.environ.get("PORT", 5000)),
            debug=True
        )
    else:
        # Production: gunicorn handles this
        pass
