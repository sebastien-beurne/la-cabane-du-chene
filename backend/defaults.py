"""La Cabane du Chêne: public seed data, independent of production records."""
import json
from pathlib import Path

SEED_DIR = Path(__file__).parent / "seed"
DEFAULT_CONTENT = json.loads((SEED_DIR / "content.json").read_text(encoding="utf-8"))
DEFAULT_PHOTOS = json.loads((SEED_DIR / "photos.json").read_text(encoding="utf-8"))
