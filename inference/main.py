import base64
import logging
from io import BytesIO
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, ValidationError
from transformers import pipeline
from PIL import Image

# Configure logging
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

app = FastAPI(title="Content Moderation Service", version="1.0.0")

# Load models on startup
logger.info("Loading text moderation model...")
text_moderator = pipeline(
    "text-classification", model="KoalaAI/Text-Moderation", top_k=None
)
logger.info("Text moderation model loaded successfully")

logger.info("Loading image moderation model...")
image_moderator = pipeline(
    "image-classification", model="OwenElliott/image-safety-classifier-s", top_k=None
)
logger.info("Image moderation model loaded successfully")


class ModerationRequest(BaseModel):
    text: str | None = None
    image: str | None = None


@app.get("/health")
async def health():
    """Health check endpoint for Kubernetes probes"""
    return {"status": "healthy", "models": "loaded"}


@app.post("/moderate")
async def moderate(request: ModerationRequest):
    """
    Moderate text and/or image content.

    Args:
        request: ModerationRequest with optional text and/or base64 image

    Returns:
        Dictionary with text_flags and/or image_flags arrays
    """
    logger.info(
        f"Moderation request received - text: {bool(request.text)}, image: {bool(request.image)}"
    )

    if not request.text and not request.image:
        logger.warning("Empty moderation request received")
        raise HTTPException(status_code=400, detail="Must provide either text or image")

    results = {}

    # Process text moderation
    if request.text:
        logger.info(f"Processing text moderation (length: {len(request.text)})")
        try:
            text_results = text_moderator(request.text)[0]
            results["text_flags"] = text_results
            logger.info(f"Text moderation complete - found {len(text_results)} flags")
        except Exception as e:
            logger.error(f"Text moderation failed: {str(e)}", exc_info=True)
            raise HTTPException(
                status_code=500, detail=f"Text moderation failed: {str(e)}"
            )

    # Process image moderation
    if request.image:
        logger.info("Processing image moderation")
        try:
            # Strip data URI prefix if present
            base64_string = request.image
            if base64_string.startswith("data:image"):
                logger.debug("Stripping data URI prefix from base64 image")
                base64_string = base64_string.split(",", 1)[1]

            # Decode base64 -> PIL.Image
            image_bytes = base64.b64decode(base64_string)
            image_size_kb = len(image_bytes) / 1024
            logger.info(f"Decoded image size: {image_size_kb:.2f} KB")

            pil_image = Image.open(BytesIO(image_bytes)).convert("RGB")
            logger.info(f"Image dimensions: {pil_image.size}")

            # Run moderation
            image_results = image_moderator(pil_image)
            results["image_flags"] = image_results
            logger.info(f"Image moderation complete - found {len(image_results)} flags")

        except base64.binascii.Error as e:
            logger.error(f"Invalid base64 encoding: {str(e)}")
            raise HTTPException(status_code=400, detail="Invalid base64 image data")
        except Exception as e:
            logger.error(f"Image moderation failed: {str(e)}", exc_info=True)
            raise HTTPException(
                status_code=500, detail=f"Image moderation failed: {str(e)}"
            )

    logger.info("Moderation request completed successfully")
    return results


@app.on_event("startup")
async def startup_event():
    logger.info("=" * 50)
    logger.info("Content Moderation Service Started")
    logger.info("=" * 50)


@app.on_event("shutdown")
async def shutdown_event():
    logger.info("Content Moderation Service Shutting Down")
