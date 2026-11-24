import { TestBed } from '@angular/core/testing';
import { BehaviorSubject } from 'rxjs';
import { MyProfile, ProfileStatus } from '../../core/profile.model';
import { ProfileService, ProfileState } from '../../core/profile.service';
import { ShellComponent } from './shell.component';

describe('ShellComponent', () => {
  let state$: BehaviorSubject<ProfileState>;
  let refresh: jasmine.Spy;

  const profile = (status: ProfileStatus, ageVerified = true) => ({
    kind: 'loaded',
    profile: { status, age_verified_at: ageVerified ? '2026-11-24T12:00:00Z' : null } as MyProfile,
  });

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

  it('asks a user who has not accepted the terms to accept them', () => {
    state$.next({ kind: 'needs-terms' });

    expect(createShell().view()).toBe('needs-terms');
  });

  it('shows onboarding to a user without a profile', () => {
    state$.next({ kind: 'none' });

    expect(createShell().view()).toBe('onboarding');
  });

  for (const status of [
    'vetting',
    'active',
    'disabled',
    'suspended',
    'deleted',
    'admin',
  ] as const) {
    it(`shows the ${status} screen to a ${status} profile`, () => {
      state$.next(profile(status) as ProfileState);

      expect(createShell().view()).toBe(status);
    });
  }

  it('asks an applicant to check their age right after submitting', () => {
    state$.next(profile('vetting', false) as ProfileState);
    const shell = createShell();

    expect(shell.view()).toBe('age-verification');
    expect(shell.approved()).toBeFalse();
  });

  it('asks an applicant approved before their age check to check it', () => {
    state$.next(profile('approved', false) as ProfileState);
    const shell = createShell();

    expect(shell.view()).toBe('age-verification');
    expect(shell.approved()).toBeTrue();
  });

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
