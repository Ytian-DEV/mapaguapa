const DEFAULT_MAX_DIMENSION = 1800;
const DEFAULT_QUALITY = 0.82;
const MIN_FILE_SIZE_TO_COMPRESS = 450 * 1024;

function isCompressibleImage(file: File) {
  return file.type.startsWith("image/") && !["image/gif", "image/svg+xml"].includes(file.type);
}

function loadImageFromFile(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error(`Failed to read ${file.name}.`));
    };

    image.src = objectUrl;
  });
}

function buildCompressedFileName(fileName: string, mimeType: string) {
  const baseName = fileName.replace(/\.[^.]+$/, "");

  if (mimeType === "image/webp") {
    return `${baseName}.webp`;
  }

  if (mimeType === "image/jpeg") {
    return `${baseName}.jpg`;
  }

  if (mimeType === "image/png") {
    return `${baseName}.png`;
  }

  return fileName;
}

export async function compressImageForUpload(file: File) {
  if (!isCompressibleImage(file) || file.size < MIN_FILE_SIZE_TO_COMPRESS) {
    return file;
  }

  try {
    const image = await loadImageFromFile(file);
    const width = image.naturalWidth || image.width;
    const height = image.naturalHeight || image.height;

    if (!width || !height) {
      return file;
    }

    const scale = Math.min(1, DEFAULT_MAX_DIMENSION / Math.max(width, height));
    const targetWidth = Math.max(1, Math.round(width * scale));
    const targetHeight = Math.max(1, Math.round(height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = targetHeight;

    const context = canvas.getContext("2d");
    if (!context) {
      return file;
    }

    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(image, 0, 0, targetWidth, targetHeight);

    const outputType = file.type === "image/png" ? "image/webp" : file.type === "image/webp" ? "image/webp" : "image/jpeg";

    const compressedBlob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, outputType, DEFAULT_QUALITY);
    });

    if (!compressedBlob || compressedBlob.size >= file.size) {
      return file;
    }

    return new File([compressedBlob], buildCompressedFileName(file.name, outputType), {
      type: outputType,
      lastModified: file.lastModified,
    });
  } catch {
    return file;
  }
}
