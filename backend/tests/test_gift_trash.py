import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
import pytest,httpx
from fastapi import FastAPI,HTTPException
from mongomock_motor import AsyncMongoMockClient
from gift_cards.router import build_router
from gift_cards.config import GiftConfig
from gift_cards.ledger import find_gift,state

@pytest.fixture
def anyio_backend():return 'asyncio'
@pytest.mark.anyio
async def test_gift_trash_preserves_balance_and_uses_but_disables_redemption():
 db=AsyncMongoMockClient().gifts
 async def user():return {'email':'owner@example.com'}
 async def price(n):return 100
 async def bank():return {}
 async def notify(*a,**k):return False
 r,_=build_router(db,user,config=GiftConfig(site_url='https://example.com'),price_for_stay=price,get_bank=bank,notify=notify)
 app=FastAPI();app.include_router(r)
 card={'id':'g','code':'CADEAU-TEST','amount':200,'balance':120,'status':'active','uses':[{'booking_id':'b','amount':80}], 'expires':'2028-01-01','created_at':'2026-11-13','buyer_email':'test@example.com'}
 await db.gift_cards.insert_one(dict(card))
 async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app),base_url='https://example.com') as c:
  assert (await c.post('/admin/gift-cards/g/trash')).status_code==200
  stored=await db.gift_cards.find_one({'id':'g'});assert state(stored)=='supprimee' and stored['balance']==120 and stored['uses']==card['uses']
  assert (await c.get('/admin/gift-cards')).json()==[]
  assert len((await c.get('/admin/gift-cards',params={'trash':True})).json())==1
  with pytest.raises(HTTPException):await find_gift(db,card['code'])
  assert (await c.patch('/admin/gift-cards/g',json={'status':'active'})).status_code==404
  assert (await c.post('/admin/gift-cards/g/resend')).status_code==404
  await c.post('/admin/gift-cards/g/restore')
  assert (await find_gift(db,card['code']))['balance']==120
  assert len((await c.get('/admin/gift-cards')).json())==1
