import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  CanActivateFn,
  provideRouter,
  RouterStateSnapshot,
  UrlTree,
} from '@angular/router';
import { SupabaseService } from '../supabase.service';
import { authGuard, signedOutGuard } from './auth.guard';

describe('route guards', () => {
  let session: object | null;

  beforeEach(() => {
    session = null;
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: SupabaseService,
          useValue: { client: { auth: { getSession: async () => ({ data: { session } }) } } },
        },
      ],
    });
  });

  const run = (guard: CanActivateFn) =>
    TestBed.runInInjectionContext(() =>
      guard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
    ) as Promise<boolean | UrlTree>;

  describe('authGuard', () => {
    it('lets a signed-in user through', async () => {
      session = { user: { id: 'user-1' } };

      expect(await run(authGuard)).toBeTrue();
    });

    it('sends everyone else to the landing page', async () => {
      const result = await run(authGuard);

      expect(result instanceof UrlTree && result.toString()).toBe('/');
    });
  });

  describe('signedOutGuard', () => {
    it('lets a signed-out visitor see the public page', async () => {
      expect(await run(signedOutGuard)).toBeTrue();
    });

    it('sends a signed-in user on to the app', async () => {
      session = { user: { id: 'user-1' } };

      const result = await run(signedOutGuard);

      expect(result instanceof UrlTree && result.toString()).toBe('/app');
    });
  });
});
