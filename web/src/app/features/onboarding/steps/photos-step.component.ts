import { CdkDrag, CdkDragDrop, CdkDropList, moveItemInArray } from '@angular/cdk/drag-drop';
import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { MatBottomSheet } from '@angular/material/bottom-sheet';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { firstValueFrom } from 'rxjs';
import { OnboardingDraftStore, ONBOARDING_STEPS } from '../onboarding-draft.store';
import { MAX_PHOTOS } from '../onboarding-options';
import { checkPhotoFile, PhotoError } from '../photos/photo-processor';
import { PhotoStorageService } from '../photos/photo-storage.service';

/** Onboarding step 3: add and crop up to six photos. */
@Component({
  selector: 'app-photos-step',
  standalone: true,
  imports: [CdkDrag, CdkDropList, MatButtonModule, MatIconModule, MatProgressSpinnerModule],
  templateUrl: './photos-step.component.html',
  styleUrl: './photos-step.component.scss',
})
export class PhotosStepComponent {
  private readonly store = inject(OnboardingDraftStore);
  private readonly bottomSheet = inject(MatBottomSheet);
  private readonly storage = inject(PhotoStorageService);

  readonly photoIds = computed(() => this.store.draft().photos);
  readonly totalSteps = ONBOARDING_STEPS;
  readonly maxPhotos = MAX_PHOTOS;

  /** Signed thumbnail URLs by photo id, fetched from storage (so photos survive a reload). */
  private readonly urls = signal<Record<string, string>>({});

  /** One entry per grid tile: the photo (its URL is null while loading), or null if empty. */
  readonly slots = computed(() =>
    Array.from({ length: MAX_PHOTOS }, (_, index) => {
      const id = this.photoIds()[index];
      return id ? { id, url: this.urls()[id] ?? null } : null;
    }),
  );

  readonly busy = signal(false);
  readonly error = signal<string | null>(null);

  readonly canContinue = computed(() => this.photoIds().length > 0);

  constructor() {
    effect(() => {
      const ids = this.photoIds();
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
      for (const file of files) {
        if (this.photoIds().length >= MAX_PHOTOS) break;
        await this.addFile(file);
      }
    } finally {
      this.busy.set(false);
    }
  }

  async remove(id: string) {
    this.error.set(null);
    try {
      await this.storage.remove(id);
      this.store.removePhoto(id);
    } catch {
      this.error.set("We couldn't remove that photo. Please try again.");
    }
  }

  /** The first photo is the main one, so dragging a photo to the first tile makes it the main. */
  reorder(event: CdkDragDrop<unknown>) {
    if (event.previousIndex === event.currentIndex) return;
    const ids = [...this.photoIds()];
    moveItemInArray(ids, event.previousIndex, event.currentIndex);
    this.store.update({ photos: ids });
  }

  next() {
    if (this.canContinue()) this.store.update({ step: 4 });
  }

  private async addFile(file: File) {
    try {
      await checkPhotoFile(file);
      const id = await this.crop(file);
      if (id) this.store.addPhoto(id);
    } catch (error) {
      this.error.set(
        error instanceof PhotoError ? error.message : 'Something went wrong with that photo.',
      );
    }
  }

  /** Opens the crop sheet, which uploads the photo; resolves with the new photo's id. */
  private async crop(file: File): Promise<string | undefined> {
    // Loaded on demand: the crop sheet (with panzoom) is only needed here.
    const { CropSheetComponent } = await import('../photos/crop-sheet.component');
    const ref = this.bottomSheet.open(CropSheetComponent, {
      data: { file },
      panelClass: 'kt-bottom-sheet',
      autoFocus: 'dialog',
    });
    return firstValueFrom(ref.afterDismissed());
  }

  /** Fetches URLs for photos we don't have one for yet, and drops photos whose file is gone. */
  private async loadUrls(ids: string[]) {
    const missing = ids.filter((id) => !(id in this.urls()));
    if (missing.length === 0) return;
    try {
      const fetched = await this.storage.thumbUrls(missing);
      const found = Object.fromEntries(
        [...fetched].filter((entry): entry is [string, string] => entry[1] !== null),
      );
      this.urls.update((urls) => ({ ...urls, ...found }));
      // A draft can outlive its files (e.g. after a local database reset): forget those photos.
      [...fetched].filter(([, url]) => url === null).forEach(([id]) => this.store.removePhoto(id));
    } catch {
      this.error.set("We couldn't load your photos. Please reload the page.");
    }
  }
}
