import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ProfileService } from '../../../core/profile.service';
import { UserStorage } from '../../../core/user-storage';
import { OnboardingDraftStore } from '../onboarding-draft.store';
import { VETTING_MIN_LENGTH } from '../onboarding-options';
import { VettingStepComponent } from './vetting-step.component';

describe('VettingStepComponent', () => {
  let fixture: ComponentFixture<VettingStepComponent>;
  let store: OnboardingDraftStore;
  let submitOnboarding: jasmine.Spy;

  const text = (length: number, letter = 'a') => letter.repeat(length);
  const textarea = (index: number) =>
    fixture.nativeElement.querySelectorAll('textarea')[index] as HTMLTextAreaElement;
  const submitButton = () =>
    Array.from(fixture.nativeElement.querySelectorAll('button')).find((button) =>
      (button as HTMLElement).textContent?.includes('Submit'),
    ) as HTMLButtonElement;
  const type = (index: number, value: string) => {
    textarea(index).value = value;
    textarea(index).dispatchEvent(new Event('input'));
    fixture.detectChanges();
  };
  const answerBoth = () => {
    type(0, text(VETTING_MIN_LENGTH));
    type(1, text(VETTING_MIN_LENGTH, 'b'));
  };

  beforeEach(() => {
    submitOnboarding = jasmine.createSpy('submitOnboarding').and.resolveTo();
    TestBed.configureTestingModule({
      providers: [
        OnboardingDraftStore,
        { provide: ProfileService, useValue: { submitOnboarding } },
        { provide: UserStorage, useValue: { get: () => null, set: () => undefined } },
      ],
    });
    store = TestBed.inject(OnboardingDraftStore);
    store.update({
      name: 'Sam',
      pronouns: ['they/them'],
      aboutText: 'About Sam',
      lookingFor: ['polyamory'],
      photos: ['photo-1'],
    });
    fixture = TestBed.createComponent(VettingStepComponent);
    fixture.detectChanges();
  });

  it('asks both questions', () => {
    const text = fixture.nativeElement.textContent as string;

    expect(text).toContain('what is consent and why is it important?');
    expect(text).toContain('guidelines do you think everyone');
    expect(fixture.nativeElement.querySelectorAll('textarea').length).toBe(2);
  });

  it('cannot be submitted until both answers are long enough', () => {
    expect(submitButton().disabled).toBeTrue();

    type(0, text(VETTING_MIN_LENGTH));
    expect(submitButton().disabled).toBeTrue();

    type(1, text(VETTING_MIN_LENGTH - 1));
    expect(submitButton().disabled).toBeTrue();

    type(1, text(VETTING_MIN_LENGTH));
    expect(submitButton().disabled).toBeFalse();
  });

  it('counts characters ignoring surrounding spaces', () => {
    type(0, `  ${text(VETTING_MIN_LENGTH - 1)}   `);

    expect(fixture.nativeElement.textContent).toContain(
      `${VETTING_MIN_LENGTH - 1} / ${VETTING_MIN_LENGTH}`,
    );
    expect(submitButton().disabled).toBeTrue();
  });

  it('states the minimum and the progress towards it, then just the count', () => {
    const hints = () => fixture.nativeElement.querySelectorAll('mat-form-field')[0].textContent;
    expect(hints()).toContain(`At least ${VETTING_MIN_LENGTH} characters`);
    expect(hints()).toContain(`0 / ${VETTING_MIN_LENGTH}`);

    type(0, text(30));
    expect(hints()).toContain(`30 / ${VETTING_MIN_LENGTH}`);

    type(0, text(VETTING_MIN_LENGTH + 20));
    expect(hints()).not.toContain('At least');
    expect(hints()).toContain(`${VETTING_MIN_LENGTH + 20} characters`);
  });

  it('keeps the answers in the draft', () => {
    type(0, 'my answer');

    expect(store.draft().vettingAnswers['consent']).toBe('my answer');
  });

  it('submits the finished profile', async () => {
    answerBoth();

    submitButton().click();
    await fixture.whenStable();

    expect(submitOnboarding).toHaveBeenCalledTimes(1);
    expect(submitOnboarding.calls.mostRecent().args[0]).toEqual(
      jasmine.objectContaining({
        name: 'Sam',
        pronouns: 'they/them',
        photos: ['photo-1'],
        vetting_answers: {
          consent: text(VETTING_MIN_LENGTH),
          guidelines: text(VETTING_MIN_LENGTH, 'b'),
        },
      }),
    );
  });

  it('cannot be submitted twice while the first submission is running', async () => {
    let finish!: () => void;
    submitOnboarding.and.returnValue(new Promise<void>((resolve) => (finish = resolve)));
    answerBoth();

    submitButton().click();
    fixture.detectChanges();

    expect(submitButton().disabled).toBeTrue();
    expect(submitButton().textContent).toContain('Submitting');
    submitButton().click();
    expect(submitOnboarding).toHaveBeenCalledTimes(1);
    finish();
    await fixture.whenStable();
  });

  it('shows an error and lets the user try again if submitting fails', async () => {
    submitOnboarding.and.rejectWith(new Error('offline'));
    answerBoth();

    submitButton().click();
    await fixture.whenStable();
    fixture.detectChanges();

    const alert = fixture.nativeElement.querySelector('[role=alert]') as HTMLElement;
    expect(alert.textContent).toContain("couldn't submit your application");
    expect(submitButton().disabled).toBeFalse();

    submitOnboarding.and.resolveTo();
    submitButton().click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(submitOnboarding).toHaveBeenCalledTimes(2);
    expect(fixture.nativeElement.querySelector('[role=alert]')).toBeNull();
  });
});
