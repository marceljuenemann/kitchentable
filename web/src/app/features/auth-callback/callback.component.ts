import { Component, OnInit, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { safeNext } from '../../core/auth/next-url';
import { SupabaseService } from '../../core/supabase.service';

@Component({
  selector: 'app-callback',
  standalone: true,
  imports: [MatButtonModule, RouterLink],
  templateUrl: './callback.component.html',
  styleUrl: './callback.component.scss',
})
export class CallbackComponent implements OnInit {
  readonly timedOut = signal(false);

  private readonly supabase = inject(SupabaseService);
  private readonly route = inject(ActivatedRoute);

  ngOnInit() {
    // supabase-js parses the magic-link token out of the URL as part of
    // client initialization, then strips it from the URL via a
    // same-document navigation. That races with Angular's router (it shows
    // up as a competing popstate and cancels an in-flight
    // router.navigateByUrl), so once a session appears we do a hard
    // redirect instead of a client-side one -- it sidesteps the race
    // entirely, and a reload on this one-off landing page is unnoticeable.
    // It goes to the page the link was asked for from (`next`, see the
    // sign-in page), or else the app.
    const next = safeNext(this.route.snapshot.queryParamMap.get('next'));
    const { data: sub } = this.supabase.client.auth.onAuthStateChange((_event, session) => {
      if (session) {
        sub.subscription.unsubscribe();
        window.location.href = next;
      }
    });

    setTimeout(() => {
      if (window.location.pathname.startsWith('/auth/callback')) {
        this.timedOut.set(true);
      }
    }, 8000);
  }
}
