FROM python:3.11-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

RUN apt-get update \
    && apt-get install -y --no-install-recommends libgl1 libglib2.0-0 curl \
    && rm -rf /var/lib/apt/lists/*

COPY ml_requirements.txt .
RUN pip install --no-cache-dir -r ml_requirements.txt

COPY ml_backend_api.py .
COPY urbanflow_app ./urbanflow_app
COPY models ./models
COPY yolov5s.pt .
COPY backend/uploads ./uploads

EXPOSE 8000
CMD ["uvicorn", "ml_backend_api:app", "--host", "0.0.0.0", "--port", "8000"]
