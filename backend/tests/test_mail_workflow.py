"""Actual API regression tests with a disposable DB and a fake mail transport."""
import asyncio,importlib,sys,os
os.environ.setdefault("EMAIL_FROM_NAME", "Maison de test")
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock
import httpx,pytest
from fastapi import FastAPI
from mongomock_motor import AsyncMongoMockClient
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))

@pytest.fixture
def anyio_backend():return 'asyncio'

@pytest.fixture
async def mail_app(monkeypatch):
 import emailer,bookings,messages
 db=AsyncMongoMockClient().mail_workflow
 monkeypatch.setattr(emailer,'db',db);monkeypatch.setattr(emailer,'EMAIL_KEY','')
 monkeypatch.setenv('APP_ENV','preview');monkeypatch.setenv('EMAIL_DELIVERY_MODE','disabled');monkeypatch.setenv('OWNER_EMAIL','owner@example.com')
 monkeypatch.setitem(sys.modules,'giftcards',SimpleNamespace(recredit=AsyncMock(return_value=[])))
 async def user():return {'email':'owner@example.com'}
 async def content():return {'general':{'name':'Maison de test'},'pricing':{}}
 if hasattr(emailer,'content_provider'):monkeypatch.setattr(emailer,'content_provider',content)
 await messages.ensure_indexes(db)
 app=FastAPI();app.include_router(bookings.build_router(db,user,content,'owner@example.com'),prefix='/api');app.include_router(messages.build_router(db,user),prefix='/api')
 await db.bookings.insert_one({'id':'test-booking','name':'Client Test','email':'client@example.com','source':'direct','status':'nouvelle','check_in':'2027-03-01','check_out':'2027-03-03','guests':2,'total':200,'deposit_due':60,'payments':[],'history':[],'private_note':'PRIVATE DO NOT SEND'})
 async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app),base_url='https://example.com') as client:yield db,client,emailer

@pytest.mark.anyio
async def test_refusal_creates_client_email_and_preserves_truth_when_delivery_disabled(mail_app):
 db,c,mailer=mail_app
 r=await c.patch('/api/admin/booking-requests/test-booking',json={'status':'refusee','note':'PRIVATE INTERNAL REASON'})
 assert r.status_code==200 and r.json()['status']=='refusee'
 assert r.json()['refusal_notification']['status']=='non_envoye'
 logs=await db.email_log.find({}).to_list(20);assert len(logs)==1
 e=logs[0];assert e['category']=='reservation_refusee' and e['to']=='client@example.com' and e['audience']=='client'
 assert 'ne pas pouvoir accepter' in e['html'] and 'Maison de test' in e['html']
 assert 'PRIVATE' not in e['html'] and e['provider_id'] is None and e['sent_at'] is None
 assert (await c.get('/api/admin/emails',params={'audience':'client','status':'non_envoye'})).json()['total']==1
 await c.patch('/api/admin/booking-requests/test-booking',json={'status':'refusee'})
 assert await db.email_log.count_documents({})==1

@pytest.mark.anyio
async def test_old_refusal_can_be_retried_and_missing_email_is_explained(mail_app):
 db,c,mailer=mail_app
 await db.bookings.update_one({'id':'test-booking'},{'$set':{'status':'refusee','email':''}})
 r=await c.post('/api/admin/booking-requests/test-booking/refusal-email');assert r.status_code==200
 assert 'manquante' in r.json()['refusal_notification']['error']
 await db.bookings.update_one({'id':'test-booking'},{'$set':{'email':'updated@example.com'}})
 await c.post('/api/admin/booking-requests/test-booking/refusal-email')
 assert await db.email_log.count_documents({})==1
 assert (await db.email_log.find_one({}))['to']=='updated@example.com'

@pytest.mark.anyio
async def test_client_owner_filters_combine_with_search_for_legacy_and_new_mail(mail_app):
 db,c,mailer=mail_app
 for i,d in enumerate([{'to':'owner@example.com','subject':'Reservation A'}, {'to':'client@example.com','subject':'Reservation B'}, {'to':'other@example.com','subject':'Contact C','category':'contact_proprietaire'}]):
  await db.email_log.insert_one({'id':str(i),'status':'envoye','kind':'automatique','created_at':'2026-11-13T10:00:00Z',**d})
 owner=(await c.get('/api/admin/emails',params={'audience':'owner'})).json();assert owner['total']==2 and all(x['audience']=='owner' for x in owner['items'])
 clients=(await c.get('/api/admin/emails',params={'audience':'client'})).json();assert clients['total']==1 and clients['items'][0]['to']=='client@example.com'
 assert (await c.get('/api/admin/emails',params={'audience':'owner','q':'Reservation'})).json()['total']==1

@pytest.mark.anyio
async def test_disabled_reply_is_journaled_once_and_is_not_counted_as_sent(mail_app):
 db,c,mailer=mail_app
 await db.messages.insert_one({'id':'message-1','name':'Client','email':'client@example.com','message':'Bonjour','subject':'Question','created_at':'2026-11-13T10:00:00Z'})
 assert (await c.get('/api/admin/messages',params={'status':'non_lu'})).json()['total']==1
 for _ in range(2):
  r=await c.post('/api/admin/messages/message-1/reply',json={'subject':'Réponse','body':'Bonjour, voici notre réponse','client_token':'test-token-1'})
  assert r.json()['delivery_disabled'] and r.json()['recorded'] and not r.json()['ok']
 assert await db.email_log.count_documents({})==1
 rows=(await c.get('/api/admin/messages')).json()['items'];assert rows[0]['replies']==0

@pytest.mark.anyio
async def test_real_transport_is_called_once_per_refusal_transition(mail_app,monkeypatch):
 db,c,mailer=mail_app;out=[]
 monkeypatch.setenv('EMAIL_DELIVERY_MODE','enabled');monkeypatch.setattr(mailer,'EMAIL_KEY','unit-test-only')
 class Transport:
  def __init__(self,*a,**kw):pass
  async def __aenter__(self):return self
  async def __aexit__(self,*a):pass
  async def post(self,url,**kw):
   out.append(kw['json']);await asyncio.sleep(0)
   return httpx.Response(202,json={'id':'provider-'+str(len(out))},request=httpx.Request('POST',url))
 monkeypatch.setattr(mailer.httpx,'AsyncClient',Transport)
 results=await asyncio.gather(c.patch('/api/admin/booking-requests/test-booking',json={'status':'refusee'}),c.patch('/api/admin/booking-requests/test-booking',json={'status':'refusee'}))
 assert all(x.status_code==200 for x in results) and len(out)==1
 assert (await db.email_log.find_one({}))['status']=='envoye'
 await c.patch('/api/admin/booking-requests/test-booking',json={'status':'en_cours'})
 await c.patch('/api/admin/booking-requests/test-booking',json={'status':'refusee'})
 assert len(out)==2 and await db.email_log.count_documents({})==2

@pytest.mark.parametrize('lang',['fr','en','de','nl'])
def test_refusal_template_supports_customer_language_and_escapes_names(lang):
 from booking_refusal import refusal_email
 s,h=refusal_email({'name':'<script>alert(1)</script>','lang':lang,'check_in':'2027-03-01','check_out':'2027-03-02'},{'general':{'name':'Maison'}})
 assert '<script>' not in h and '2027-03-01' in h and 'Maison' in s
