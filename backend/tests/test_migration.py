"""Tests of the prepared migration. No production API, mail or payment calls."""
import importlib
import json
import os
import sys
from pathlib import Path

import httpx
import pytest

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'backend'))


@pytest.fixture
def anyio_backend(): return 'asyncio'


@pytest.mark.parametrize('app_env,memory', [('production', 'true'), ('preview', 'false')])
def test_demo_administrator_cannot_start_with_a_persistent_database(monkeypatch, app_env, memory):
    monkeypatch.setenv('APP_ENV', app_env)
    monkeypatch.setenv('PREVIEW_MEMORY_DB', memory)
    sys.modules.pop('preview_api', None)
    with pytest.raises(RuntimeError, match='disposable preview database'):
        importlib.import_module('preview_api')


@pytest.fixture
async def app_client(monkeypatch):
    values = {'APP_ENV':'preview', 'PREVIEW_MEMORY_DB':'true', 'DB_NAME':'migration_test',
              'JWT_SECRET':'migration-test-only-secret-not-for-production', 'ADMIN_EMAIL':'owner@example.com',
              'ADMIN_PASSWORD':'PreviewTestsOnly123!', 'OWNER_EMAIL':'owner@example.com',
              'SITE_URL':'https://example.com', 'CORS_ORIGINS':'https://example.com',
              'EMAIL_DELIVERY_MODE':'disabled', 'EMERGENT_EMAIL_KEY':'', 'EMERGENT_LLM_KEY':'',
              'EMAIL_FROM_NAME':'La Cabane du Chêne', 'STRIPE_SECRET_KEY':'', 'STRIPE_WEBHOOK_SECRET':''}
    for key,value in values.items():monkeypatch.setenv(key,value)
    sys.modules.pop('server', None)
    server = importlib.import_module('server')
    async with server.app.router.lifespan_context(server.app):
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=server.app),base_url='https://example.com') as client:
            yield server, client


def test_seed_has_chene_specific_commercial_rules():
    c=json.loads((ROOT/'backend/seed/content.json').read_text())
    assert c['general']['name']=='La Cabane du Chêne'
    assert c['general']['city']=='Valmunster'
    assert c['cabin']['surface']=='32 m²'
    assert c['pricing']['breakfast_included'] is True
    assert c['pricing']['deposit_percent']=='100'
    assert c['pricing']['rates']==[]
    assert c['gifts']['sales_enabled'] is False
    for old in ['Montmédy','La Cabane des Folies','lacabanedesfolies@gmail.com','175']:
        assert old not in json.dumps(c,ensure_ascii=False)


def test_all_imported_media_are_local_and_optimized():
    manifest=json.loads((ROOT/'docs/assets-manifest.json').read_text())
    assert len(manifest)==16
    for item in manifest:
        path=ROOT/'frontend/public'/item['path'].lstrip('/')
        assert path.is_file(), str(path)
        assert path.stat().st_size==item['optimized_bytes']
    assert sum(x['optimized_bytes'] for x in manifest)<4_000_000


def test_guide_photos_do_not_enter_lodging_gallery():
    photos=json.loads((ROOT/'backend/seed/photos.json').read_text())
    assert len([p for p in photos if p['category']=='guide'])==6
    assert len([p for p in photos if p['category']!='guide'])==9


@pytest.mark.parametrize('lang',['en','de','nl'])
def test_prepared_translations_match_server_and_client(lang):
    frontend=json.loads((ROOT/f'frontend/public/i18n/{lang}.json').read_text())
    backend=json.loads((ROOT/f'backend/i18n/{lang}.json').read_text())
    assert frontend==backend and len(frontend)>=400
    for source in ['Le calme, tout simplement.','Petit déjeuner inclus','Bientôt disponible en ligne','Payer {amount} par carte']:
        assert source in frontend and frontend[source]!=source
    import re
    for source,translated in frontend.items():
        assert sorted(re.findall(r'\{\w+\}',source))==sorted(re.findall(r'\{\w+\}',translated))


def test_translation_runtime_has_no_generation_dependency():
    code=(ROOT/'backend/static_i18n.py').read_text()
    assert 'LlmChat' not in code and 'create_subprocess' not in code
    assert not (ROOT/'backend/llm_worker.py').exists()


@pytest.mark.anyio
async def test_public_content_and_photos(app_client):
    server,client=app_client
    assert (await client.get('/api/content')).json()['general']['city']=='Valmunster'
    assert len((await client.get('/api/photos')).json())==15


@pytest.mark.anyio
async def test_administration_requires_login_and_opens_after_login(app_client):
    _,client=app_client
    assert (await client.get('/api/admin/gift-cards')).status_code==401
    assert (await client.post('/api/auth/login',json={'email':'owner@example.com','password':'PreviewTestsOnly123!'})).status_code==200
    assert (await client.get('/api/auth/me')).status_code==200
    assert (await client.get('/api/admin/readiness')).json()['preview'] is True


@pytest.mark.anyio
async def test_owner_can_edit_preconfigured_content(app_client):
    _,client=app_client
    await client.post('/api/auth/login',json={'email':'owner@example.com','password':'PreviewTestsOnly123!'})
    content=(await client.get('/api/content')).json()
    content['home']['intro_title']='Texte modifié pour le test'
    assert (await client.put('/api/admin/content',json=content)).status_code==200
    assert (await client.get('/api/content')).json()['home']['intro_title']=='Texte modifié pour le test'


@pytest.mark.anyio
async def test_contact_is_saved_without_sending_external_email(app_client,monkeypatch):
    server,client=app_client
    async def forbidden(*args,**kwargs):raise AssertionError('Unexpected external e-mail request')
    monkeypatch.setattr('httpx.AsyncClient.post',forbidden)
    # Use request() so only accidental mail-provider post() calls are rejected.
    result=await client.request('POST','/api/contact',json={'name':'Test Migration','email':'test@example.com','subject':'Demande de séjour','message':'Test local uniquement, ne pas envoyer.', 'consent':True,'elapsed_ms':3000,'lang':'nl'})
    assert result.status_code==200
    saved=await server.db.messages.find_one({'email':'test@example.com'})
    assert saved and saved['lang']=='nl'
    assert await server.db.email_log.count_documents({'status':'non_envoye'})==2


@pytest.mark.anyio
async def test_gift_sales_stay_blocked_until_configuration(app_client):
    server,client=app_client
    result=await client.post('/api/gift-cards/checkout',json={'type':'montant','amount':100,'buyer_name':'Test Buyer','buyer_email':'test@example.com','recipient_name':'Test','consent':True,'origin_url':'https://example.com'})
    assert result.status_code==503
    assert await server.db.gift_cards.count_documents({})==0


@pytest.mark.anyio
async def test_read_only_prepared_translation_api(app_client):
    _,client=app_client
    for lang in ['en','de','nl']:
        result=await client.post('/api/i18n/translate',json={'lang':lang,'texts':['Petit déjeuner inclus']})
        assert result.status_code==200
        assert result.json()['missing']==[]
        assert result.json()['map']['Petit déjeuner inclus']!='Petit déjeuner inclus'
