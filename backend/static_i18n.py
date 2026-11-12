"""Prepared translations only. No AI, external service or per-visit generation."""
import json
from html import escape
from html.parser import HTMLParser
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

LANGS = {"en": "English", "de": "Deutsch", "nl": "Nederlands"}
ROOT = Path(__file__).parent / "i18n"
BUNDLES = {lang: json.loads((ROOT / f"{lang}.json").read_text(encoding="utf-8")) for lang in LANGS}


async def translate_many(lang: str, texts: List[str], missing_out: Optional[list] = None) -> dict:
    bundle = BUNDLES.get(lang, {})
    result = {}
    for source in dict.fromkeys(texts):
        key = source.strip()
        if key in bundle:
            result[source] = source.replace(key, bundle[key])
        else:
            result[source] = source
            if lang != "fr" and missing_out is not None:
                missing_out.append(source)
    return result


async def translate_email(lang: str, subject: str, html: str) -> tuple[str, str]:
    """Translate prepared static HTML text nodes, preserving tags and recipient data."""
    if lang not in LANGS:
        return subject, html
    bundle = BUNDLES[lang]
    class MailParser(HTMLParser):
        def __init__(self):
            super().__init__(convert_charrefs=False)
            self.parts = []
        def handle_starttag(self, tag, attrs): self.parts.append(self.get_starttag_text())
        def handle_startendtag(self, tag, attrs): self.parts.append(self.get_starttag_text())
        def handle_endtag(self, tag): self.parts.append(f"</{tag}>")
        def handle_data(self, text):
            key = text.strip()
            translated = text.replace(key, bundle[key]) if key in bundle else text
            if key.startswith("Bonjour "):
                translated = text.replace("Bonjour ", {"en":"Hello ", "de":"Guten Tag ", "nl":"Hallo "}[lang], 1)
            self.parts.append(escape(translated))
        def handle_entityref(self, name): self.parts.append(f"&{name};")
        def handle_charref(self, name): self.parts.append(f"&#{name};")
    parser = MailParser()
    parser.feed(html)
    return bundle.get(subject, subject), "".join(parser.parts)


class TrIn(BaseModel):
    lang: str
    texts: List[str] = Field(max_length=150)


def build_router(database):
    router = APIRouter()
    @router.post("/i18n/translate")
    async def translate(body: TrIn):
        if body.lang not in LANGS:
            raise HTTPException(400, "Langue non prise en charge")
        missing = []
        result = await translate_many(body.lang, [t[:3000] for t in body.texts], missing)
        return {"lang": body.lang, "map": {k: v for k, v in result.items() if k not in missing}, "missing": missing}
    return router
