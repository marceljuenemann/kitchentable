import { TestBed } from '@angular/core/testing';
import { AnalyticsService } from './analytics.service';
import { SupabaseService } from './supabase.service';

describe('AnalyticsService', () => {
  let rpc: jasmine.Spy;
  let service: AnalyticsService;

  /** Lets the fire-and-forget call settle. */
  const settle = () => new Promise((resolve) => setTimeout(resolve));

  beforeEach(() => {
    rpc = jasmine.createSpy('rpc').and.resolveTo({ data: null, error: null });
    spyOn(console, 'warn');
    TestBed.configureTestingModule({
      providers: [{ provide: SupabaseService, useValue: { client: { rpc } } }],
    });
    service = TestBed.inject(AnalyticsService);
  });

  it('records the event through track_event', () => {
    service.track('onboarding_step_viewed', { step: 2 });

    expect(rpc).toHaveBeenCalledOnceWith('track_event', {
      p_name: 'onboarding_step_viewed',
      p_props: { step: 2 },
    });
  });

  it('sends null when there are no properties', () => {
    service.track('onboarding_step_viewed');

    expect(rpc).toHaveBeenCalledOnceWith('track_event', {
      p_name: 'onboarding_step_viewed',
      p_props: null,
    });
  });

  it('only logs an error returned by the database', async () => {
    rpc.and.resolveTo({ data: null, error: { code: 'P0001', message: 'Unknown event.' } });

    expect(() => service.track('onboarding_step_viewed')).not.toThrow();
    await settle();

    expect(console.warn).toHaveBeenCalled();
  });

  it('only logs a failed request', async () => {
    rpc.and.rejectWith(new Error('network'));

    expect(() => service.track('onboarding_step_viewed')).not.toThrow();
    await settle();

    expect(console.warn).toHaveBeenCalled();
  });
});
