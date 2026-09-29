import { TestBed } from '@angular/core/testing';
import { BehaviorSubject } from 'rxjs';
import { Profile, ProfileStatus } from '../../core/profile.model';
import { ProfileService, ProfileState } from '../../core/profile.service';
import { ShellComponent } from './shell.component';

describe('ShellComponent', () => {
  let state$: BehaviorSubject<ProfileState>;
  let refresh: jasmine.Spy;

  const profile = (status: ProfileStatus) => ({ kind: 'loaded', profile: { status } as Profile });

  /** Creates the shell without rendering it: only the choice of screen is under test here. */
  const createShell = () => TestBed.createComponent(ShellComponent).componentInstance;

  beforeEach(() => {
    state$ = new BehaviorSubject<ProfileState>({ kind: 'loading' });
    refresh = jasmine.createSpy('refresh');
    TestBed.configureTestingModule({
      providers: [{ provide: ProfileService, useValue: { state$, refresh } }],
    });
  });

  it('waits while the profile loads', () => {
    expect(createShell().view()).toBe('loading');
  });

  it('shows onboarding to a user without a profile', () => {
    state$.next({ kind: 'none' });

    expect(createShell().view()).toBe('onboarding');
  });

  for (const status of [
    'vetting',
    'approved',
    'active',
    'disabled',
    'suspended',
    'deleted',
  ] as const) {
    it(`shows the ${status} screen to a ${status} profile`, () => {
      state$.next(profile(status) as ProfileState);

      expect(createShell().view()).toBe(status);
    });
  }

  it('shows the error screen when the profile could not be loaded', () => {
    state$.next({ kind: 'error' });

    expect(createShell().view()).toBe('error');
  });

  it('keeps showing loading while signing out, until the redirect happens', () => {
    state$.next({ kind: 'signed-out' });

    expect(createShell().view()).toBe('loading');
  });

  it('follows the profile as it changes, for example after submitting onboarding', () => {
    state$.next({ kind: 'none' });
    const shell = createShell();
    expect(shell.view()).toBe('onboarding');

    state$.next({ kind: 'loading' });
    state$.next(profile('vetting') as ProfileState);

    expect(shell.view()).toBe('vetting');
  });

  it('retries by reloading the profile', () => {
    createShell().retry();

    expect(refresh).toHaveBeenCalledTimes(1);
  });
});
