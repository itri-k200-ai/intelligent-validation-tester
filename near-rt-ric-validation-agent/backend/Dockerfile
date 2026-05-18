FROM python:3.12-slim

ARG CLAUDE_CODE_VERSION=latest

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1

RUN apt-get update && apt-get install -y --no-install-recommends \
        curl ca-certificates gnupg build-essential libpq-dev git tar \
        poppler-utils zip unzip file jq \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/* \
    && npm install -g @anthropic-ai/claude-code@${CLAUDE_CODE_VERSION}

WORKDIR /workspace/backend
COPY backend/requirements.txt /tmp/requirements.txt
RUN pip install --no-cache-dir -r /tmp/requirements.txt

EXPOSE 8000

CMD ["sh", "-c", "python manage.py makemigrations api --noinput && python manage.py migrate --noinput && python manage.py runserver 0.0.0.0:8000"]
