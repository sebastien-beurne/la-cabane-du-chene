"""Truthful mail history, including blocked deliveries and recipient classification."""
import os
import uuid
from datetime import datetime,timezone
from pymongo import ReturnDocument

def audience_for(record):
    category=str(record.get('category') or '')
    if category:return 'owner' if category.endswith('_proprietaire') else 'client'
    return 'owner' if record.get('audience')=='owner' else 'client'

def audience_query(audience):
    rules=[{'category':{'$regex':'_proprietaire$'}}, {'$and':[{'category':{'$in':[None,'']}},{'audience':'owner'}]}]
    return {'$or':rules} if audience=='owner' else {'$nor':rules}

async def record_blocked(db, *, to,subject,html,kind='automatique',category='',ref=None,dedupe_key=None,reason='Envoi désactivé dans cet environnement',lang='fr'):
    if db is None:return None
    key=dedupe_key or 'disabled:'+str(uuid.uuid4())
    prior=await db.email_log.find_one({'dedupe_key':key})
    if prior and prior.get('deleted_at'):return prior
    if prior and prior.get('status') in {'envoye','livre','en_cours'}:return prior
    stamp=datetime.now(timezone.utc).isoformat()
    rec={'to':to,'subject':subject,'html':html,'kind':kind,'category':category,'ref':ref,'status':'non_envoye','error':reason,'provider_id':None,'sent_at':None,'lang':lang,'updated_at':stamp}
    rec['audience']=audience_for(rec)
    return await db.email_log.find_one_and_update({'dedupe_key':key},{'$set':rec,'$setOnInsert':{'id':str(uuid.uuid4()),'dedupe_key':key,'created_at':stamp},'$inc':{'attempts':1}},upsert=True,return_document=ReturnDocument.AFTER)
