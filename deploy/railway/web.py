"""Serve the built SPA and API from the same Railway service."""
import mimetypes
from pathlib import Path
from starlette.exceptions import HTTPException
from starlette.staticfiles import StaticFiles
from server import app

# Minimal Python images do not always ship a system MIME database for WebP.
mimetypes.add_type("image/webp", ".webp")

class SPAFiles(StaticFiles):
    async def get_response(self, path, scope):
        if path == "api" or path.startswith("api/"):
            raise HTTPException(404)
        try:
            return await super().get_response(path, scope)
        except HTTPException as exc:
            if exc.status_code != 404 or "." in Path(path).name:
                raise
            return await super().get_response("index.html", scope)

app.mount("/", SPAFiles(directory="/app/web", html=True), name="web")

