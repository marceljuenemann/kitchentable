import { Component, OnInit, signal } from '@angular/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatButtonModule } from '@angular/material/button';
import { RouterLink } from '@angular/router';
import { SupabaseService } from '../../../core/supabase.service';

@Component({
  selector: 'app-callback',
  standalone: true,
  imports: [MatProgressSpinnerModule, MatButtonModule, RouterLink],
  templateUrl: './callback.component.html',
  styleUrl: './callback.component.scss',
})
export class CallbackComponent implements OnInit {
  readonly timedOut = signal(false);

  constructor(private readonly supabase: SupabaseService) {}

  ngOnInit() {
    // supabase-js parses the magic-link token out of the URL as part of
    // client initialization, then strips it from the URL via a
    // same-document navigation. That races with Angular's router (it shows
    // up as a competing popstate and cancels an in-flight
    // router.navigateByUrl), so once a session appears we do a hard
    // redirect instead of a client-side one -- it sidesteps the race
    // entirely, and a reload on this one-off landing page is unnoticeable.
    const { data: sub } = this.supabase.client.auth.onAuthStateChange((_event, session) => {
      if (session) {
        sub.subscription.unsubscribe();
        window.location.href = '/apply';
      }
    });

    setTimeout(() => {
      if (!window.location.pathname.startsWith('/apply')) {
        this.timedOut.set(true);
      }
    }, 8000);
  }
}
