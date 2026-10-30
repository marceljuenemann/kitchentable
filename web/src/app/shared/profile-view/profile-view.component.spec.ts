import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Member } from '../../core/profile.model';
import { ProfileViewComponent } from './profile-view.component';

describe('ProfileViewComponent', () => {
  const profile: Member = {
    id: 'ivy',
    name: 'Ivy',
    pronouns: 'she/her',
    tagline: '',
    bio: 'First paragraph.\nStill the first.\n\n  \n\nSecond paragraph.',
    location: 'London',
    gender: ['Woman', 'Genderfluid'],
    sexuality: ['Queer'],
    age: null,
    looking_for: ['polyamory', 'Something of my own'],
    photos: [],
  };

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
  });

  const create = (overrides: Partial<Member> = {}) => {
    const fixture = TestBed.createComponent(ProfileViewComponent);
    fixture.componentRef.setInput('profile', { ...profile, ...overrides });
    return fixture.componentInstance;
  };

  it('splits About me into paragraphs at blank lines', () => {
    expect(create().aboutParagraphs()).toEqual([
      'First paragraph.\nStill the first.',
      'Second paragraph.',
    ]);
  });

  it('shows the standard "looking for" options by their label, and custom ones as written', () => {
    expect(create().lookingFor()).toEqual(['Polyamory', 'Something of my own']);
  });
});
