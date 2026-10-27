import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Profile } from '../../core/profile.model';
import { ProfileViewComponent } from './profile-view.component';

describe('ProfileViewComponent', () => {
  const profile: Profile = {
    id: 'ivy',
    status: 'vetting',
    name: 'Ivy',
    pronouns: 'she/her',
    tagline: '',
    bio: 'First paragraph.\nStill the first.\n\n  \n\nSecond paragraph.',
    location: 'London',
    gender: ['Woman', 'Genderfluid'],
    sexuality: ['Queer'],
    birth_year: null,
    birth_month: null,
    looking_for: ['polyamory', 'Something of my own'],
    photos: [],
  };

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
  });

  const create = (overrides: Partial<Profile> = {}) => {
    const fixture = TestBed.createComponent(ProfileViewComponent);
    fixture.componentRef.setInput('profile', { ...profile, ...overrides });
    return fixture.componentInstance;
  };

  it('works out the age, when there is a birth date', () => {
    const year = new Date().getFullYear() - 30;

    expect(create({ birth_year: year, birth_month: 1 }).age()).toBe(30);
    expect(create().age()).toBeNull();
  });

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
