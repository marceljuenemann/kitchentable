// Client-side photo processing. The sizes and reasoning are documented in docs/photos.md.

export const FULL_SIZE = 1080;
export const THUMB_SIZE = 600;
export const FULL_QUALITY = 0.85;
export const THUMB_QUALITY = 0.8;
/** The full image is re-encoded at lower quality if it comes out larger than this. */
export const FULL_TARGET_BYTES = 1_000_000;
/** Source photos smaller than this on their short side are rejected. */
export const MIN_SOURCE_SIZE = 600;
export const MAX_SOURCE_BYTES = 25 * 1024 * 1024;

export class PhotoError extends Error {}

export interface ProcessedPhoto {
  /** Up to FULL_SIZE square JPEG. */
  full: Blob;
  /** THUMB_SIZE square JPEG. */
  thumb: Blob;
}

/** Throws a PhotoError with a user-facing message if the file can't be used as a photo. */
export async function checkPhotoFile(file: File): Promise<void> {
  if (!file.type.startsWith('image/')) {
    throw new PhotoError("That file isn't an image.");
  }
  if (file.size > MAX_SOURCE_BYTES) {
    throw new PhotoError('That photo is too large (25 MB maximum).');
  }
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new PhotoError("We couldn't read that photo. Try a JPEG or PNG.");
  }
  const shortSide = Math.min(bitmap.width, bitmap.height);
  bitmap.close();
  if (shortSide < MIN_SOURCE_SIZE) {
    throw new PhotoError(`That photo is too small (at least ${MIN_SOURCE_SIZE} px needed).`);
  }
}

/** A square region of the source photo, in source pixels. */
export interface SquareCrop {
  x: number;
  y: number;
  size: number;
}

/**
 * The part of the source photo visible in the square viewport, given panzoom's state.
 *
 * The photo is displayed scaled so its short side equals the viewport (`viewport` CSS px), then
 * panzoom applies `scale(scale) translate(panX px, panY px)` about the element's centre, with the
 * element's untransformed top-left at the viewport's top-left.
 */
export function visibleSquare(
  source: { width: number; height: number },
  viewport: number,
  pan: { x: number; y: number },
  scale: number,
): SquareCrop {
  const displayed = {
    width: (source.width * viewport) / Math.min(source.width, source.height),
    height: (source.height * viewport) / Math.min(source.width, source.height),
  };
  const pixelsPerDisplayPx = source.width / displayed.width;
  const size = (viewport / scale) * pixelsPerDisplayPx;
  const left = displayed.width / 2 - displayed.width / (2 * scale) - pan.x;
  const top = displayed.height / 2 - displayed.height / (2 * scale) - pan.y;
  const clampedSize = Math.min(size, source.width, source.height);
  return {
    size: clampedSize,
    x: Math.min(Math.max(left * pixelsPerDisplayPx, 0), source.width - clampedSize),
    y: Math.min(Math.max(top * pixelsPerDisplayPx, 0), source.height - clampedSize),
  };
}

/**
 * Renders the two images we upload from the chosen square of the source photo: the full image
 * (recompressed if it is unusually heavy) and the thumbnail. Neither is ever upscaled.
 */
export async function renderPhoto(bitmap: ImageBitmap, crop: SquareCrop): Promise<ProcessedPhoto> {
  const fullSize = Math.round(Math.min(FULL_SIZE, crop.size));
  let full = await encodeJpeg(bitmap, crop, fullSize, FULL_QUALITY);
  for (const quality of [0.75, 0.65, 0.55]) {
    if (full.size <= FULL_TARGET_BYTES) break;
    full = await encodeJpeg(bitmap, crop, fullSize, quality);
  }
  const thumb = await encodeJpeg(
    bitmap,
    crop,
    Math.round(Math.min(THUMB_SIZE, crop.size)),
    THUMB_QUALITY,
  );
  return { full, thumb };
}

function encodeJpeg(
  bitmap: ImageBitmap,
  crop: SquareCrop,
  size: number,
  quality: number,
): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  if (!context) return Promise.reject(new PhotoError("We couldn't process that photo."));
  context.imageSmoothingQuality = 'high';
  context.drawImage(bitmap, crop.x, crop.y, crop.size, crop.size, 0, 0, size, size);
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new PhotoError("We couldn't process that photo."))),
      'image/jpeg',
      quality,
    ),
  );
}
