import { VETTING_QUESTIONS } from '../../onboarding/onboarding-options';
import { vettingAnswers } from './vetting-box.component';

describe('vettingAnswers', () => {
  const [first, second] = VETTING_QUESTIONS;

  it('shows the answers under their questions, in the order onboarding asks them', () => {
    const rows = vettingAnswers({ [second.id]: 'Second answer', [first.id]: 'First answer' });

    expect(rows).toEqual([
      { label: first.prompt, text: 'First answer' },
      { label: second.prompt, text: 'Second answer' },
    ]);
  });

  it('leaves out the invite code and the onboarding feedback, which are shown separately', () => {
    const rows = vettingAnswers({
      [first.id]: 'Answer',
      invite_code: 'abc123',
      onboarding_feedback: 'Smooth',
    });

    expect(rows).toEqual([{ label: first.prompt, text: 'Answer' }]);
  });

  it('still shows an answer to a question that is no longer asked, under its id', () => {
    const rows = vettingAnswers({ [first.id]: 'Answer', old_question: 'Old answer' });

    expect(rows).toEqual([
      { label: first.prompt, text: 'Answer' },
      { label: 'old_question', text: 'Old answer' },
    ]);
  });

  it('skips questions without an answer', () => {
    expect(vettingAnswers({ [second.id]: 'Answer' })).toEqual([
      { label: second.prompt, text: 'Answer' },
    ]);
  });
});
