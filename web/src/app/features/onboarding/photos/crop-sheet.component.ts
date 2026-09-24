import {
  Component,
  ElementRef,
  OnDestroy,
  afterNextRender,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { MAT_BOTTOM_SHEET_DATA, MatBottomSheetRef } from '@angular/material/bottom-sheet';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import Panzoom, { PanzoomObject } from '@panzoom/panzoom';
import { MIN_SOURCE_SIZE, renderPhoto, visibleSquare } from './photo-processor';
import { PhotoStorageService } from './photo-storage.service';

export interface CropSheetData {
  file: File;
}

const MAX_ZOOM = 4;

/**
 * Bottom sheet to frame a photo as a square: the square is fixed, and the photo moves underneath
 * it (drag to move; pinch or mouse wheel to zoom), like the dating apps do. "Use photo" uploads the
 * two images (see docs/photos.md) and dismisses with the new photo's id; it dismisses with
 * undefined if cancelled. Loaded lazily.
 */
@Component({
  selector: 'app-crop-sheet',
  standalone: true,
  imports: [MatButtonModule, MatProgressSpinnerModule],
  templateUrl: './crop-sheet.component.html',
  styleUrl: './crop-sheet.component.scss',
})
export class CropSheetComponent implements OnDestroy {
  private readonly ref = inject<MatBottomSheetRef<CropSheetComponent, string>>(MatBottomSheetRef);
  private readonly storage = inject(PhotoStorageService);
  private readonly data = inject<CropSheetData>(MAT_BOTTOM_SHEET_DATA);

  private readonly frame = viewChild.required<ElementRef<HTMLElement>>('frame');
  private readonly image = viewChild.required<ElementRef<HTMLImageElement>>('image');

  private panzoom?: PanzoomObject;
  private bitmap?: ImageBitmap;
  private viewport = 0;

  readonly imageUrl = URL.createObjectURL(this.data.file);
  readonly ready = signal(false);
  readonly working = signal(false);
  readonly error = signal<string | null>(null);

  constructor() {
    afterNextRender(() => void this.setUp());
  }

  ngOnDestroy() {
    this.panzoom?.destroy();
    this.bitmap?.close();
    URL.revokeObjectURL(this.imageUrl);
  }

  cancel() {
    this.ref.dismiss();
  }

  /** Renders the two images, uploads them, and dismisses with the new photo's id. */
  async confirm() {
    if (!this.panzoom || !this.bitmap) return;
    this.working.set(true);
    this.error.set(null);
    this.ref.disableClose = true; // don't abandon a half-finished upload
    try {
      const crop = visibleSquare(
        this.bitmap,
        this.viewport,
        this.panzoom.getPan(),
        this.panzoom.getScale(),
      );
      const id = crypto.randomUUID();
      await this.storage.upload(id, await renderPhoto(this.bitmap, crop));
      this.ref.disableClose = false;
      this.ref.dismiss(id);
    } catch {
      this.ref.disableClose = false;
      this.error.set("We couldn't upload that photo. Check your connection and try again.");
    } finally {
      this.working.set(false);
    }
  }

  private async setUp() {
    const frame = this.frame().nativeElement;
    const image = this.image().nativeElement;
    this.bitmap = await createImageBitmap(this.data.file);
    const { width, height } = this.bitmap;

    // Size the photo so its short side exactly fills the square; panzoom then keeps it covering
    // the square ("contain: outside") while it is moved and zoomed.
    this.viewport = frame.clientWidth;
    const shortSide = Math.min(width, height);
    const displayedWidth = (width * this.viewport) / shortSide;
    const displayedHeight = (height * this.viewport) / shortSide;
    image.style.width = `${displayedWidth}px`;
    image.style.height = `${displayedHeight}px`;

    // Never zoom in so far that the visible part is smaller than the smallest photo we accept.
    const maxZoom = Math.max(1, Math.min(MAX_ZOOM, shortSide / MIN_SOURCE_SIZE));

    this.panzoom = Panzoom(image, {
      contain: 'outside',
      canvas: true,
      minScale: 1,
      maxScale: maxZoom,
      cursor: 'grab',
      animate: false,
      // Panzoom clips its parent by default; here the surrounding stage clips instead, so the
      // parts of the photo outside the square can show faded.
      overflow: 'visible',
      // Start centred (the untransformed position is the top-left corner). Panzoom applies its
      // start position asynchronously, so this has to be an option rather than a pan() call.
      startX: -(displayedWidth - this.viewport) / 2,
      startY: -(displayedHeight - this.viewport) / 2,
    });
    frame.addEventListener('wheel', this.panzoom.zoomWithWheel);
    this.ready.set(true);
  }
}
