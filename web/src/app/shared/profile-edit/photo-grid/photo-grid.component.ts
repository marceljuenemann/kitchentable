import { CdkDrag, CdkDragDrop, CdkDropList, moveItemInArray } from '@angular/cdk/drag-drop';
import {
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { MatBottomSheet } from '@angular/material/bottom-sheet';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { firstValueFrom } from 'rxjs';
import { PhotoStorageService } from '../../../core/photo-storage.service';
import { MAX_PHOTOS } from '../../../core/profile-options';
import { PROFILE_SHEET_CONFIG } from '../field-sheets';
import { CropSheetComponent } from '../photos/crop-sheet.component';
import { checkPhotoFile, PhotoError } from '../photos/photo-processor';

/**
 * Up to six photos to add (picked, then cropped and uploaded in the crop sheet), remove and drag
 * into order, the first being the main one. It shows the stored photos and reports changes; the
 * caller keeps the list of ids.
 */
@Component({
  selector: 'app-photo-grid',
  standalone: true,
  imports: [CdkDrag, CdkDropList, MatIconModule, MatProgressSpinnerModule],
  templateUrl: './photo-grid.component.html',
  styleUrl: './photo-grid.component.scss',
})
export class PhotoGridComponent {
  private readonly bottomSheet = inject(MatBottomSheet);
  private readonly storage = inject(PhotoStorageService);

  /** Ids of the photos, in display order (first = main); see docs/photos.md. */
  readonly photos = input.required<string[]>();
  /**
   * Removes a photo: deletes its files and drops it from the list, in whichever order suits the
   * caller. If it throws, the grid says the photo couldn't be removed.
   */
  readonly remove = input.required<(id: string) => Promise<void>>();
  /** A photo has been uploaded: add it at the end. */
  readonly added = output<string>();
  /** The photos in their new order, after one was dragged. */
  readonly reordered = output<string[]>();
  /** A photo whose files are gone (say, after a local database reset): forget it. */
  readonly missing = output<string>();

  /** Signed thumbnail URLs by photo id, fetched from storage (so photos survive a reload). */
  private readonly urls = signal<Record<string, string>>({});

  /** One entry per grid tile: the photo (its URL is null while loading), or null if empty. */
  readonly slots = computed(() =>
    Array.from({ length: MAX_PHOTOS }, (_, index) => {
      const id = this.photos()[index];
      return id ? { id, url: this.urls()[id] ?? null } : null;
    }),
  );

  readonly busy = signal(false);
  readonly error = signal<string | null>(null);

  constructor() {
    effect(() => {
      const ids = this.photos();
      untracked(() => void this.loadUrls(ids));
    });
  }

  /** Crops and adds each chosen photo, one after the other (up to the six-photo limit). */
  async onFilesChosen(event: Event) {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    input.value = ''; // so choosing the same file again still triggers a change
    this.error.set(null);
    this.busy.set(true);
    try {
      // Counted here, since `photos` only changes once the caller's template has updated.
      let count = this.photos().length;
      for (const file of files) {
        if (count >= MAX_PHOTOS) break;
        if (await this.addFile(file)) count++;
      }
    } finally {
      this.busy.set(false);
    }
  }

  async onRemove(id: string) {
    this.error.set(null);
    try {
      await this.remove()(id);
    } catch {
      this.error.set("We couldn't remove that photo. Please try again.");
    }
  }

  /** The first photo is the main one, so dragging a photo to the first tile makes it the main. */
  reorder(event: CdkDragDrop<unknown>) {
    if (event.previousIndex === event.currentIndex) return;
    const ids = [...this.photos()];
    moveItemInArray(ids, event.previousIndex, event.currentIndex);
    this.reordered.emit(ids);
  }

  /** Resolves with whether the photo was added. */
  private async addFile(file: File): Promise<boolean> {
    try {
      await checkPhotoFile(file);
      const id = await this.crop(file);
      if (id) this.added.emit(id);
      return id !== undefined;
    } catch (error) {
      this.error.set(
        error instanceof PhotoError ? error.message : 'Something went wrong with that photo.',
      );
      return false;
    }
  }

  /** Opens the crop sheet, which uploads the photo; resolves with the new photo's id. */
  private crop(file: File): Promise<string | undefined> {
    const ref = this.bottomSheet.open(CropSheetComponent, {
      ...PROFILE_SHEET_CONFIG,
      data: { file },
    });
    return firstValueFrom(ref.afterDismissed());
  }

  /** Fetches URLs for photos we don't have one for yet, and reports photos whose file is gone. */
  private async loadUrls(ids: string[]) {
    const missing = ids.filter((id) => !(id in this.urls()));
    if (missing.length === 0) return;
    try {
      const fetched = await this.storage.thumbUrls(missing);
      const found = Object.fromEntries(
        [...fetched].filter((entry): entry is [string, string] => entry[1] !== null),
      );
      this.urls.update((urls) => ({ ...urls, ...found }));
      [...fetched].filter(([, url]) => url === null).forEach(([id]) => this.missing.emit(id));
    } catch {
      this.error.set("We couldn't load your photos. Please reload the page.");
    }
  }
}
