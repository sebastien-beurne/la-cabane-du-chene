import pytest
from fastapi import HTTPException
from tourist_tax import tourist_tax

def test_disabled_tax_preserves_old_quotes():
 assert tourist_tax({},2,3)['tourist_tax']==0
def test_tax_accounts_for_exempt_guests_and_decimal_comma():
 assert tourist_tax({'tourist_tax_enabled':True,'tourist_tax_per_night':'0,88'},3,4,2)=={'tourist_tax':5.28,'tourist_tax_guests':2,'tourist_tax_unit':.88}
def test_all_exempt():
 assert tourist_tax({'tourist_tax_enabled':True,'tourist_tax_per_night':'1'},2,2,0)['tourist_tax']==0
@pytest.mark.parametrize('rate,count',[('NaN',1),('-1',1),('0',1),('1',3),('1',-1),('1',.5)])
def test_invalid_configuration_or_guest_count_is_rejected(rate,count):
 with pytest.raises(HTTPException):tourist_tax({'tourist_tax_enabled':True,'tourist_tax_per_night':rate},2,2,count)
