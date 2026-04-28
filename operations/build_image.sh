#!/bin/bash

# Check if required arguments are provided
if [ "$#" -lt 2 ]; then
    echo "Usage: $0 <IMAGE_REPO> <IMAGE_TAG> [DOCKERFILE] [CONTEXT]"
    exit 1
fi

# Calculate project root relative to this script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

IMAGE_REPO="$1"
IMAGE_TAG="$2"
DOCKERFILE="${3:-${PROJECT_ROOT}/Dockerfile}"
CONTEXT="${4:-${PROJECT_ROOT}}"

if [[ "$DOCKERFILE" != /* ]]; then
    DOCKERFILE="${PROJECT_ROOT}/${DOCKERFILE}"
fi

if [[ "$CONTEXT" != /* ]]; then
    CONTEXT="${PROJECT_ROOT}/${CONTEXT}"
fi

docker buildx build \
    --platform linux/amd64,linux/arm64 \
    -t "${IMAGE_REPO}:${IMAGE_TAG}" \
    -f "${DOCKERFILE}" \
    --push \
    "${CONTEXT}"
