import { TestBed } from '@angular/core/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Subject } from 'rxjs';
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

  beforeEach(() => {
    undo = new Subject();
    TestBed.configureTestingModule({
      providers: [
        SearchStore,
        { provide: MatSnackBar, useValue: { open: () => ({ onAction: () => undo }) } },
      ],
    });
    store = TestBed.inject(SearchStore);
  });

  it('hides someone until the hiding is undone', () => {
    const someone = store.results()[0];
    const count = store.results().length;

    store.hide(someone);
    expect(store.results()).not.toContain(someone);
    expect(store.results().length).toBe(count - 1);

    undo.next();
    expect(store.results()).toContain(someone);
  });

  it('shows the newest members first', () => {
    const joined = store.results().map((member) => member.age_verified_at);

    expect(joined).toEqual([...joined].sort().reverse());
  });
});
