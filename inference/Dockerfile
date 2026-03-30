FROM python:3.11-slim

# Install uv for insanely fast dependency resolution
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

WORKDIR /app

# Force Hugging Face cache to a predictable, explicit path
ENV HF_HOME=/app/.cache/huggingface

# Install CPU-only PyTorch first (shaves off ~2GB)
RUN uv pip install --system torch torchvision --index-url https://download.pytorch.org/whl/cpu

# Copy dependency files (include lockfile for deterministic GKE deployments)
COPY pyproject.toml uv.lock* ./

# Install dependencies globally
RUN uv pip install --system --no-cache .

# Bake models directly into the /app/.cache/huggingface directory
RUN python -c "from transformers import pipeline; \
    pipeline('text-classification', model='KoalaAI/Text-Moderation'); \
    pipeline('image-classification', model='OwenElliott/image-safety-classifier-s')"

# Copy application code
COPY main.py .

EXPOSE 8080

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]