# AUB Clubs - ML Inference Service

FastAPI service for content moderation using ML models.

## Tech Stack

- **Python 3.11+**
- **Package Manager**: `uv` (fast Python package manager)
- **Framework**: FastAPI + Uvicorn
- **ML Models**: 
  - `KoalaAI/Text-Moderation` (text classification)
  - `OwenElliott/image-safety-classifier-s` (image classification)

## Local Development

### Prerequisites

- [uv](https://github.com/astral-sh/uv) installed (`brew install uv` or `curl -LsSf https://astral.sh/uv/install.sh | sh`)
- Docker (for containerized development)

### Option 1: Docker Compose (Recommended)

```bash
# Start the service
docker-compose up

# Service will be available at http://localhost:8080
```

### Option 2: Local Python with uv

```bash
# Install dependencies
uv sync

# Run the service
uv run uvicorn main:app --host 0.0.0.0 --port 8080 --reload

# Or activate venv and run directly
source .venv/bin/activate
uvicorn main:app --host 0.0.0.0 --port 8080 --reload
```

### Option 3: Just run with uv (no venv needed)

```bash
uv run --with fastapi --with uvicorn --with transformers --with pillow \
  uvicorn main:app --host 0.0.0.0 --port 8080
```

## API Endpoints

### Health Check
```bash
curl http://localhost:8080/health
```

### Moderate Text
```bash
curl -X POST http://localhost:8080/moderate \
  -H "Content-Type: application/json" \
  -d '{"text":"Some text to moderate"}'
```

### Moderate Image
```bash
curl -X POST http://localhost:8080/moderate \
  -H "Content-Type: application/json" \
  -d '{"image":"base64-encoded-image"}'
```

### Moderate Both
```bash
curl -X POST http://localhost:8080/moderate \
  -H "Content-Type: application/json" \
  -d '{"text":"Some text","image":"base64-encoded-image"}'
```

## Adding Dependencies

```bash
# Add a new dependency
uv add <package-name>

# Add a dev dependency
uv add --dev <package-name>

# Update all dependencies
uv sync --upgrade
```

## Building Docker Image

```bash
# Build
docker build -t hamzarach69/aub-clubs-inference:latest .

# Push
docker push hamzarach69/aub-clubs-inference:latest
```

## Notes

- Models are downloaded and baked into the Docker image during build
- First build takes ~5 minutes (downloads PyTorch + models)
- Subsequent builds use layer caching
- CPU-only PyTorch is used to save ~2GB in image size
