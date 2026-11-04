import { Signal, computed, effect, inject, signal, untracked } from '@angular/core';
import { PhotoStorageService } from '../../core/photo-storage.service';

/** What signing needs to know about a profile. */
interface ProfilePhotos {
  id: string;
  photos: string[];
}

/**
 * The URLs for `ProfileViewComponent`'s `photoUrls`: the main photo's cached thumbnail until the
 * full-size versions of all the photos are signed, so the morph from a tile lands on a photo
 * straight away (the browser swaps in the full one once it has loaded). Signs again whenever the
 * profile or its photos change. Call it in an injection context, such as a field initializer.
 */
export function injectProfilePhotoUrls(
  profile: () => ProfilePhotos | null | undefined,
  thumbnail: () => string | null,
): Signal<(string | null)[]> {
  const storage = inject(PhotoStorageService);
  /** Which profile and photos `full` is for, so a new profile doesn't show the last one's. */
  const key = computed(() => {
    const current = profile();
    return current ? `${current.id}:${current.photos.join(',')}` : null;
  });
  const full = signal<{ key: string; urls: (string | null)[] } | null>(null);

  effect(() => {
    const signing = key();
    const current = untracked(profile);
    if (!signing || !current) return;
    storage
      .signedUrls(
        current.photos.map((photoId) => ({ ownerId: current.id, photoId })),
        'full',
      )
      .then(
        (urls) => full.set({ key: signing, urls }),
        // The thumbnail stays; the other photos show as placeholders.
        () => undefined,
      );
  });

  return computed(() => {
    const showing = key();
    if (!showing) return [];
    const signed = full();
    return signed?.key === showing ? signed.urls : [thumbnail()];
  });
}
