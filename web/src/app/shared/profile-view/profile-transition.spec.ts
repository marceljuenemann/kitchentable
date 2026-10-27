import { ActivatedRouteSnapshot, ViewTransitionInfo } from '@angular/router';
import { onViewTransitionCreated } from './profile-transition';

describe('onViewTransitionCreated', () => {
  const route = (data: object, children: ActivatedRouteSnapshot[] = []) =>
    ({ data, children }) as unknown as ActivatedRouteSnapshot;
  const grid = route({}, [route({})]);
  const profile = route({}, [route({}, [route({ profileOverlay: true })])]);

  const run = (from: ActivatedRouteSnapshot, to: ActivatedRouteSnapshot) => {
    const skipTransition = jasmine.createSpy('skipTransition');
    onViewTransitionCreated({
      transition: { skipTransition },
      from,
      to,
    } as unknown as ViewTransitionInfo);
    return skipTransition;
  };

  it('animates opening a profile', () => {
    expect(run(grid, profile)).not.toHaveBeenCalled();
  });

  it('animates closing a profile', () => {
    expect(run(profile, grid)).not.toHaveBeenCalled();
  });

  it('skips every other navigation', () => {
    expect(run(grid, route({}))).toHaveBeenCalled();
  });
});
