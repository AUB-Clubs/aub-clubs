export const MAX_UPLOAD_FILE_BYTES = 5 * 1024 * 1024;
export const FUNCTION_SAFE_IMAGE_BYTES = 3 * 1024 * 1024;
export const MAX_IMAGE_COMPRESSION_ATTEMPTS = 8;

export async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Could not read image"));
    reader.readAsDataURL(blob);
  });
}

async function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new window.Image();

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Could not decode image"));
    };

    image.src = objectUrl;
  });
}

function canvasToJpegBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Could not compress image"));
          return;
        }
        resolve(blob);
      },
      "image/jpeg",
      quality
    );
  });
}

export async function prepareImageDataUrlForUpload(
  file: File,
  safeMaxBytes: number = FUNCTION_SAFE_IMAGE_BYTES
): Promise<{ dataUrl: string; size: number }> {
  if (file.size <= safeMaxBytes) {
    const dataUrl = await blobToDataUrl(file);
    return {
      dataUrl,
      size: file.size,
    };
  }

  const image = await loadImage(file);
  let scale = 1;
  let quality = 0.9;

  for (let attempt = 0; attempt < MAX_IMAGE_COMPRESSION_ATTEMPTS; attempt += 1) {
    const width = Math.max(1, Math.floor(image.naturalWidth * scale));
    const height = Math.max(1, Math.floor(image.naturalHeight * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Could not initialize image compression");
    }

    context.drawImage(image, 0, 0, width, height);
    const compressedBlob = await canvasToJpegBlob(canvas, quality);

    if (compressedBlob.size <= safeMaxBytes) {
      const dataUrl = await blobToDataUrl(compressedBlob);
      return {
        dataUrl,
        size: compressedBlob.size,
      };
    }

    if (quality > 0.6) {
      quality -= 0.1;
    } else {
      scale *= 0.85;
      quality = 0.82;
    }
  }

  throw new Error("Image is still too large after compression. Please choose a smaller image.");
}
