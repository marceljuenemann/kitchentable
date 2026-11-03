import { TestBed } from '@angular/core/testing';
import { BehaviorSubject } from 'rxjs';
import { MyProfile } from '../../../core/profile.model';
import { ProfileService, ProfileState } from '../../../core/profile.service';
import { MyProfileStore, toMember } from './my-profile.store';

const profile: MyProfile = {
  id: 'me',
  status: 'active',
  name: 'Sam',
  pronouns: 'they/them',
  tagline: '',
  bio: 'About me',
  location: 'London',
  gender: ['Non-binary'],
  sexuality: [],
  birth_year: 1990,
  birth_month: 6,
  looking_for: ['friends'],
  photos: ['a', 'b'],
  search_filters: null,
  hide_by_gender: false,
};

describe('toMember', () => {
  it('shows the age, never the birth date, status or settings', () => {
    const member = toMember(profile);

    expect(member.age).toBe(new Date().getFullYear() - 1990 - (new Date().getMonth() < 6 ? 1 : 0));
    expect(Object.keys(member)).not.toContain('birth_year');
    expect(Object.keys(member)).not.toContain('status');
    expect(Object.keys(member)).not.toContain('search_filters');
  });

  it('has no age without a birthday', () => {
    expect(toMember({ ...profile, birth_year: null, birth_month: null }).age).toBeNull();
  });
});

describe('MyProfileStore', () => {
  it('starts from the loaded profile and shows saved changes', async () => {
    const state$ = new BehaviorSubject<ProfileState>({ kind: 'loaded', profile });
    TestBed.configureTestingModule({
      providers: [MyProfileStore, { provide: ProfileService, useValue: { state$ } }],
    });
    const store = TestBed.inject(MyProfileStore);

    await store.save({ name: 'Alex', photos: ['b', 'a'] });

    expect(store.profile()).toEqual({ ...profile, name: 'Alex', photos: ['b', 'a'] });
    expect(store.member()?.name).toBe('Alex');
  });
});
