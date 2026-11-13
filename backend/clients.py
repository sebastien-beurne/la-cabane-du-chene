"""Private client directory derived from bookings; no duplicate customer database."""
import math
import re
from fastapi import APIRouter, Depends, HTTPException

FIELDS = {"_id": 0, "id": 1, "name": 1, "email": 1, "phone": 1, "created_at": 1,
          "check_in": 1, "check_out": 1, "status": 1, "source": 1, "guests": 1}


def build_router(db, current_user):
    router = APIRouter()

    @router.get('/admin/clients')
    async def list_clients(q: str = '', page: int = 1, per: int = 20, user=Depends(current_user)):
        per = max(5, min(per, 50))
        # Email is the identity, never a name alone. Bookings without email remain separate.
        email = {'$toLower': {'$ifNull': ['$email', '']}}
        pipeline = [
            {'$match': {'deleted_at': None}},
            {'$sort': {'created_at': -1, 'id': 1}},
            {'$group': {
                '_id': {'$cond': [{'$ne': [email, '']}, {'$concat': ['email:', email]}, {'$concat': ['booking:', '$id']}]},
                'id': {'$first': '$id'}, 'name': {'$first': '$name'}, 'email': {'$first': '$email'},
                'phone': {'$first': '$phone'}, 'booking_count': {'$sum': 1},
                'last_booking_at': {'$max': '$created_at'}, 'check_in': {'$first': '$check_in'},
                'check_out': {'$first': '$check_out'}, 'status': {'$first': '$status'},
                'names': {'$addToSet': '$name'}, 'phones': {'$addToSet': '$phone'}}},
        ]
        if q.strip():
            rx = {'$regex': re.escape(q.strip()[:100]), '$options': 'i'}
            pipeline.append({'$match': {'$or': [{key: rx} for key in ('names', 'email', 'phones')]}})
        counts = await db.bookings.aggregate(pipeline + [{'$count': 'total'}]).to_list(1)
        total = counts[0]['total'] if counts else 0
        pages = max(1, math.ceil(total / per)); page = max(1, min(page, pages))
        rows = await db.bookings.aggregate(pipeline + [
            {'$sort': {'last_booking_at': -1, 'id': 1}}, {'$skip': (page-1)*per}, {'$limit': per},
            {'$project': {'_id': 0, 'names': 0, 'phones': 0}},
        ]).to_list(per)
        return {'items': rows, 'total': total, 'pages': pages, 'page': page}

    @router.get('/admin/clients/{booking_id}')
    async def client_history(booking_id: str, page: int = 1, per: int = 20, user=Depends(current_user)):
        booking = await db.bookings.find_one({'id': booking_id, 'deleted_at': None}, FIELDS)
        if not booking:
            raise HTTPException(404, 'Client introuvable')
        email = booking.get('email') or ''
        flt = {'deleted_at': None, **({'email': {'$regex': '^'+re.escape(email)+'$', '$options': 'i'}} if email else {'id': booking_id})}
        per = max(5, min(per, 50)); total = await db.bookings.count_documents(flt)
        pages = max(1, math.ceil(total/per)); page = max(1, min(page, pages))
        rows = await db.bookings.find(flt, FIELDS).sort([('created_at', -1), ('id', 1)]).skip((page-1)*per).limit(per).to_list(per)
        return {'items': rows, 'total': total, 'pages': pages, 'page': page}

    return router
