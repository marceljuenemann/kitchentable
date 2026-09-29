import {
  checkPhotoFile,
  FULL_SIZE,
  MAX_SOURCE_BYTES,
  MIN_SOURCE_SIZE,
  PhotoError,
  renderPhoto,
  THUMB_SIZE,
  visibleSquare,
} from './photo-processor';

/** A JPEG file of the given size: the left half red, the right half blue. */
async function jpegFile(width: number, height: number): Promise<File> {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d')!;
  context.fillStyle = '#ff0000';
  context.fillRect(0, 0, width / 2, height);
  context.fillStyle = '#0000ff';
  context.fillRect(width / 2, 0, width / 2, height);
  const blob = await new Promise<Blob>((resolve) =>
    canvas.toBlob((b) => resolve(b!), 'image/jpeg', 0.9),
  );
  return new File([blob], 'photo.jpg', { type: 'image/jpeg' });
}

async function sizeOf(blob: Blob): Promise<[number, number]> {
  const bitmap = await createImageBitmap(blob);
  const size: [number, number] = [bitmap.width, bitmap.height];
  bitmap.close();
  return size;
}

/** The colour of the pixel at the centre of the given image. */
async function centrePixel(blob: Blob, xFraction = 0.5): Promise<number[]> {
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const context = canvas.getContext('2d')!;
  context.drawImage(bitmap, 0, 0);
  const pixel = context.getImageData(Math.floor(bitmap.width * xFraction), bitmap.height / 2, 1, 1);
  bitmap.close();
  return Array.from(pixel.data);
}

describe('visibleSquare', () => {
  // A 1600x1200 photo in a 300 px viewport is displayed 400x300 (short side = viewport), so
  // panzoom's pan of -50 centres it horizontally (the cropper starts there).
  const landscape = { width: 1600, height: 1200 };

  it('shows the full short side when not zoomed', () => {
    expect(visibleSquare(landscape, 300, { x: -50, y: 0 }, 1)).toEqual({
      x: 200,
      y: 0,
      size: 1200,
    });
  });

  it('follows the pan, in source pixels', () => {
    // Dragging the photo right by 20 px reveals 20 px more of its left side (80 source px).
    expect(visibleSquare(landscape, 300, { x: -30, y: 0 }, 1).x).toBe(120);
    expect(visibleSquare(landscape, 300, { x: -70, y: 0 }, 1).x).toBe(280);
  });

  it('halves the visible area when zoomed to 2x', () => {
    expect(visibleSquare(landscape, 300, { x: 0, y: 0 }, 2).size).toBe(600);
  });

  it('centres a portrait photo vertically the same way', () => {
    const portrait = { width: 1200, height: 1600 };
    expect(visibleSquare(portrait, 300, { x: 0, y: -50 }, 1)).toEqual({ x: 0, y: 200, size: 1200 });
  });

  it('never leaves the photo, whatever the pan and zoom', () => {
    for (const scale of [0.5, 1, 1.5, 3, 10]) {
      for (const x of [-500, -100, -50, 0, 50, 500]) {
        for (const y of [-500, -100, 0, 100, 500]) {
          const crop = visibleSquare(landscape, 300, { x, y }, scale);
          const where = `scale ${scale}, pan ${x},${y}`;
          expect(crop.size).withContext(where).toBeLessThanOrEqual(1200);
          expect(crop.x).withContext(where).toBeGreaterThanOrEqual(0);
          expect(crop.y).withContext(where).toBeGreaterThanOrEqual(0);
          expect(crop.x + crop.size)
            .withContext(where)
            .toBeLessThanOrEqual(1600);
          expect(crop.y + crop.size)
            .withContext(where)
            .toBeLessThanOrEqual(1200);
        }
      }
    }
  });
});

describe('checkPhotoFile', () => {
  const message = async (file: File) => {
    try {
      await checkPhotoFile(file);
    } catch (error) {
      expect(error).toBeInstanceOf(PhotoError);
      return (error as Error).message;
    }
    return null;
  };

  it('accepts a big enough image', async () => {
    expect(await message(await jpegFile(MIN_SOURCE_SIZE + 100, MIN_SOURCE_SIZE + 100))).toBeNull();
  });

  it('rejects something that is not an image', async () => {
    const file = new File(['hello'], 'notes.txt', { type: 'text/plain' });
    expect(await message(file)).toBe("That file isn't an image.");
  });

  it('rejects a file over the size limit', async () => {
    const file = new File(['x'], 'huge.jpg', { type: 'image/jpeg' });
    Object.defineProperty(file, 'size', { value: MAX_SOURCE_BYTES + 1 });
    expect(await message(file)).toBe('That photo is too large (25 MB maximum).');
  });

  it('rejects an image the browser cannot decode', async () => {
    const file = new File(['not really a jpeg'], 'broken.jpg', { type: 'image/jpeg' });
    expect(await message(file)).toContain("couldn't read that photo");
  });

  it('rejects a photo whose short side is too small, however long the other side is', async () => {
    const file = await jpegFile(MIN_SOURCE_SIZE - 1, 2000);
    expect(await message(file)).toContain('too small');
  });
});

describe('renderPhoto', () => {
  it('produces a 1080 square full image and a 600 square thumbnail from a big crop', async () => {
    const bitmap = await createImageBitmap(await jpegFile(1600, 1200));
    const { full, thumb } = await renderPhoto(bitmap, { x: 200, y: 0, size: 1200 });
    bitmap.close();

    expect(full.type).toBe('image/jpeg');
    expect(thumb.type).toBe('image/jpeg');
    expect(await sizeOf(full)).toEqual([FULL_SIZE, FULL_SIZE]);
    expect(await sizeOf(thumb)).toEqual([THUMB_SIZE, THUMB_SIZE]);
  });

  it('does not upscale a crop smaller than the target sizes', async () => {
    const bitmap = await createImageBitmap(await jpegFile(1000, 800));
    const { full, thumb } = await renderPhoto(bitmap, { x: 0, y: 0, size: 500 });
    bitmap.close();

    expect(await sizeOf(full)).toEqual([500, 500]);
    expect(await sizeOf(thumb)).toEqual([500, 500]);
  });

  it('renders the chosen part of the photo', async () => {
    const bitmap = await createImageBitmap(await jpegFile(1600, 800));
    // The left half of the photo is red and the right half blue: crop each side in turn.
    const left = await renderPhoto(bitmap, { x: 0, y: 0, size: 800 });
    const right = await renderPhoto(bitmap, { x: 800, y: 0, size: 800 });
    bitmap.close();

    const [leftRed, , leftBlue] = await centrePixel(left.thumb);
    expect(leftRed).toBeGreaterThan(200);
    expect(leftBlue).toBeLessThan(60);
    const [rightRed, , rightBlue] = await centrePixel(right.thumb);
    expect(rightRed).toBeLessThan(60);
    expect(rightBlue).toBeGreaterThan(200);
  });
});
