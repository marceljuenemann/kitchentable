import { TestBed } from '@angular/core/testing';
import { BehaviorSubject } from 'rxjs';
import { AuthService } from './auth/auth.service';
import { UserStorage } from './user-storage';

describe('UserStorage', () => {
  let userId$: BehaviorSubject<string | null>;
  let storage: UserStorage;

  const keys = () => Object.keys(localStorage).filter((key) => key.startsWith('kt.user.'));

  beforeEach(() => {
    localStorage.clear();
    userId$ = new BehaviorSubject<string | null>('alice');
    TestBed.configureTestingModule({
      providers: [{ provide: AuthService, useValue: { userId$ } }],
    });
    storage = TestBed.inject(UserStorage);
  });

  afterEach(() => localStorage.clear());

  it('stores values as JSON under a key scoped to the signed-in user', () => {
    storage.set('draft', { step: 2 });

    expect(keys()).toEqual(['kt.user.alice.draft']);
    expect(storage.get('draft')).toEqual({ step: 2 });
  });

  it('keeps each user’s values apart', () => {
    storage.set('draft', 'alice’s');
    userId$.next('bob');

    expect(storage.get('draft')).toBeNull();
    storage.set('draft', 'bob’s');
    userId$.next('alice');
    expect(storage.get('draft')).toBe('alice’s');
  });

  it('reads nothing and writes nothing while signed out', () => {
    storage.set('draft', 'kept');
    userId$.next(null);

    expect(storage.get('draft')).toBeNull();
    storage.set('draft', 'ignored');
    expect(keys()).toEqual(['kt.user.alice.draft']);
    expect(localStorage.getItem('kt.user.alice.draft')).toBe('"kept"');
  });

  it('keeps the values when the user only signs out through an expired session', () => {
    // Session expiry looks like a null user id but is not an explicit sign-out: it must not clear.
    storage.set('draft', 'kept');
    userId$.next(null);
    userId$.next('alice');

    expect(storage.get('draft')).toBe('kept');
  });

  it('returns null for a value that is not valid JSON', () => {
    localStorage.setItem('kt.user.alice.draft', '{not json');

    expect(storage.get('draft')).toBeNull();
  });

  it('removes one value', () => {
    storage.set('a', 1);
    storage.set('b', 2);
    storage.remove('a');

    expect(storage.get('a')).toBeNull();
    expect(storage.get('b')).toBe(2);
  });

  describe('onSignOut', () => {
    it('removes everything stored for the user, but not other users’ values or other keys', () => {
      storage.set('draft', 1);
      storage.set('other', 2);
      localStorage.setItem('kt.user.bob.draft', '3');
      localStorage.setItem('unrelated', '4');

      storage.onSignOut();

      expect(keys()).toEqual(['kt.user.bob.draft']);
      expect(localStorage.getItem('unrelated')).toBe('4');
    });

    it('stops writing right away, so a late debounced save cannot bring the draft back', () => {
      storage.set('draft', 1);
      storage.onSignOut();

      storage.set('draft', 'too late');

      expect(keys()).toEqual([]);
    });

    it('writes again once a user id arrives from a new sign-in', () => {
      storage.onSignOut();
      userId$.next('bob');
      storage.set('draft', 1);

      expect(keys()).toEqual(['kt.user.bob.draft']);
    });
  });
});
