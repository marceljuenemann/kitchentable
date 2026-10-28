import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  CanActivateFn,
  CanMatchFn,
  provideRouter,
  Route,
  RouterStateSnapshot,
  UrlTree,
} from '@angular/router';
import { SupabaseService } from '../supabase.service';
import { adminGuard, authGuard, signedOutGuard } from './auth.guard';

describe('route guards', () => {
  let session: object | null;
  let rpc: jasmine.Spy;

  beforeEach(() => {
    session = null;
    rpc = jasmine.createSpy('rpc').and.resolveTo({ data: false, error: null });
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: SupabaseService,
          useValue: {
            client: { auth: { getSession: async () => ({ data: { session } }) }, rpc },
          },
        },
      ],
    });
  });

  const run = (guard: CanActivateFn) =>
    TestBed.runInInjectionContext(() =>
      guard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
    ) as Promise<boolean | UrlTree>;

  const runMatch = (guard: CanMatchFn) =>
    TestBed.runInInjectionContext(() =>
      guard({} as Route, [], {} as Parameters<CanMatchFn>[2]),
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

  describe('adminGuard', () => {
    it('lets an admin through', async () => {
      session = { user: { id: 'admin-1' } };
      rpc.and.resolveTo({ data: true, error: null });

      expect(await runMatch(adminGuard)).toBeTrue();
      expect(rpc).toHaveBeenCalledOnceWith('is_admin');
    });

    it('sends a member to the app', async () => {
      session = { user: { id: 'user-1' } };

      const result = await runMatch(adminGuard);

      expect(result instanceof UrlTree && result.toString()).toBe('/app');
    });

    it('sends a member to the app if the check fails', async () => {
      session = { user: { id: 'user-1' } };
      rpc.and.resolveTo({ data: null, error: { message: 'offline' } });

      const result = await runMatch(adminGuard);

      expect(result instanceof UrlTree && result.toString()).toBe('/app');
    });

    it('sends a signed-out visitor to the landing page without asking the database', async () => {
      const result = await runMatch(adminGuard);

      expect(result instanceof UrlTree && result.toString()).toBe('/');
      expect(rpc).not.toHaveBeenCalled();
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
