import { Component, computed, inject, signal } from '@angular/core';
import { MatBottomSheet } from '@angular/material/bottom-sheet';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { firstValueFrom } from 'rxjs';
import { OnboardingDraftStore, ONBOARDING_STEPS } from '../onboarding-draft.store';
import { MAX_PHOTOS } from '../onboarding-options';
import { checkPhotoFile, PhotoError, ProcessedPhoto } from '../photos/photo-processor';

/** Onboarding step 3: add and crop up to six photos. */
@Component({
  selector: 'app-photos-step',
  standalone: true,
  imports: [MatButtonModule, MatIconModule],
  templateUrl: './photos-step.component.html',
  styleUrl: './photos-step.component.scss',
})
export class PhotosStepComponent {
  private readonly store = inject(OnboardingDraftStore);
  private readonly bottomSheet = inject(MatBottomSheet);

  readonly photos = this.store.photos;
  readonly totalSteps = ONBOARDING_STEPS;
  readonly maxPhotos = MAX_PHOTOS;

  /** One entry per grid tile: the photo, or null for an empty tile. */
  readonly slots = computed(() =>
    Array.from({ length: MAX_PHOTOS }, (_, index) => this.photos()[index] ?? null),
  );

  readonly busy = signal(false);
  readonly error = signal<string | null>(null);

  readonly canContinue = computed(() => this.photos().length > 0);

  /** Crops and adds each chosen photo, one after the other (up to the six-photo limit). */
  async onFilesChosen(event: Event) {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    input.value = ''; // so choosing the same file again still triggers a change
    this.error.set(null);
    this.busy.set(true);
    try {
      for (const file of files) {
        if (this.photos().length >= MAX_PHOTOS) break;
        await this.addFile(file);
      }
    } finally {
      this.busy.set(false);
    }
  }

  remove(id: string) {
    this.store.removePhoto(id);
    this.error.set(null);
  }

  next() {
    if (this.canContinue()) this.store.update({ step: 4 });
  }

  private async addFile(file: File) {
    try {
      await checkPhotoFile(file);
      const photo = await this.crop(file);
      if (photo) this.store.addPhoto(photo);
    } catch (error) {
      this.error.set(
        error instanceof PhotoError ? error.message : 'Something went wrong with that photo.',
      );
    }
  }

  private async crop(file: File): Promise<ProcessedPhoto | undefined> {
    // Loaded on demand: the crop sheet (with panzoom) is only needed here.
    const { CropSheetComponent } = await import('../photos/crop-sheet.component');
    const ref = this.bottomSheet.open(CropSheetComponent, {
      data: { file },
      panelClass: 'kt-bottom-sheet',
      autoFocus: 'dialog',
    });
    return firstValueFrom(ref.afterDismissed());
  }
}
