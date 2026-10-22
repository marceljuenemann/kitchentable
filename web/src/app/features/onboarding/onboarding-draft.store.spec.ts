import { TestBed } from '@angular/core/testing';
import { UserStorage } from '../../core/user-storage';
import {
  OnboardingDraft,
  OnboardingDraftStore,
  ONBOARDING_STEPS,
  toNewProfile,
} from './onboarding-draft.store';

const KEY = 'onboarding-draft';

describe('OnboardingDraftStore', () => {
  let stored: Map<string, unknown>;
  let set: jasmine.Spy;

  /** A store over a fake UserStorage that already holds `initial` (if any). */
  const createStore = (initial?: unknown) => {
    stored = new Map(initial === undefined ? [] : [[KEY, initial]]);
    set = jasmine.createSpy('set').and.callFake((key: string, value: unknown) => {
      stored.set(key, JSON.parse(JSON.stringify(value)));
    });
    TestBed.configureTestingModule({
      providers: [
        OnboardingDraftStore,
        { provide: UserStorage, useValue: { get: (key: string) => stored.get(key) ?? null, set } },
      ],
    });
    return TestBed.inject(OnboardingDraftStore);
  };

  beforeEach(() => jasmine.clock().install());
  afterEach(() => jasmine.clock().uninstall());

  describe('starting state', () => {
    it('is an empty draft on step 1, with London as the location', () => {
      const store = createStore();

      expect(store.draft().step).toBe(1);
      expect(store.draft().name).toBe('');
      expect(store.draft().location).toBe('London');
      expect(store.draft().photos).toEqual([]);
      expect(store.draft().vettingAnswers).toEqual({});
    });

    it('restores a saved draft', () => {
      const store = createStore({ step: 3, name: 'Sam', photos: ['a', 'b'] });

      expect(store.draft().step).toBe(3);
      expect(store.draft().name).toBe('Sam');
      expect(store.draft().photos).toEqual(['a', 'b']);
      // Fields added after the draft was saved get their defaults.
      expect(store.draft().tagline).toBe('');
    });

    it('keeps the step within range', () => {
      expect(createStore({ step: 99 }).draft().step).toBe(ONBOARDING_STEPS);
      TestBed.resetTestingModule();
      expect(createStore({ step: 0 }).draft().step).toBe(1);
      TestBed.resetTestingModule();
      expect(createStore({ step: 'two' }).draft().step).toBe(1);
    });

    it('drops photo ids that are not strings and caps the list at six', () => {
      const store = createStore({ photos: ['a', 1, null, 'b', 'c', 'd', 'e', 'f', 'g'] });

      expect(store.draft().photos).toEqual(['a', 'b', 'c', 'd', 'e', 'f']);
    });

    it('ignores photos or vetting answers of the wrong type', () => {
      const store = createStore({ photos: 'not a list', vettingAnswers: 'nope' });

      expect(store.draft().photos).toEqual([]);
      expect(store.draft().vettingAnswers).toEqual({});
    });
  });

  describe('saving', () => {
    it('merges updates into the draft', () => {
      const store = createStore();
      store.update({ name: 'Sam' });
      store.update({ tagline: 'Hi' });

      expect(store.draft().name).toBe('Sam');
      expect(store.draft().tagline).toBe('Hi');
    });

    it('saves once, shortly after the last change', () => {
      const store = createStore();
      store.update({ name: 'S' });
      store.update({ name: 'Sa' });
      store.update({ name: 'Sam' });
      expect(set).not.toHaveBeenCalled();

      jasmine.clock().tick(300);

      expect(set).toHaveBeenCalledTimes(1);
      expect(stored.get(KEY)).toEqual(jasmine.objectContaining({ name: 'Sam' }));
    });

    it('waits for the pause in typing rather than saving 300 ms after the first change', () => {
      const store = createStore();
      store.update({ name: 'S' });
      jasmine.clock().tick(200);
      store.update({ name: 'Sa' });
      jasmine.clock().tick(200);
      expect(set).not.toHaveBeenCalled();

      jasmine.clock().tick(100);

      expect(set).toHaveBeenCalledTimes(1);
    });

    it('saves right away on flush, and only once', () => {
      const store = createStore();
      store.update({ name: 'Sam' });

      store.flush();
      store.flush();
      jasmine.clock().tick(1000);

      expect(set).toHaveBeenCalledTimes(1);
    });

    it('does not save when nothing changed', () => {
      const store = createStore();

      store.flush();

      expect(set).not.toHaveBeenCalled();
    });

    it('saves a pending change when the store is destroyed, so leaving the page loses nothing', () => {
      const store = createStore();
      store.update({ name: 'Sam' });

      TestBed.resetTestingModule();

      expect(stored.get(KEY)).toEqual(jasmine.objectContaining({ name: 'Sam' }));
      expect(store).toBeTruthy();
    });
  });

  describe('photos', () => {
    it('adds photos at the end', () => {
      const store = createStore();
      store.addPhoto('a');
      store.addPhoto('b');

      expect(store.draft().photos).toEqual(['a', 'b']);
    });

    it('never holds more than six', () => {
      const store = createStore({ photos: ['a', 'b', 'c', 'd', 'e', 'f'] });
      store.addPhoto('g');

      expect(store.draft().photos).toEqual(['a', 'b', 'c', 'd', 'e', 'f']);
    });

    it('removes a photo by id, keeping the order of the rest', () => {
      const store = createStore({ photos: ['a', 'b', 'c'] });
      store.removePhoto('b');

      expect(store.draft().photos).toEqual(['a', 'c']);
    });
  });
});

describe('toNewProfile', () => {
  const draft: OnboardingDraft = {
    step: 4,
    name: '  Sam ',
    pronouns: ['they/them'],
    gender: ['Non-binary'],
    sexuality: ['Queer'],
    location: ' Manchester ',
    birthMonth: '6',
    birthYear: '1990',
    tagline: ' Hello ',
    aboutText: '  About me  ',
    lookingFor: ['polyamory', 'Running buddies'],
    photos: ['a', 'b'],
    vettingAnswers: { consent: 'x', guidelines: 'y' },
  };

  it('maps the draft to the fields of a profile, trimming the free text', () => {
    expect(toNewProfile(draft)).toEqual({
      name: 'Sam',
      pronouns: 'they/them',
      tagline: 'Hello',
      bio: 'About me',
      location: 'Manchester',
      gender: ['Non-binary'],
      sexuality: ['Queer'],
      birth_year: 1990,
      birth_month: 6,
      looking_for: ['polyamory', 'Running buddies'],
      photos: ['a', 'b'],
      vetting_answers: { consent: 'x', guidelines: 'y' },
    });
  });

  it('sends an empty tagline as an empty string, not null', () => {
    expect(toNewProfile({ ...draft, tagline: '   ' }).tagline).toBe('');
  });

  it('sends no birthday unless both month and year are set', () => {
    for (const partial of [
      { birthMonth: '', birthYear: '' },
      { birthMonth: '6', birthYear: '' },
      { birthMonth: '', birthYear: '1990' },
    ]) {
      const profile = toNewProfile({ ...draft, ...partial });
      expect(profile.birth_month).toBeNull();
      expect(profile.birth_year).toBeNull();
    }
  });
});
