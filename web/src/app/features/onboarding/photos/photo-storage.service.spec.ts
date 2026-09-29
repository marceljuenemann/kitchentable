import { TestBed } from '@angular/core/testing';
import { AuthService } from '../../../core/auth/auth.service';
import { SupabaseService } from '../../../core/supabase.service';
import { PhotoStorageService } from './photo-storage.service';

describe('PhotoStorageService', () => {
  let bucket: {
    upload: jasmine.Spy;
    remove: jasmine.Spy;
    createSignedUrls: jasmine.Spy;
  };
  let from: jasmine.Spy;
  let userId: string | null;
  let service: PhotoStorageService;

  const photo = { full: new Blob(['full']), thumb: new Blob(['thumb']) };

  beforeEach(() => {
    userId = 'user-1';
    bucket = {
      upload: jasmine.createSpy('upload').and.resolveTo({ error: null }),
      remove: jasmine.createSpy('remove').and.resolveTo({ error: null }),
      createSignedUrls: jasmine
        .createSpy('createSignedUrls')
        .and.resolveTo({ data: [], error: null }),
    };
    from = jasmine.createSpy('from').and.returnValue(bucket);
    TestBed.configureTestingModule({
      providers: [
        { provide: SupabaseService, useValue: { client: { storage: { from } } } },
        {
          provide: AuthService,
          useValue: { session: () => (userId ? { user: { id: userId } } : null) },
        },
      ],
    });
    service = TestBed.inject(PhotoStorageService);
  });

  describe('upload', () => {
    it('uploads both versions to the private photos bucket, under the user and photo id', async () => {
      await service.upload('photo-1', photo);

      expect(from).toHaveBeenCalledWith('photos');
      expect(bucket.upload).toHaveBeenCalledTimes(2);
      const options = jasmine.objectContaining({ contentType: 'image/jpeg', upsert: false });
      expect(bucket.upload).toHaveBeenCalledWith('user-1/photo-1/full.jpg', photo.full, options);
      expect(bucket.upload).toHaveBeenCalledWith('user-1/photo-1/thumb.jpg', photo.thumb, options);
      expect(bucket.remove).not.toHaveBeenCalled();
    });

    it('leaves neither file behind if one upload fails', async () => {
      const error = new Error('storage down');
      bucket.upload.and.callFake(async (path: string) => ({
        error: path.endsWith('thumb.jpg') ? error : null,
      }));

      await expectAsync(service.upload('photo-1', photo)).toBeRejectedWith(error);

      expect(bucket.remove).toHaveBeenCalledOnceWith([
        'user-1/photo-1/full.jpg',
        'user-1/photo-1/thumb.jpg',
      ]);
    });

    it('refuses when nobody is signed in', async () => {
      userId = null;

      await expectAsync(service.upload('photo-1', photo)).toBeRejectedWithError('Not signed in');
      expect(bucket.upload).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('deletes both files', async () => {
      await service.remove('photo-1');

      expect(bucket.remove).toHaveBeenCalledOnceWith([
        'user-1/photo-1/full.jpg',
        'user-1/photo-1/thumb.jpg',
      ]);
    });

    it('reports a failure', async () => {
      const error = new Error('nope');
      bucket.remove.and.resolveTo({ error });

      await expectAsync(service.remove('photo-1')).toBeRejectedWith(error);
    });
  });

  describe('thumbUrls', () => {
    it('signs the thumbnail paths and maps the URLs back to their photo ids', async () => {
      bucket.createSignedUrls.and.resolveTo({
        data: [
          { error: null, signedUrl: 'https://signed/1' },
          { error: null, signedUrl: 'https://signed/2' },
        ],
        error: null,
      });

      const urls = await service.thumbUrls(['photo-1', 'photo-2']);

      expect(bucket.createSignedUrls).toHaveBeenCalledOnceWith(
        ['user-1/photo-1/thumb.jpg', 'user-1/photo-2/thumb.jpg'],
        3600,
      );
      expect(urls).toEqual(
        new Map([
          ['photo-1', 'https://signed/1'],
          ['photo-2', 'https://signed/2'],
        ]),
      );
    });

    it('maps a photo whose file is gone to null', async () => {
      bucket.createSignedUrls.and.resolveTo({
        data: [
          { error: 'Object not found', signedUrl: null },
          { error: null, signedUrl: 'https://signed/2' },
        ],
        error: null,
      });

      const urls = await service.thumbUrls(['photo-1', 'photo-2']);

      expect(urls.get('photo-1')).toBeNull();
      expect(urls.get('photo-2')).toBe('https://signed/2');
    });

    it('does not call the server for no photos', async () => {
      expect(await service.thumbUrls([])).toEqual(new Map());
      expect(bucket.createSignedUrls).not.toHaveBeenCalled();
    });

    it('throws if signing fails', async () => {
      const error = new Error('nope');
      bucket.createSignedUrls.and.resolveTo({ data: null, error });

      await expectAsync(service.thumbUrls(['photo-1'])).toBeRejectedWith(error);
    });
  });
});
