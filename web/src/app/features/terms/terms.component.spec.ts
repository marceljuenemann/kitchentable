import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { ProfileService } from '../../core/profile.service';
import { UserStorage } from '../../core/user-storage';
import { TermsComponent } from './terms.component';

describe('TermsComponent', () => {
  let acceptTerms: jasmine.Spy;

  /** Creates the screen without rendering it: only its gating is under test here. */
  const createTerms = () => TestBed.createComponent(TermsComponent).componentInstance;

  beforeEach(() => {
    acceptTerms = jasmine.createSpy('acceptTerms').and.resolveTo();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: ProfileService, useValue: { acceptTerms } },
        // For the footer.
        { provide: AuthService, useValue: { session: signal(null) } },
        { provide: UserStorage, useValue: {} },
      ],
    });
  });

  it('needs both the terms and the consent ticked to continue', async () => {
    const terms = createTerms();
    expect(terms.canContinue()).toBeFalse();

    terms.termsAgreed.set(true);
    expect(terms.canContinue()).toBeFalse();
    await terms.continue();
    expect(acceptTerms).not.toHaveBeenCalled();

    terms.termsAgreed.set(false);
    terms.consentGiven.set(true);
    expect(terms.canContinue()).toBeFalse();

    terms.termsAgreed.set(true);
    expect(terms.canContinue()).toBeTrue();
  });

  it('records the acceptance once both are ticked', async () => {
    const terms = createTerms();
    terms.termsAgreed.set(true);
    terms.consentGiven.set(true);

    await terms.continue();

    expect(acceptTerms).toHaveBeenCalledTimes(1);
    expect(terms.failed()).toBeFalse();
  });

  it('shows an error and allows another try if saving fails', async () => {
    acceptTerms.and.rejectWith(new Error('network'));
    const terms = createTerms();
    terms.termsAgreed.set(true);
    terms.consentGiven.set(true);

    await terms.continue();

    expect(terms.failed()).toBeTrue();
    expect(terms.canContinue()).toBeTrue();
  });
});
