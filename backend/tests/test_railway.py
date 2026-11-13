"""Railway migration guards and media regressions, with no external services."""
import importlib,io,sys
from pathlib import Path
from unittest.mock import AsyncMock
from types import SimpleNamespace
import httpx,pytest
from mongomock_motor import AsyncMongoMockClient
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
@pytest.fixture
def anyio_backend():return 'asyncio'
@pytest.fixture
def railway(monkeypatch,tmp_path):
 import deployment_config
 env={'APP_ENV':'railway','DB_NAME':deployment_config.EXPECTED_DB_NAME,'RAILWAY_MONGO_HOST':'mongo-test.railway.internal','MONGO_URL':'mongodb://mongo-test.railway.internal:27017/?replicaSet=rs0&directConnection=true','JWT_SECRET':'test-only-secret-more-than-thirty-two-characters','ADMIN_EMAIL':'owner@example.com','OWNER_EMAIL':'owner@example.com','ADMIN_PASSWORD':'RailwayTestsOnly123!','SITE_URL':'https://example.com','CORS_ORIGINS':'https://example.com','MEDIA_ROOT':str(tmp_path/'media'),'STRIPE_SECRET_KEY':'','STRIPE_WEBHOOK_SECRET':'','EMERGENT_LLM_KEY':'','EMERGENT_EMAIL_KEY':'','EMAIL_DELIVERY_MODE':'disabled','PREVIEW_MEMORY_DB':'false'}
 for k,v in env.items():monkeypatch.setenv(k,v)
 return env
@pytest.mark.parametrize('key,value',[('DB_NAME','folies_railway_poc'),('MONGO_URL','mongodb://production.example.com'),('RAILWAY_MONGO_HOST','production.example.com'),('STRIPE_SECRET_KEY','invalid-key'),('JWT_SECRET','short'),('PREVIEW_MEMORY_DB','true')])
def test_rejects_production_or_ephemeral_configuration(railway,monkeypatch,key,value):
 import deployment_config
 deployment_config.validate();monkeypatch.setenv(key,value)
 with pytest.raises(RuntimeError):deployment_config.validate()
@pytest.mark.parametrize('key',['','sk_test_dummy','rk_test_dummy','sk_live_dummy','rk_live_dummy'])
def test_accepts_configured_stripe_modes(railway,monkeypatch,key):
 import deployment_config
 monkeypatch.setenv('STRIPE_SECRET_KEY',key);deployment_config.validate()
@pytest.fixture
async def app_client(railway,monkeypatch):
 import motor.motor_asyncio
 monkeypatch.setattr(motor.motor_asyncio,'AsyncIOMotorClient',AsyncMongoMockClient)
 previous={n:sys.modules.pop(n,None) for n in ['server','storage']}
 try:
  s=importlib.import_module('server')
  async with s.app.router.lifespan_context(s.app):
   async with httpx.AsyncClient(transport=httpx.ASGITransport(app=s.app),base_url='https://example.com') as c:yield s,c
 finally:
  for n,old in previous.items():
   sys.modules.pop(n,None)
   if old is not None:sys.modules[n]=old
@pytest.mark.anyio
async def test_health_auth_and_side_effect_guards(app_client):
 s,c=app_client;r=await c.get('/api/health')
 assert r.status_code==200 and r.json()=={'status':'ok','environment':'railway'}
 assert 'noindex' not in r.headers.get('x-robots-tag','')
 assert (await c.get('/api/admin/bank')).status_code==401
 assert (await c.post('/api/cron/auto-emails')).status_code==401
 assert (await c.post('/api/admin/ical/sync')).status_code==401
 assert (await c.post('/api/checkout')).status_code==503
 assert await s.db.users.count_documents({})==1
@pytest.mark.anyio
async def test_health_fails_when_mongo_is_unavailable(app_client,monkeypatch):
 s,c=app_client
 monkeypatch.setattr(s,'client',SimpleNamespace(admin=SimpleNamespace(command=AsyncMock(side_effect=RuntimeError('unavailable'))),close=lambda:None))
 assert (await c.get('/api/health')).status_code==503
@pytest.mark.anyio
async def test_email_disabled_until_explicitly_configured(app_client,monkeypatch):
 s,c=app_client
 monkeypatch.setattr(s.emailer,'EMAIL_KEY','configured-provider-key');monkeypatch.setenv('EMAIL_DELIVERY_MODE','disabled')
 def no_network(*a,**k):raise AssertionError('No provider request allowed')
 monkeypatch.setattr(s.emailer.httpx,'AsyncClient',no_network)
 assert not await s.emailer.send_email(to='owner@example.com',subject='Test',html='<p>Test</p>')
@pytest.mark.anyio
async def test_media_roundtrip_traversal_and_missing_cached_size(app_client):
 s,c=app_client
 from PIL import Image
 out=io.BytesIO();Image.new('RGB',(800,600),'green').save(out,'WEBP')
 path='tests/photo.webp';s.storage.put_object(path,out.getvalue(),'image/webp')
 assert s.storage.get_object(path)[0]==out.getvalue()
 for bad in ['../secret','/etc/passwd','']:
  with pytest.raises(ValueError):s.storage.put_object(bad,b'no','text/plain')
 await s.db.photos.insert_one({'id':'restored','storage_path':path,'deleted':False,'variants':[400]})
 r=await c.get('/api/files/'+path+'?w=400');assert r.status_code==200 and r.headers['content-type']=='image/webp'
 with Image.open(io.BytesIO(r.content)) as im:assert im.width==400
 assert s.storage.get_object(path+'.w400.webp')[0]==r.content

@pytest.mark.anyio
@pytest.mark.parametrize('theme',['spring','summer','autumn','winter','halloween','christmas','easter','valentine'])
async def test_seasonal_theme_publication_preserves_other_content(app_client,theme):
 s,c=app_client
 assert (await c.put('/api/admin/appearance',json={'theme':theme})).status_code==401
 assert (await c.post('/api/auth/login',json={'email':'owner@example.com','password':'RailwayTestsOnly123!'})).status_code==200
 await s.db.settings.update_one({'key':'content'},{'$set':{'data.general.name':'Keep identity','data.pricing.marker':'Keep pricing'}},upsert=True)
 r=await c.put('/api/admin/appearance',json={'theme':theme});assert r.status_code==200
 assert r.json()['appearance']['theme']==theme and r.json()['general']['name']=='Keep identity'
 # A stale generic editor must not overwrite a more recently published theme.
 stale=r.json();stale['appearance']['theme']='nature';stale['general']['name']='Updated identity'
 # Chene only supports signature as its base identity; generic stale appearance is ignored.
 if 'setup' not in stale:stale.pop('appearance')
 assert (await c.put('/api/admin/content',json=stale)).status_code==200
 assert (await c.get('/api/content')).json()['appearance']['theme']==theme
 assert (await c.put('/api/admin/appearance',json={'theme':'invalid'})).status_code==422
