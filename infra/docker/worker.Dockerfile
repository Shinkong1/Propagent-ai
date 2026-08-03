FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y gcc libpq-dev && rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir --upgrade pip setuptools
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ ./backend/
COPY agents/ ./agents/
COPY voice/ ./voice/
COPY workers/ ./workers/
COPY lead_engine/ ./lead_engine/

ENV PYTHONPATH=/app:/app/backend

CMD ["celery", "-A", "workers.celery_app", "worker", "--loglevel=info"]
