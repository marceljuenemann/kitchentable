import { TestBed } from '@angular/core/testing';
import { PhotoStorageService } from '../../../core/photo-storage.service';
import { SupabaseService } from '../../../core/supabase.service';
import { Application, VettingStore } from './vetting.store';

describe('VettingStore', () => {
  let rpc: jasmine.Spy;
  let signedUrls: jasmine.Spy;
  let store: VettingStore;

  const application = (id: string, photos: string[]) =>
    ({ id, name: id, photos, vetting_answers: {} }) as unknown as Application;

  beforeEach(() => {
    rpc = jasmine.createSpy('rpc').and.resolveTo({ data: [], error: null });
    signedUrls = jasmine.createSpy('signedUrls').and.resolveTo([]);
    TestBed.configureTestingModule({
      providers: [
        VettingStore,
        { provide: SupabaseService, useValue: { client: { rpc } } },
        { provide: PhotoStorageService, useValue: { signedUrls } },
      ],
    });
    store = TestBed.inject(VettingStore);
  });

  it('loads the applications, and the main photo thumbnails in one request', async () => {
    rpc.and.resolveTo({
      data: [application('ivy', ['photo-1', 'photo-2']), application('jon', [])],
      error: null,
    });
    signedUrls.and.resolveTo(['https://signed/ivy']);

    await store.load();

    expect(rpc).toHaveBeenCalledOnceWith('admin_list_applications');
    expect(store.applications()?.map(({ id }) => id)).toEqual(['ivy', 'jon']);
    expect(signedUrls).toHaveBeenCalledOnceWith([{ ownerId: 'ivy', photoId: 'photo-1' }], 'thumb');
    expect(store.thumbs().get('ivy')).toBe('https://signed/ivy');
    expect(store.thumbs().has('jon')).toBeFalse();
  });

  it('works out the age members will see', async () => {
    const year = new Date().getFullYear() - 30;
    rpc.and.resolveTo({
      data: [
        { ...application('ivy', []), birth_year: year, birth_month: 13 },
        { ...application('jon', []), birth_year: null, birth_month: null },
      ],
      error: null,
    });

    await store.load();

    expect(store.applications()?.map(({ age }) => age)).toEqual([29, null]);
  });

  it('reports a failed load, and clears it when retrying', async () => {
    rpc.and.resolveTo({ data: null, error: { message: 'Admins only.' } });
    await store.load();
    expect(store.loadFailed()).toBeTrue();

    rpc.and.resolveTo({ data: [], error: null });
    await store.load();
    expect(store.loadFailed()).toBeFalse();
    expect(store.applications()).toEqual([]);
  });

  it('approves through the database', async () => {
    rpc.and.resolveTo({ data: null, error: null });

    await store.approve('ivy');

    expect(rpc).toHaveBeenCalledOnceWith('admin_approve_application', { p_id: 'ivy' });
  });

  it('reports a failed approval', async () => {
    const error = { message: 'There is no application waiting for review with this id.' };
    rpc.and.resolveTo({ data: null, error });

    await expectAsync(store.approve('ivy')).toBeRejectedWith(error);
  });

  it('takes an application off the list', async () => {
    rpc.and.resolveTo({ data: [application('ivy', []), application('jon', [])], error: null });
    await store.load();

    store.remove('ivy');

    expect(store.applications()?.map(({ id }) => id)).toEqual(['jon']);
  });
});
