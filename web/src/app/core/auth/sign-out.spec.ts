import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { UserStorage } from '../user-storage';
import { AuthService } from './auth.service';
import { injectSignOut } from './sign-out';

describe('injectSignOut', () => {
  let calls: string[];

  beforeEach(() => {
    calls = [];
    TestBed.configureTestingModule({
      providers: [
        { provide: UserStorage, useValue: { onSignOut: () => calls.push('clear storage') } },
        { provide: AuthService, useValue: { signOut: async () => calls.push('end session') } },
        { provide: Router, useValue: { navigateByUrl: async (url: string) => calls.push(url) } },
      ],
    });
  });

  it("clears the user's storage before ending the session, then goes to the landing page", async () => {
    const signOut = TestBed.runInInjectionContext(injectSignOut);

    await signOut();

    expect(calls).toEqual(['clear storage', 'end session', '/']);
  });
});
