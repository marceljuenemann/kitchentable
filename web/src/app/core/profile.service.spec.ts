import { TestBed } from '@angular/core/testing';
import { BehaviorSubject, filter, firstValueFrom } from 'rxjs';
import { AuthService } from './auth/auth.service';
import { NewProfile, Profile } from './profile.model';
import { ProfileService, ProfileState } from './profile.service';
import { SupabaseService } from './supabase.service';

const PROFILE: Profile = {
  id: 'user-1',
  status: 'vetting',
  name: 'Sam',
  pronouns: 'they/them',
  tagline: '',
  bio: 'About Sam',
  location: 'London',
  gender: [],
  sexuality: [],
  birth_year: null,
  birth_month: null,
  looking_for: ['solo-poly'],
  photos: ['photo-1'],
  vetting_answers: { consent: 'a' },
};

const NEW_PROFILE: NewProfile = {
  name: 'Sam',
  pronouns: 'they/them',
  tagline: '',
  bio: 'About Sam',
  location: 'London',
  gender: ['Non-binary'],
  sexuality: [],
  birth_year: 1990,
  birth_month: 6,
  looking_for: ['solo-poly'],
  photos: ['photo-1', 'photo-2'],
  vetting_answers: { consent: 'a', guidelines: 'b' },
};

describe('ProfileService', () => {
  let userId$: BehaviorSubject<string | null>;
  let rpc: jasmine.Spy;
  let service: ProfileService;

  /** The next state once the profile has been fetched (skips the loading state). */
  const settled = () =>
    firstValueFrom(service.state$.pipe(filter((state) => state.kind !== 'loading')));

  beforeEach(() => {
    userId$ = new BehaviorSubject<string | null>('user-1');
    rpc = jasmine.createSpy('rpc').and.resolveTo({ data: PROFILE, error: null });
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: { userId$ } },
        { provide: SupabaseService, useValue: { client: { rpc } } },
      ],
    });
    service = TestBed.inject(ProfileService);
  });

  describe('state$', () => {
    it('is signed-out without a user, and does not ask the database', async () => {
      userId$.next(null);

      expect(await settled()).toEqual({ kind: 'signed-out' });
      expect(rpc).not.toHaveBeenCalled();
    });

    it('loads the profile of the signed-in user', async () => {
      expect(await settled()).toEqual({ kind: 'loaded', profile: PROFILE });
      expect(rpc).toHaveBeenCalledOnceWith('get_my_profile');
    });

    it('is none when the user has no profile row yet', async () => {
      rpc.and.resolveTo({ data: null, error: null });

      expect(await settled()).toEqual({ kind: 'none' });
    });

    it('is error when the fetch fails', async () => {
      rpc.and.resolveTo({ data: null, error: new Error('network') });

      expect(await settled()).toEqual({ kind: 'error' });
    });

    it('shows loading first, and again on every refresh', async () => {
      const states: ProfileState['kind'][] = [];
      const subscription = service.state$.subscribe((state) => states.push(state.kind));
      await settled();

      rpc.and.resolveTo({ data: null, error: null });
      service.refresh();
      await settled();
      await new Promise((resolve) => setTimeout(resolve));
      subscription.unsubscribe();

      expect(states).toEqual(['loading', 'loaded', 'loading', 'none']);
      expect(rpc).toHaveBeenCalledTimes(2);
    });

    it('fetches again when the user changes', async () => {
      const states: ProfileState['kind'][] = [];
      const subscription = service.state$.subscribe((state) => states.push(state.kind));
      await settled();

      userId$.next('user-2');
      await new Promise((resolve) => setTimeout(resolve));
      subscription.unsubscribe();

      expect(rpc).toHaveBeenCalledTimes(2);
      expect(states).toEqual(['loading', 'loaded', 'loading', 'loaded']);
    });
  });

  describe('submitOnboarding', () => {
    it('passes every field as the p_-prefixed argument of submit_onboarding', async () => {
      rpc.and.resolveTo({ data: null, error: null });

      await service.submitOnboarding(NEW_PROFILE);

      expect(rpc).toHaveBeenCalledWith('submit_onboarding', {
        p_name: 'Sam',
        p_pronouns: 'they/them',
        p_tagline: '',
        p_bio: 'About Sam',
        p_location: 'London',
        p_gender: ['Non-binary'],
        p_sexuality: [],
        p_birth_year: 1990,
        p_birth_month: 6,
        p_looking_for: ['solo-poly'],
        p_photos: ['photo-1', 'photo-2'],
        p_vetting_answers: { consent: 'a', guidelines: 'b' },
      });
    });

    it('reloads the profile afterwards, so the shell moves on', async () => {
      const kinds: ProfileState['kind'][] = [];
      rpc.and.resolveTo({ data: null, error: null });
      const subscription = service.state$.subscribe((state) => kinds.push(state.kind));
      await settled();
      expect(kinds).toEqual(['loading', 'none']);

      rpc.and.callFake(async (name: string) =>
        name === 'submit_onboarding' ? { data: null, error: null } : { data: PROFILE, error: null },
      );
      await service.submitOnboarding(NEW_PROFILE);
      await new Promise((resolve) => setTimeout(resolve));
      subscription.unsubscribe();

      expect(kinds).toEqual(['loading', 'none', 'loading', 'loaded']);
    });

    it('treats "already applied" as done and reloads too', async () => {
      rpc.and.callFake(async (name: string) =>
        name === 'submit_onboarding'
          ? { data: null, error: { code: '23505', message: 'You have already applied.' } }
          : { data: PROFILE, error: null },
      );
      const states: ProfileState['kind'][] = [];
      const subscription = service.state$.subscribe((state) => states.push(state.kind));
      await settled();

      await expectAsync(service.submitOnboarding(NEW_PROFILE)).toBeResolved();
      await new Promise((resolve) => setTimeout(resolve));
      subscription.unsubscribe();

      expect(states).toEqual(['loading', 'loaded', 'loading', 'loaded']);
    });

    it('throws any other error, and does not reload', async () => {
      const error = { code: 'P0001', message: 'You must be at least 18.' };
      rpc.and.resolveTo({ data: null, error });
      const states: ProfileState['kind'][] = [];
      const subscription = service.state$.subscribe((state) => states.push(state.kind));
      await new Promise((resolve) => setTimeout(resolve));
      const calls = rpc.calls.count();

      await expectAsync(service.submitOnboarding(NEW_PROFILE)).toBeRejectedWith(error);
      await new Promise((resolve) => setTimeout(resolve));
      subscription.unsubscribe();

      // One more call (the failed submit) and no refetch.
      expect(rpc.calls.count()).toBe(calls + 1);
      expect(states.filter((kind) => kind === 'loading').length).toBe(1);
    });
  });
});
