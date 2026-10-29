import { TestBed } from '@angular/core/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { BehaviorSubject, Subject } from 'rxjs';
import { MyProfile } from '../../../core/profile.model';
import { ProfileService, ProfileState } from '../../../core/profile.service';
import { SupabaseService } from '../../../core/supabase.service';
import {
  matches,
  Member,
  NO_FILTERS,
  NOT_SPECIFIED,
  SearchFilters,
  SELF_DESCRIBED,
  SearchStore,
} from './search.store';

describe('matches', () => {
  const now = new Date(2026, 9, 15); // October 2026
  const member: Member = {
    id: 'ivy',
    status: 'active',
    name: 'Ivy',
    pronouns: 'she/her',
    tagline: '',
    bio: '',
    location: 'London',
    gender: ['Woman', 'Genderfluid'],
    sexuality: [],
    birth_year: 1996,
    birth_month: 11, // 29 in October 2026, 30 in November
    looking_for: ['polyamory', 'Something of my own'],
    photos: [],
    age_verified_at: '2026-10-01T00:00:00Z',
  };
  const filtered = (filters: Partial<SearchFilters>, overrides: Partial<Member> = {}) =>
    matches({ ...member, ...overrides }, { ...NO_FILTERS, ...filters }, now);

  it('matches everyone without filters, even without a birthday', () => {
    expect(filtered({}, { birth_year: null, birth_month: null, gender: [] })).toBeTrue();
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

  it('works out the age from the birth month', () => {
    expect(filtered({ minAge: 29, maxAge: 29 })).toBeTrue();
    expect(filtered({ minAge: 30 })).toBeFalse();
    expect(filtered({ maxAge: 28 })).toBeFalse();
  });

  it('treats the top of the age range as "and older"', () => {
    expect(filtered({ minAge: 25 }, { birth_year: 1940, birth_month: 1 })).toBeTrue();
  });

  it('keeps people without a birthday in any age range, unless asked not to', () => {
    const noBirthday = { birth_year: null, birth_month: null };

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
  let profileState: BehaviorSubject<ProfileState>;

  const profile = (saved: Partial<MyProfile> = {}) =>
    ({ search_filters: null, hide_by_gender: false, ...saved }) as MyProfile;

  beforeEach(() => {
    undo = new Subject();
    open = jasmine.createSpy('open').and.returnValue({ onAction: () => undo });
    rpc = jasmine.createSpy('rpc').and.resolveTo({ error: null });
    profileState = new BehaviorSubject<ProfileState>({ kind: 'loaded', profile: profile() });
    TestBed.configureTestingModule({
      providers: [
        SearchStore,
        { provide: MatSnackBar, useValue: { open } },
        { provide: SupabaseService, useValue: { client: { rpc } } },
        { provide: ProfileService, useValue: { state$: profileState } },
      ],
    });
  });

  const create = () => (store = TestBed.inject(SearchStore));
  /** Lets the pending saves run. */
  const settle = () => new Promise((resolve) => setTimeout(resolve));
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

    it('starts without filters when none are saved, and saves nothing for loading', async () => {
      create();
      await settle();

      expect(store.filters()).toEqual(NO_FILTERS);
      expect(store.hideByGender()).toBeFalse();
      expect(rpc).not.toHaveBeenCalled();
    });

    it('saves the filters and the switch on every change', async () => {
      create();
      store.updateFilters({ gender: ['Woman', NOT_SPECIFIED] });
      await settle();
      store.setOnlyShowMeToGenders(true);
      await settle();

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
    });

    it('sends one save at a time, then only the latest of the changes made meanwhile', async () => {
      let finish!: () => void;
      rpc.and.returnValue(new Promise((resolve) => (finish = () => resolve({ error: null }))));
      create();
      store.updateFilters({ minAge: 20 });
      store.updateFilters({ minAge: 21 });
      store.updateFilters({ minAge: 22 });

      expect(rpc).toHaveBeenCalledTimes(1);

      rpc.and.resolveTo({ error: null });
      finish();
      await settle();

      expect(saved().map((args) => args.p_filters.min_age)).toEqual([20, 22]);
    });

    it('saves nothing for changes that end up as they were', async () => {
      create();
      store.setOnlyShowMeToGenders(true); // no gender picked, so still off
      store.updateFilters({ minAge: 30 });
      store.updateFilters({ minAge: 31 }); // while the first save is out…
      store.updateFilters({ minAge: 30 }); // …and back, so nothing more to send
      await settle();

      expect(store.hideByGender()).toBeFalse();
      expect(saved().map((args) => args.p_filters.min_age)).toEqual([30]);
    });

    it('offers to retry after a failure, and sends the current filters again', async () => {
      rpc.and.resolveTo({ error: { message: 'offline' } });
      create();
      store.updateFilters({ minAge: 30 });
      await settle();

      expect(open).toHaveBeenCalledWith("Couldn't save your filters", 'Retry', jasmine.any(Object));

      rpc.and.resolveTo({ error: null });
      undo.next();
      await settle();

      expect(saved().map((args) => args.p_filters.min_age)).toEqual([30, 30]);
    });
  });

  it('hides someone until the hiding is undone', () => {
    create();
    const someone = store.results()[0];
    const count = store.results().length;

    store.hide(someone);
    expect(store.results()).not.toContain(someone);
    expect(store.results().length).toBe(count - 1);

    undo.next();
    expect(store.results()).toContain(someone);
  });

  it('shows the newest members first', () => {
    create();
    const joined = store.results().map((member) => member.age_verified_at);

    expect(joined).toEqual([...joined].sort().reverse());
  });
});
