FROM node:22-bookworm-slim AS frontend
WORKDIR /build/frontend
COPY frontend/package*.json ./
RUN npm ci --legacy-peer-deps
COPY frontend/ ./
ENV REACT_APP_BACKEND_URL="" REACT_APP_RAILWAY="true"
RUN npm run build

FROM python:3.11-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 APP_ENV=railway
WORKDIR /app/backend
COPY backend/requirements-railway.txt /tmp/requirements.txt
RUN pip install --no-cache-dir -r /tmp/requirements.txt && useradd --uid 10001 --create-home cabane && mkdir -p /app/media && chown cabane:cabane /app/media
COPY --chown=cabane:cabane backend/ ./
COPY --from=frontend /build/frontend/build /app/web
COPY deploy/railway/web.py ./railway_web.py
# Railway volumes are mounted as root; the entrypoint fixes only this service's media directory.
COPY deploy/railway/start.sh /app/start.sh
CMD ["sh", "/app/start.sh"]

