import { Injector, runInInjectionContext, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { PhotoStorageService } from '../../core/photo-storage.service';
import { injectProfilePhotoUrls } from './profile-photo-urls';

describe('injectProfilePhotoUrls', () => {
  let signedUrls: jasmine.Spy;

  function create(profile: () => { id: string; photos: string[] } | null) {
    signedUrls = jasmine
      .createSpy('signedUrls')
      .and.callFake(async (refs: { photoId: string }[]) =>
        refs.map(({ photoId }) => `full-${photoId}`),
      );
    TestBed.configureTestingModule({
      providers: [{ provide: PhotoStorageService, useValue: { signedUrls } }],
    });
    return runInInjectionContext(TestBed.inject(Injector), () =>
      injectProfilePhotoUrls(profile, () => 'thumb-a'),
    );
  }

  /** Lets the effect run and the signing resolve. */
  async function settle() {
    TestBed.tick();
    await new Promise((resolve) => setTimeout(resolve));
  }

  it('shows the thumbnail, then the full-size versions of all the photos', async () => {
    const urls = create(() => ({ id: 'kai', photos: ['a', 'b', 'c'] }));
    expect(urls()).toEqual(['thumb-a']);

    await settle();
    expect(signedUrls).toHaveBeenCalledOnceWith(
      [
        { ownerId: 'kai', photoId: 'a' },
        { ownerId: 'kai', photoId: 'b' },
        { ownerId: 'kai', photoId: 'c' },
      ],
      'full',
    );
    expect(urls()).toEqual(['full-a', 'full-b', 'full-c']);
  });

  it('signs again when the photos change, showing the thumbnail meanwhile', async () => {
    const profile = signal({ id: 'kai', photos: ['a'] });
    const urls = create(profile);
    await settle();

    profile.set({ id: 'kai', photos: ['a', 'd'] });
    expect(urls()).toEqual(['thumb-a']);
    await settle();
    expect(signedUrls).toHaveBeenCalledTimes(2);
    expect(urls()).toEqual(['full-a', 'full-d']);
  });

  it('keeps the thumbnail if signing fails', async () => {
    const urls = create(() => ({ id: 'kai', photos: ['a', 'b'] }));
    signedUrls.and.rejectWith(new Error('offline'));
    await settle();

    expect(urls()).toEqual(['thumb-a']);
  });

  it('has nothing to show without a profile', async () => {
    const urls = create(() => null);
    await settle();

    expect(urls()).toEqual([]);
    expect(signedUrls).not.toHaveBeenCalled();
  });
});
