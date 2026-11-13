"""Optional fixed tourist tax, calculated separately from commercial discounts."""
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from fastapi import HTTPException

def tourist_tax(pricing, nights, guests, taxable_guests=None):
    enabled=pricing.get('tourist_tax_enabled') is True
    if not enabled:return {'tourist_tax':0.0,'tourist_tax_guests':0,'tourist_tax_unit':0.0}
    try:
        rate=Decimal(str(pricing.get('tourist_tax_per_night') or '0').replace(',','.'))
        count=guests if taxable_guests is None else taxable_guests
        if not rate.is_finite() or not 0<rate<=100:raise ValueError()
        if isinstance(count,bool) or int(count)!=count or not 0<=count<=guests:raise ValueError()
    except (InvalidOperation,ValueError,TypeError,OverflowError):
        raise HTTPException(400,'Vérifiez le tarif de taxe de séjour et le nombre de personnes assujetties.')
    total=(rate*int(nights)*int(count)).quantize(Decimal('.01'),rounding=ROUND_HALF_UP)
    return {'tourist_tax':float(total),'tourist_tax_guests':int(count),'tourist_tax_unit':float(rate)}
