import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';

/** Event names, as allowed by `track_event` (see docs/database.md). */
export type AnalyticsEvent = 'onboarding_step_viewed';

/**
 * First-party analytics: events go to our own database, keyed on the signed-in user, and nothing
 * is stored in the browser. Never record other people's ids, free text or profile content.
 */
@Injectable({ providedIn: 'root' })
export class AnalyticsService {
  private readonly supabase = inject(SupabaseService);

  /** Records an event. Fire-and-forget: a failure is logged and never reaches the UI. */
  track(name: AnalyticsEvent, props?: Record<string, string | number | boolean>): void {
    const warn = (error: unknown) => console.warn('Could not record analytics event', name, error);
    this.supabase.client
      .rpc('track_event', { p_name: name, p_props: props ?? null })
      .then(({ error }) => error && warn(error), warn);
  }
}
