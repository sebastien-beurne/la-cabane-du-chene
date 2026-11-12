"""Local review only: actual API routes, disposable in-memory database, no external sends.

Production on Emergent runs backend.server:app against its configured MongoDB.
"""
import argparse
import json
import os
from pathlib import Path
import secrets
import signal
import subprocess
import sys
import time

parser = argparse.ArgumentParser()
parser.add_argument('--host', default='127.0.0.1')
parser.add_argument('--port', default='3000')
parser.add_argument('--strictPort', action='store_true')
args = parser.parse_args()
ROOT = Path(__file__).resolve().parents[1]
session = {'email': 'apercu@lacabaneduchene.fr', 'password': secrets.token_urlsafe(18)}
(ROOT / '.preview-session.json').write_text(json.dumps(session))
env = {**os.environ, 'APP_ENV': 'preview', 'PREVIEW_MEMORY_DB': 'true',
       'DB_NAME': 'cabane_du_chene_preview', 'JWT_SECRET': secrets.token_urlsafe(48),
       'ADMIN_EMAIL': session['email'], 'ADMIN_PASSWORD': session['password'],
       'OWNER_EMAIL': 'contact@lacabaneduchene.fr', 'EMAIL_DELIVERY_MODE': 'disabled',
       'EMAIL_FROM_NAME': 'La Cabane du Chêne', 'SITE_URL': 'https://lacabaneduchene.fr',
       'CORS_ORIGINS': 'http://localhost:3000', 'COOKIE_SECURE': 'true',
       'EMERGENT_LLM_KEY': '', 'EMERGENT_EMAIL_KEY': '', 'ENABLE_AI_TRANSLATION': 'false', 'STRIPE_SECRET_KEY': '', 'STRIPE_WEBHOOK_SECRET': ''}
children = []
try:
    children.append(subprocess.Popen([sys.executable, '-m', 'uvicorn', 'preview_api:app', '--host', '127.0.0.1', '--port', '8001'], cwd=ROOT/'backend', env=env))
    children.append(subprocess.Popen(['node', 'node_modules/vite/bin/vite.js', '--host', args.host, '--port', args.port, '--strictPort'], cwd=ROOT/'frontend', env={**env, 'API_PROXY_URL':'http://127.0.0.1:8001', 'PORT':args.port}))
    while all(p.poll() is None for p in children):
        time.sleep(0.5)
    raise SystemExit(next((p.returncode for p in children if p.returncode is not None), 1))
finally:
    for p in children:
        if p.poll() is None: p.terminate()
    for p in children:
        try: p.wait(timeout=5)
        except subprocess.TimeoutExpired: p.kill()
