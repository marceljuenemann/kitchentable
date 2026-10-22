import { ComponentFixture, TestBed } from '@angular/core/testing';
import { UserStorage } from '../../../core/user-storage';
import { OnboardingDraftStore } from '../onboarding-draft.store';
import { ABOUT_MIN_LENGTH } from '../onboarding-options';
import { AboutYouStepComponent } from './about-you-step.component';

describe('AboutYouStepComponent', () => {
  let fixture: ComponentFixture<AboutYouStepComponent>;
  let component: AboutYouStepComponent;
  let store: OnboardingDraftStore;

  const continueButton = () =>
    Array.from(fixture.nativeElement.querySelectorAll('button')).find((button) =>
      (button as HTMLElement).textContent?.includes('Continue'),
    ) as HTMLButtonElement;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        OnboardingDraftStore,
        { provide: UserStorage, useValue: { get: () => null, set: () => undefined } },
      ],
    });
    store = TestBed.inject(OnboardingDraftStore);
    store.update({ step: 2 });
    fixture = TestBed.createComponent(AboutYouStepComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  describe('continuing', () => {
    it('needs a long enough about text and something looked for', () => {
      expect(component.canContinue()).toBeFalse();

      store.update({ aboutText: 'x'.repeat(ABOUT_MIN_LENGTH) });
      expect(component.canContinue()).toBeFalse();

      store.update({ lookingFor: ['polyamory'] });
      expect(component.canContinue()).toBeTrue();
    });

    it('counts the about text without surrounding spaces', () => {
      store.update({ aboutText: `  ${'x'.repeat(ABOUT_MIN_LENGTH - 1)}  `, lookingFor: ['x'] });

      expect(component.canContinue()).toBeFalse();
    });

    it('goes to step 3, but only when it can continue', () => {
      component.next();
      expect(store.draft().step).toBe(2);

      store.update({ aboutText: 'x'.repeat(ABOUT_MIN_LENGTH), lookingFor: ['polyamory'] });
      fixture.detectChanges();
      expect(continueButton().disabled).toBeFalse();
      component.next();

      expect(store.draft().step).toBe(3);
    });
  });

  describe('looking for', () => {
    it('lists the standard options, then the user’s own entries', () => {
      component.addOwn('Running buddies');
      const options = component.options();

      expect(options[0]).toBe('polyamory');
      expect(options[options.length - 1]).toBe('Running buddies');
    });

    it('selects what the user adds', () => {
      component.addOwn('Running buddies');

      expect(store.draft().lookingFor).toEqual(['Running buddies']);
    });

    it('stores a typed standard option under its id, so it is not added twice', () => {
      component.addOwn('  open relationship ');

      expect(store.draft().lookingFor).toEqual(['open-relationship']);
      expect(component.isDuplicate('Open relationship')).toBeTrue();
    });

    it('drops an own entry from the list once it is deselected', () => {
      component.addOwn('Running buddies');
      component.setLookingFor([]);

      expect(component.options()).not.toContain('Running buddies');
    });
  });

  describe('counters', () => {
    it('counts down the tagline characters', () => {
      store.update({ tagline: 'Hello' });

      expect(component.taglineLeft()).toBe(55);
    });

    it('counts down to the minimum length of the about text', () => {
      store.update({ aboutText: 'x'.repeat(100) });

      expect(component.aboutLeft()).toBe(ABOUT_MIN_LENGTH - 100);

      store.update({ aboutText: 'x'.repeat(ABOUT_MIN_LENGTH + 50) });
      expect(component.aboutLeft()).toBe(0);
    });
  });
});
