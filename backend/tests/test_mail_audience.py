"""An owner address used as a customer must not change message purpose."""
import pytest
from mongomock import MongoClient
from mail_journal import audience_for, audience_query

@pytest.mark.parametrize('record,expected', [
 ({'to':'owner@example.com','category':'reponse','audience':'owner'},'client'),
 ({'to':'owner@example.com','category':'reservation_refusee'},'client'),
 ({'to':'guest@example.com','category':'contact_proprietaire','audience':'client'},'owner'),
 ({'to':'owner@example.com'},'client'),
 ({'audience':'owner'},'owner'),
])
def test_mail_purpose_and_filter_agree(record,expected):
 assert audience_for(record)==expected
 db=MongoClient().test
 db.mail.insert_one(record)
 assert db.mail.count_documents(audience_query(expected))==1
 assert db.mail.count_documents(audience_query('client' if expected=='owner' else 'owner'))==0
