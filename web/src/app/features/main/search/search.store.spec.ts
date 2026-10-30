import { fakeAsync, TestBed, tick } from '@angular/core/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { BehaviorSubject, Subject } from 'rxjs';
import { PhotoStorageService } from '../../../core/photo-storage.service';
import { Member, MyProfile } from '../../../core/profile.model';
import { ProfileService, ProfileState } from '../../../core/profile.service';
import { SupabaseService } from '../../../core/supabase.service';
import {
  matches,
  NO_FILTERS,
  NOT_SPECIFIED,
  SearchFilters,
  SELF_DESCRIBED,
  SearchStore,
} from './search.store';

describe('matches', () => {
  const member: Member = {
    id: 'ivy',
    name: 'Ivy',
    pronouns: 'she/her',
    tagline: '',
    bio: '',
    location: 'London',
    gender: ['Woman', 'Genderfluid'],
    sexuality: [],
    age: 29,
    looking_for: ['polyamory', 'Something of my own'],
    photos: [],
  };
  const filtered = (filters: Partial<SearchFilters>, overrides: Partial<Member> = {}) =>
    matches({ ...member, ...overrides }, { ...NO_FILTERS, ...filters });

  it('matches everyone without filters, even without a birthday', () => {
    expect(filtered({}, { age: null, gender: [] })).toBeTrue();
  });

  it('matches when any of their values is picked within a field', () => {
    expect(filtered({ gender: ['Genderfluid', 'Man'] })).toBeTrue();
    expect(filtered({ gender: ['Man'] })).toBeFalse();
  });

  it('needs a match in every filtered field', () => {
    expect(filtered({ gender: ['Woman'], lookingFor: ['polyamory'] })).toBeTrue();
    expect(filtered({ gender: ['Woman'], lookingFor: ['friends'] })).toBeFalse();
  });

  it("leaves out people with a field blank when it's filtered, unless Not specified is picked", () => {
    expect(filtered({ gender: ['Woman'] }, { gender: [] })).toBeFalse();
    expect(filtered({ gender: ['Woman', NOT_SPECIFIED] }, { gender: [] })).toBeTrue();
    expect(filtered({ gender: [NOT_SPECIFIED] })).toBeFalse();
  });

  it('matches what people wrote themselves to Self-described', () => {
    expect(filtered({ lookingFor: [SELF_DESCRIBED] })).toBeTrue();
    expect(filtered({ lookingFor: [SELF_DESCRIBED] }, { looking_for: ['friends'] })).toBeFalse();
    expect(filtered({ lookingFor: ['friends'] })).toBeFalse();

    expect(filtered({ gender: [SELF_DESCRIBED] }, { gender: ['Neutrois'] })).toBeTrue();
    expect(filtered({ gender: [SELF_DESCRIBED] })).toBeFalse();
    expect(filtered({ gender: ['Woman'] }, { gender: ['Neutrois'] })).toBeFalse();
  });

  it('keeps the age within the range', () => {
    expect(filtered({ minAge: 29, maxAge: 29 })).toBeTrue();
    expect(filtered({ minAge: 30 })).toBeFalse();
    expect(filtered({ maxAge: 28 })).toBeFalse();
  });

  it('treats the top of the age range as "and older"', () => {
    expect(filtered({ minAge: 25 }, { age: 86 })).toBeTrue();
  });

  it('keeps people without a birthday in any age range, unless asked not to', () => {
    const noBirthday = { age: null };

    expect(filtered({ minAge: 19 }, noBirthday)).toBeTrue();
    expect(filtered({ minAge: 19, showUnspecifiedAge: false }, noBirthday)).toBeFalse();
    expect(filtered({ showUnspecifiedAge: false }, noBirthday)).toBeFalse();
    expect(filtered({ showUnspecifiedAge: false })).toBeTrue();
  });
});

