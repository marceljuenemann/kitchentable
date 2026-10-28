import { signal } from '@angular/core';
import { fakeAsync, TestBed, tick } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { ProfileService } from '../../core/profile.service';
import { UserStorage } from '../../core/user-storage';
import {
  AgeVerificationComponent,
  POLL_ATTEMPTS,
  POLL_INTERVAL_MS,
} from './age-verification.component';

describe('AgeVerificationComponent', () => {
  let fetchStatus: jasmine.Spy;
  let refresh: jasmine.Spy;
  let startAgeVerification: jasmine.Spy;
  let navigate: jasmine.Spy;
  const route = { snapshot: { queryParamMap: convertToParamMap({}) } };

  /** The screen as it opens with Didit's `status` in the URL (or without). */
  const create = (status?: string) => {
    route.snapshot.queryParamMap = convertToParamMap(status ? { status } : {});
    return TestBed.createComponent(AgeVerificationComponent);
  };

  beforeEach(() => {
    fetchStatus = jasmine.createSpy('fetchStatus').and.resolveTo('approved');
    refresh = jasmine.createSpy('refresh');
    startAgeVerification = jasmine.createSpy('startAgeVerification');
    navigate = jasmine.createSpy('navigate').and.resolveTo(true);
    TestBed.configureTestingModule({
      providers: [
        { provide: ProfileService, useValue: { fetchStatus, refresh, startAgeVerification } },
        { provide: Router, useValue: { navigate } },
        { provide: ActivatedRoute, useValue: route },
        // For the footer.
        { provide: AuthService, useValue: { session: signal(null) } },
        { provide: UserStorage, useValue: {} },
      ],
    });
  });

  it('starts with the explanation when not coming back from Didit', () => {
    const screen = create().componentInstance;

    expect(screen.phase()).toBe('start');
    expect(navigate).not.toHaveBeenCalled();
  });

  it('shows the outcome Didit reports, and drops its parameters from the URL', () => {
    expect(create('Declined').componentInstance.phase()).toBe('declined');
    expect(create('In Review').componentInstance.phase()).toBe('review');
    expect(create('Abandoned').componentInstance.phase()).toBe('start');
    expect(navigate).toHaveBeenCalledTimes(3);
    expect(navigate.calls.mostRecent().args[1]).toEqual(
      jasmine.objectContaining({ queryParams: {}, replaceUrl: true }),
    );
  });

  it('after a passed check, reloads the profile once the webhook has activated it', fakeAsync(() => {
    const fixture = create('Approved');
    expect(fixture.componentInstance.phase()).toBe('finishing');

    tick(POLL_INTERVAL_MS);
    expect(fetchStatus).toHaveBeenCalledTimes(1);
    expect(refresh).not.toHaveBeenCalled();

    fetchStatus.and.resolveTo('active');
    tick(POLL_INTERVAL_MS);
    expect(refresh).toHaveBeenCalledTimes(1);

    tick(POLL_INTERVAL_MS * POLL_ATTEMPTS);
    expect(fetchStatus).toHaveBeenCalledTimes(2);
    fixture.destroy();
  }));

  it('keeps polling through failed requests, then says it is taking longer', fakeAsync(() => {
    fetchStatus.and.rejectWith(new Error('network'));
    const screen = create('Approved').componentInstance;

    tick(POLL_INTERVAL_MS * POLL_ATTEMPTS);

    expect(fetchStatus).toHaveBeenCalledTimes(POLL_ATTEMPTS);
    expect(refresh).not.toHaveBeenCalled();
    expect(screen.phase()).toBe('slow');

    // "Check again" polls once more.
    fetchStatus.and.resolveTo('active');
    screen.waitForActivation();
    expect(screen.phase()).toBe('finishing');
    tick(POLL_INTERVAL_MS);
    expect(refresh).toHaveBeenCalledTimes(1);
  }));

  it('stops polling when the screen goes away', fakeAsync(() => {
    const fixture = create('Approved');
    fixture.destroy();

    tick(POLL_INTERVAL_MS * POLL_ATTEMPTS);

    expect(fetchStatus).not.toHaveBeenCalled();
  }));

  it('shows an error and allows another try if the check cannot be started', async () => {
    startAgeVerification.and.rejectWith(new Error('network'));
    const screen = create().componentInstance;

    await screen.start();

    expect(screen.failed()).toBeTrue();
    expect(screen.starting()).toBeFalse();
  });
});
