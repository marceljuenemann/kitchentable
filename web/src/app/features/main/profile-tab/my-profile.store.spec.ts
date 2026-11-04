import { TestBed } from '@angular/core/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { BehaviorSubject, Subject } from 'rxjs';
import { MyProfile } from '../../../core/profile.model';
import { ProfileService, ProfileState } from '../../../core/profile.service';
import { SupabaseService } from '../../../core/supabase.service';
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
  /** Lets pending promises (a queued save) run. */
  const tick = () => new Promise((resolve) => setTimeout(resolve));
  let store: MyProfileStore;
  let rpc: jasmine.Spy;
  let open: jasmine.Spy;
  let retry: Subject<void>;

  beforeEach(() => {
    rpc = jasmine.createSpy('rpc').and.resolveTo({ error: null });
    retry = new Subject<void>();
    open = jasmine.createSpy('open').and.returnValue({ onAction: () => retry });
    TestBed.configureTestingModule({
      providers: [
        MyProfileStore,
        {
          provide: ProfileService,
          useValue: { state$: new BehaviorSubject<ProfileState>({ kind: 'loaded', profile }) },
        },
        { provide: SupabaseService, useValue: { client: { rpc } } },
        { provide: MatSnackBar, useValue: { open } },
      ],
    });
    spyOn(console, 'warn');
    store = TestBed.inject(MyProfileStore);
  });

  it('shows a change straight away and saves the whole set of fields', async () => {
    const saved = store.save({ name: 'Alex', photos: ['b', 'a'] });
    expect(store.profile()?.name).toBe('Alex');

    expect(await saved).toBeTrue();
    expect(rpc).toHaveBeenCalledOnceWith('update_profile', {
      p_name: 'Alex',
      p_pronouns: 'they/them',
      p_tagline: '',
      p_bio: 'About me',
      p_gender: ['Non-binary'],
      p_sexuality: [],
      p_birth_year: 1990,
      p_birth_month: 6,
      p_looking_for: ['friends'],
      p_photos: ['b', 'a'],
    });
    expect(store.member()?.name).toBe('Alex');
  });

  it('puts the saved profile back when a save fails, and Retry saves the change again', async () => {
    rpc.and.resolveTo({ error: { message: 'offline' } });

    expect(await store.save({ name: 'Alex' })).toBeFalse();
    expect(store.profile()?.name).toBe('Sam');
    expect(open).toHaveBeenCalledOnceWith(
      "Couldn't save your profile",
      'Retry',
      jasmine.anything(),
    );

    rpc.and.resolveTo({ error: null });
    retry.next();
    expect(store.profile()?.name).toBe('Alex');
    await tick();
    expect(rpc).toHaveBeenCalledTimes(2);
    expect(rpc.calls.mostRecent().args[1].p_name).toBe('Alex');
  });

  it('sends changes made together in one save', async () => {
    const first = store.save({ name: 'Alex' });
    const second = store.save({ tagline: 'Hi' });

    expect(await first).toBeTrue();
    expect(await second).toBeTrue();
    expect(rpc).toHaveBeenCalledOnceWith(
      'update_profile',
      jasmine.objectContaining({ p_name: 'Alex', p_tagline: 'Hi' }),
    );
  });

  it('saves one at a time, a change made meanwhile going with the next save', async () => {
    let finishFirst!: (value: { error: null }) => void;
    rpc.and.returnValues(
      new Promise((resolve) => (finishFirst = resolve)),
      Promise.resolve({ error: null }),
    );

    const first = store.save({ name: 'Alex' });
    await tick();
    const second = store.save({ tagline: 'Hi' });
    await tick();
    expect(rpc).toHaveBeenCalledTimes(1);

    finishFirst({ error: null });
    expect(await first).toBeTrue();
    expect(await second).toBeTrue();
    expect(rpc).toHaveBeenCalledTimes(2);
    expect(rpc.calls.mostRecent().args[1]).toEqual(
      jasmine.objectContaining({ p_name: 'Alex', p_tagline: 'Hi' }),
    );
  });
});
