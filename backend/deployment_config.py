"""Fail closed unless this deployment uses its own private Railway database."""
import os
from urllib.parse import urlsplit
EXPECTED_DB_NAME = 'chene_railway'

def enabled():
    return os.environ.get('APP_ENV') == 'railway'

def validate():
    if not enabled(): return
    host = os.environ.get('RAILWAY_MONGO_HOST', '')
    mongo = urlsplit(os.environ.get('MONGO_URL', ''))
    if not host.endswith('.railway.internal') or mongo.scheme != 'mongodb' or mongo.hostname != host:
        raise RuntimeError('Railway deployment requires its dedicated private MongoDB host')
    if os.environ.get('DB_NAME') != EXPECTED_DB_NAME:
        raise RuntimeError('Incorrect isolated database name')
    if os.environ.get('PREVIEW_MEMORY_DB') == 'true':
        raise RuntimeError('Railway requires persistent MongoDB')
    key = os.environ.get('STRIPE_SECRET_KEY', '')
    if key and not key.startswith(('sk_test_', 'rk_test_', 'sk_live_', 'rk_live_')):
        raise RuntimeError('deployment requires a valid Stripe secret key')
    if len(os.environ.get('JWT_SECRET', '')) < 32:
        raise RuntimeError('Set a random JWT_SECRET of at least 32 characters')