describe('SearchStore', () => {
  let store: SearchStore;
  let undo: Subject<void>;
  let open: jasmine.Spy;
  let rpc: jasmine.Spy;
  let signedUrls: jasmine.Spy;
  let profileState: BehaviorSubject<ProfileState>;

  const profile = (saved: Partial<MyProfile> = {}) =>
    ({ search_filters: null, hide_by_gender: false, ...saved }) as MyProfile;

  beforeEach(() => {
    undo = new Subject();
    open = jasmine.createSpy('open').and.returnValue({ onAction: () => undo });
    rpc = jasmine.createSpy('rpc').and.resolveTo({ error: null });
    signedUrls = jasmine.createSpy('signedUrls').and.resolveTo([]);
    profileState = new BehaviorSubject<ProfileState>({ kind: 'loaded', profile: profile() });
    TestBed.configureTestingModule({
      providers: [
        SearchStore,
        { provide: MatSnackBar, useValue: { open } },
        { provide: SupabaseService, useValue: { client: { rpc } } },
        { provide: PhotoStorageService, useValue: { signedUrls } },
        { provide: ProfileService, useValue: { state$: profileState } },
      ],
    });
  });

  const create = () => (store = TestBed.inject(SearchStore));
  /** Lets the pending saves run. */
  const settle = () => tick(300);
  const saved = () => rpc.calls.allArgs().map(([, args]) => args);

  describe('saved filters', () => {
    it('starts from the filters and switch saved on the profile', () => {
      profileState.next({
        kind: 'loaded',
        profile: profile({
          search_filters: {
            looking_for: ['friends'],
            gender: ['Woman'],
            min_age: 25,
            max_age: 40,
            show_unspecified_age: false,
          },
          hide_by_gender: true,
        }),
      });
      create();

      expect(store.filters()).toEqual({
        lookingFor: ['friends'],
        gender: ['Woman'],
        minAge: 25,
        maxAge: 40,
        showUnspecifiedAge: false,
      });
      expect(store.hideByGender()).toBeTrue();
    });

    it('starts without filters when none are saved, and saves nothing for loading', fakeAsync(() => {
      create();
      settle();

      expect(store.filters()).toEqual(NO_FILTERS);
      expect(store.hideByGender()).toBeFalse();
      expect(rpc).not.toHaveBeenCalled();
    }));

    it('saves the filters and the switch after every change', fakeAsync(() => {
      create();
      store.updateFilters({ gender: ['Woman', NOT_SPECIFIED] });
      settle();
      store.setOnlyShowMeToGenders(true);
      settle();

      expect(rpc).toHaveBeenCalledWith('set_search_filters', jasmine.any(Object));
      expect(saved()).toEqual([
        {
          p_filters: {
            looking_for: [],
            gender: ['Woman', NOT_SPECIFIED],
            min_age: 18,
            max_age: 70,
            show_unspecified_age: true,
          },
          p_hide_by_gender: false,
        },
        jasmine.objectContaining({ p_hide_by_gender: true }),
      ]);
    }));

    it('saves once, shortly after the last change', fakeAsync(() => {
      create();
      store.updateFilters({ minAge: 20 });
      tick(200);
      store.updateFilters({ minAge: 21 });
      tick(200);
      expect(rpc).not.toHaveBeenCalled();

      tick(100);

      expect(saved().map((args) => args.p_filters.min_age)).toEqual([21]);
    }));

    /** Holds the next save open until the returned function finishes it. */
    const holdSave = () => {
      let finish!: (result: { error: unknown }) => void;
      rpc.and.returnValue(new Promise((resolve) => (finish = resolve)));
      return (result: { error: unknown }) => {
        rpc.and.resolveTo({ error: null });
        finish(result);
      };
    };

    it('sends one save at a time, then only the latest of the changes made meanwhile', fakeAsync(() => {
      const finish = holdSave();
      create();
      store.updateFilters({ minAge: 20 });
      settle();
      store.updateFilters({ minAge: 21 });
      settle();
      store.updateFilters({ minAge: 22 });
      settle();

      expect(rpc).toHaveBeenCalledTimes(1);

      finish({ error: null });
      settle();

      expect(saved().map((args) => args.p_filters.min_age)).toEqual([20, 22]);
    }));

    it('still sends a change made during a save that fails', fakeAsync(() => {
      const finish = holdSave();
      create();
      store.updateFilters({ minAge: 20 });
      settle();
      store.updateFilters({ minAge: 21 });
      settle();

      finish({ error: { message: 'offline' } });
      settle();

      expect(saved().map((args) => args.p_filters.min_age)).toEqual([20, 21]);
    }));

    it('saves nothing for changes that end up as they were', fakeAsync(() => {
      create();
      store.setOnlyShowMeToGenders(true); // no gender picked, so still off
      store.updateFilters({ minAge: 30 });
      store.updateFilters({ minAge: NO_FILTERS.minAge });
      settle();

      expect(store.hideByGender()).toBeFalse();
      expect(rpc).not.toHaveBeenCalled();
    }));

    it('offers to retry after a failure, and sends the current filters again', fakeAsync(() => {
      rpc.and.resolveTo({ error: { message: 'offline' } });
      create();
      store.updateFilters({ minAge: 30 });
      settle();

      expect(open).toHaveBeenCalledWith("Couldn't save your filters", 'Retry', jasmine.any(Object));

      rpc.and.resolveTo({ error: null });
      undo.next();
      settle();

      expect(saved().map((args) => args.p_filters.min_age)).toEqual([30, 30]);
    }));
  });

  describe('members', () => {
    const member = (id: string, photos: string[] = []) =>
      ({ id, name: id, gender: [], looking_for: [], age: null, photos }) as unknown as Member;
    const ivy = member('ivy', ['photo-1', 'photo-2']);
    const jon = member('jon');

    /** Answers `search_profiles` with these members, and anything else with no error. */
    const respondWith = (members: Member[]) =>
      rpc.and.callFake(async (name: string) =>
        name === 'search_profiles' ? { data: members, error: null } : { error: null },
      );
    const searches = () => rpc.calls.allArgs().filter(([name]) => name === 'search_profiles');
    const dismissals = () =>
      rpc.calls
        .allArgs()
        .filter(([name]) => name === 'set_dismissed')
        .map(([, args]) => args);

    it('is null until loaded', () => {
      create();

      expect(store.members()).toBeNull();
      expect(store.results()).toEqual([]);
    });

    it('loads the members in the order given, with the main thumbnails in one request', async () => {
      respondWith([jon, ivy]);
      signedUrls.and.resolveTo(['https://signed/ivy']);
      create();

      await store.load();

      expect(store.results()).toEqual([jon, ivy]);
      expect(signedUrls).toHaveBeenCalledOnceWith(
        [{ ownerId: 'ivy', photoId: 'photo-1' }],
        'thumb',
      );
      expect(store.thumbs().get('ivy')).toBe('https://signed/ivy');
      expect(store.thumbs().has('jon')).toBeFalse();
    });

    it('reports a failed load, and clears it when retrying', async () => {
      rpc.and.resolveTo({ data: null, error: { message: 'offline' } });
      create();
      await store.load();
      expect(store.loadFailed()).toBeTrue();
      expect(store.members()).toBeNull();

      respondWith([ivy]);
      await store.load();
      expect(store.loadFailed()).toBeFalse();
      expect(store.members()).toEqual([ivy]);
    });

    it('keeps the members it has when a reload fails', async () => {
      respondWith([ivy]);
      create();
      await store.load();

      rpc.and.resolveTo({ data: null, error: { message: 'offline' } });
      await store.load();

      expect(store.members()).toEqual([ivy]);
    });

    it('loads again only once the thumbnails are getting old', fakeAsync(() => {
      respondWith([ivy]);
      create();
      store.loadIfStale();
      tick();
      store.loadIfStale();
      tick();
      expect(searches().length).toBe(1);

      tick(31 * 60 * 1000);
      store.loadIfStale();
      tick();

      expect(searches().length).toBe(2);
    }));

    it('tries again on the next visit after a failed load', fakeAsync(() => {
      rpc.and.resolveTo({ data: null, error: { message: 'offline' } });
      create();
      store.loadIfStale();
      tick();

      store.loadIfStale();
      tick();

      expect(searches().length).toBe(2);
    }));

    it('hides someone straight away, saves it, and saves undoing it', async () => {
      respondWith([ivy, jon]);
      create();
      await store.load();

      store.hide(ivy);
      expect(store.results()).toEqual([jon]);

      undo.next();
      expect(store.results()).toEqual([ivy, jon]);

      await new Promise((resolve) => setTimeout(resolve));
      expect(dismissals()).toEqual([
        { p_user_id: 'ivy', p_dismissed: true },
        { p_user_id: 'ivy', p_dismissed: false },
      ]);
    });

    it('sends an undo only once the hiding it undoes is saved', fakeAsync(() => {
      let finish!: (result: { error: null }) => void;
      respondWith([ivy]);
      create();
      store.load();
      tick();
      rpc.and.returnValue(new Promise((resolve) => (finish = resolve)));

      store.hide(ivy);
      undo.next();
      tick();
      expect(dismissals().length).toBe(1);

      rpc.and.resolveTo({ error: null });
      finish({ error: null });
      tick();
      expect(dismissals().map((args) => args.p_dismissed)).toEqual([true, false]);
    }));

    it('brings someone back if hiding them could not be saved', async () => {
      respondWith([ivy]);
      create();
      await store.load();
      rpc.and.resolveTo({ error: { message: 'offline' } });

      store.hide(ivy);
      await new Promise((resolve) => setTimeout(resolve));

      expect(store.results()).toEqual([ivy]);
      expect(open.calls.mostRecent().args[0]).toBe("Couldn't hide ivy");
    });
  });
});
