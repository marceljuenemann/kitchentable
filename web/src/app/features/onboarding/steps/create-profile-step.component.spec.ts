import { ComponentFixture, TestBed } from '@angular/core/testing';
import { UserStorage } from '../../../core/user-storage';
import { OnboardingDraftStore } from '../onboarding-draft.store';
import { CreateProfileStepComponent } from './create-profile-step.component';

describe('CreateProfileStepComponent', () => {
  let fixture: ComponentFixture<CreateProfileStepComponent>;
  let component: CreateProfileStepComponent;
  let store: OnboardingDraftStore;

  /** The text of the row with the given label, e.g. "Age · optional Add birthday". */
  const row = (label: string) =>
    (
      Array.from(fixture.nativeElement.querySelectorAll('.row')).find((element) =>
        (element as HTMLElement).textContent?.includes(label),
      ) as HTMLElement
    ).textContent!.replace(/\s+/g, ' ');

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        OnboardingDraftStore,
        { provide: UserStorage, useValue: { get: () => null, set: () => undefined } },
      ],
    });
    store = TestBed.inject(OnboardingDraftStore);
    fixture = TestBed.createComponent(CreateProfileStepComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  describe('continuing', () => {
    it('needs a name and pronouns', () => {
      expect(component.canContinue()).toBeFalse();

      store.update({ name: 'Sam' });
      expect(component.canContinue()).toBeFalse();

      store.update({ pronouns: ['they/them'] });
      expect(component.canContinue()).toBeTrue();
    });

    it('does not accept a name of only spaces', () => {
      store.update({ name: '   ', pronouns: ['they/them'] });

      expect(component.canContinue()).toBeFalse();
    });

    it('needs a location, which starts as London', () => {
      store.update({ name: 'Sam', pronouns: ['they/them'] });
      expect(component.canContinue()).toBeTrue();

      store.update({ location: '  ' });
      expect(component.canContinue()).toBeFalse();
    });

    it('goes to step 2, but only when it can continue', () => {
      component.next();
      expect(store.draft().step).toBe(1);

      store.update({ name: 'Sam', pronouns: ['they/them'] });
      component.next();

      expect(store.draft().step).toBe(2);
    });
  });

  describe('rows', () => {
    it('invite the user to fill in what is empty, marking what is required', () => {
      expect(row('Preferred pronouns')).toContain('required');
      expect(row('Preferred pronouns')).toContain('Add pronouns');
      expect(row('Gender')).toContain('optional');
      expect(row('Age')).toContain('Add birthday');
      expect(row('Location')).toContain('London');
    });

    it('show the chosen values', () => {
      store.update({
        pronouns: ['they/them'],
        gender: ['Woman', 'bigender'],
        sexuality: ['Queer'],
        location: 'Manchester',
      });
      fixture.detectChanges();

      expect(row('Preferred pronouns')).toContain('they/them');
      expect(row('Gender')).toContain('Woman, bigender');
      expect(row('Sexuality')).toContain('Queer');
      expect(row('Location')).toContain('Manchester');
    });

    it('show the age worked out from the birth month and year, never the birthday itself', () => {
      const year = new Date().getFullYear() - 30;
      store.update({ birthMonth: '1', birthYear: `${year}` });
      fixture.detectChanges();

      // January has always passed, so the age is exactly 30 whatever today's date is.
      expect(row('Age')).toContain('optional30');
      expect(row('Age')).not.toContain(`${year}`);
    });
  });
});
