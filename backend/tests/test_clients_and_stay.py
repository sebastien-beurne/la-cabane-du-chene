import os,sys
from pathlib import Path
os.environ.setdefault('EMAIL_FROM_NAME','Maison de test')
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
import pytest,httpx
from fastapi import FastAPI,HTTPException
from mongomock_motor import AsyncMongoMockClient

@pytest.fixture
def anyio_backend(): return 'asyncio'
@pytest.fixture
async def app(monkeypatch):
 import clients,stay_messages,messages,emailer
 db=AsyncMongoMockClient().clients_test
 monkeypatch.setattr(emailer,'db',db);monkeypatch.setattr(emailer,'EMAIL_KEY','')
 monkeypatch.setenv('EMAIL_DELIVERY_MODE','disabled')
 async def user():return {'email':'owner@example.com'}
 api=FastAPI()
 for router in [clients.build_router(db,user),stay_messages.build_router(db,user),messages.build_router(db,user)]:api.include_router(router,prefix='/api')
 await messages.ensure_indexes(db)
 for b in [
 {'id':'a','name':'Alice','email':'ALICE@example.com','phone':'123','created_at':'2026-01-01','check_in':'2026-11-14','check_out':'2026-11-16'},
 {'id':'b','name':'Alice Nouveau','email':'alice@example.com','phone':'456','created_at':'2026-11-01','check_in':'2026-12-01','check_out':'2026-12-03'},
 {'id':'c','name':'Sans mail','email':''},{'id':'d','name':'Sans mail','email':''}]:
  await db.bookings.insert_one({'status':'confirmee','guests':2,'history':[],**b})
 async with httpx.AsyncClient(transport=httpx.ASGITransport(app=api),base_url='https://test.example') as c:yield db,c

@pytest.mark.anyio
async def test_clients_group_email_without_merging_names_and_show_history(app):
 db,c=app
 data=(await c.get('/api/admin/clients')).json();assert data['total']==3
 alice=next(x for x in data['items'] if x['id']=='b');assert alice['booking_count']==2 and alice['last_booking_at']=='2026-11-01'
 assert (await c.get('/api/admin/clients',params={'q':'123'})).json()['total']==1
 history=(await c.get('/api/admin/clients/b')).json();assert history['total']==2 and history['items'][0]['id']=='b'
 assert 'history' not in history['items'][0]
 assert (await c.get('/api/admin/clients/c')).json()['total']==1
 assert (await c.get('/api/admin/clients/nope')).status_code==404

@pytest.mark.anyio
async def test_client_pagination_is_exact_and_search_is_literal(app):
 db,c=app
 for i in range(18):await db.bookings.insert_one({'id':f'x{i}','name':f'Client {i}','email':f'x{i}@example.com','created_at':'2026-11-13'})
 d=(await c.get('/api/admin/clients',params={'page':99,'per':5})).json();assert d['total']==21 and d['pages']==5 and d['page']==5 and len(d['items'])==1
 assert (await c.get('/api/admin/clients',params={'q':'.*'})).json()['total']==0

@pytest.mark.anyio
async def test_stay_templates_are_private_personalized_and_require_fresh_preview(app):
 db,c=app
 assert (await c.get('/api/admin/booking-requests/a/stay-message/arrival')).status_code==409
 template={'subject':'Arrivée {arrivee}','body':'Bonjour {prenom}, arrivée {arrivee}, départ {depart}. Code privé 9999.'}
 assert (await c.put('/api/admin/stay-messages/arrival',json=template)).status_code==200
 p=(await c.get('/api/admin/booking-requests/a/stay-message/arrival')).json();assert 'Bonjour Alice' in p['body'] and '14/11/2026' in p['body']
 payload={'client_token':'test-token-123','preview_hash':p['preview_hash']}
 await c.put('/api/admin/stay-messages/arrival',json={**template,'body':template['body']+' Changement'})
 assert (await c.post('/api/admin/booking-requests/a/stay-message/arrival',json=payload)).status_code==409
 p=(await c.get('/api/admin/booking-requests/a/stay-message/arrival')).json();payload['preview_hash']=p['preview_hash']
 for _ in range(2):
  r=await c.post('/api/admin/booking-requests/a/stay-message/arrival',json=payload);assert r.status_code==200 and r.json()['delivery_disabled'] and not r.json()['ok']
 assert await db.email_log.count_documents({})==1
 assert len((await db.bookings.find_one({'id':'a'}))['history'])==1
 await db.bookings.update_one({'id':'a'},{'$set':{'status':'refusee'}})
 assert (await c.get('/api/admin/booking-requests/a/stay-message/arrival')).status_code==409
 assert (await c.put('/api/admin/stay-messages/arrival',json={'subject':'Bonjour','body':'Test {inconnue}'})).status_code==400

@pytest.mark.anyio
async def test_message_and_email_trash_preserve_history_and_require_restore_before_actions(app):
 db,c=app
 await db.messages.insert_one({'id':'m','name':'Test','email':'test@example.com','message':'Bonjour'})
 await db.email_log.insert_one({'id':'e','to':'test@example.com','subject':'Test','status':'non_envoye','dedupe_key':'one','html':'<p>Test</p>'})
 assert (await c.get('/api/admin/messages')).json()['unread']==1
 assert (await c.delete('/api/admin/messages/m')).status_code==200
 assert (await c.get('/api/admin/messages')).json()['total']==0
 assert (await c.get('/api/admin/messages')).json()['unread']==0
 assert (await c.get('/api/admin/messages',params={'trash':True})).json()['total']==1
 assert (await c.post('/api/admin/messages/m/reply',json={'subject':'Re: test','body':'Réponse','client_token':'12345678'})).status_code==409
 await c.post('/api/admin/messages/m/restore');assert (await c.get('/api/admin/messages')).json()['total']==1
 await c.delete('/api/admin/emails/e');assert (await c.get('/api/admin/emails')).json()['total']==0
 assert (await c.get('/api/admin/emails',params={'trash':True})).json()['total']==1
 assert (await c.post('/api/admin/emails/e/retry')).status_code==409
 assert (await db.email_log.find_one({'id':'e'}))['html']=='<p>Test</p>'
 await c.post('/api/admin/emails/e/restore');assert (await c.get('/api/admin/emails')).json()['total']==1

@pytest.mark.anyio
async def test_clients_and_templates_require_authentication():
 import clients,stay_messages
 db=AsyncMongoMockClient().private
 async def denied():raise HTTPException(401,'Authentification requise')
 a=FastAPI();a.include_router(clients.build_router(db,denied));a.include_router(stay_messages.build_router(db,denied))
 async with httpx.AsyncClient(transport=httpx.ASGITransport(app=a),base_url='https://test') as c:
  for route in ['/admin/clients','/admin/clients/a','/admin/stay-messages/arrival','/admin/booking-requests/a/stay-message/welcome']:
   assert (await c.get(route)).status_code==401
