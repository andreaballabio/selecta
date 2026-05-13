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

# Expose the port Railway expects
EXPOSE 8080

# Use Railway's PORT variable (defaults to 8080)
ENV PYTHONUNBUFFERED=1

# Simple startup
CMD ["python", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080", "--log-level", "info"]
