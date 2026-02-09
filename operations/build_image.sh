#!/bin/bash

# Check if required arguments are provided
if [ "$#" -lt 2 ]; then
    echo "Usage: $0 <IMAGE_REPO> <IMAGE_TAG> [DOCKERFILE]"
    exit 1
fi

IMAGE_REPO="$1"

# Calculate project root relative to this script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

IMAGE_REPO="$1"
IMAGE_TAG="$2"
DOCKERFILE="${3:-${PROJECT_ROOT}/Dockerfile}"

docker buildx build \
    --platform linux/amd64,linux/arm64 \
    -t "${IMAGE_REPO}:${IMAGE_TAG}" \
    -f "${DOCKERFILE}" \
    --push \
    "${PROJECT_ROOT}"