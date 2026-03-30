FROM python:3.11-slim

# Install uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

# Set working directory
WORKDIR /app

# Install CPU-only PyTorch first (saves ~2GB)
RUN uv pip install --system torch torchvision --index-url https://download.pytorch.org/whl/cpu

# Copy dependency files
COPY pyproject.toml .

# Install dependencies
RUN uv pip install --system --no-cache .

# Bake models into image during build (prevents cold-start)
RUN python -c "from transformers import pipeline; \
    pipeline('text-classification', model='KoalaAI/Text-Moderation'); \
    pipeline('image-classification', model='OwenElliott/image-safety-classifier-s')"

# Copy application code
COPY main.py .

EXPOSE 8080

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]
