FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    libsndfile1 \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Copy and install requirements
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application
COPY main.py .

ENV PORT=8080
ENV PYTHONUNBUFFERED=1
EXPOSE 8080

# Use exec to handle signals properly
CMD exec python -m uvicorn main:app --host 0.0.0.0 --port ${PORT} --log-level info
