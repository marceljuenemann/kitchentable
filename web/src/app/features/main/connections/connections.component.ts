import { Component } from '@angular/core';
import { HeaderComponent } from '../../../shared/header/header.component';
import { HugPandaComponent } from './hug-panda.component';

/**
 * The Connections tab: introductions other members sent you. Introductions aren't built yet,
 * so for now it's always the empty state, which will also show once you've dismissed them all.
 */
@Component({
  selector: 'app-connections',
  standalone: true,
  imports: [HeaderComponent, HugPandaComponent],
  template: `
    <app-header />
    <!-- For screen readers: the bottom nav says which tab this is for everyone else. -->
    <h1 class="kt-visually-hidden">Connections</h1>
    <section class="empty">
      <app-hug-panda />
      <h2>No connection requests</h2>
      <p>When someone reaches out to you with an introduction, it'll show up here.</p>
    </section>
  `,
  styles: `
    :host {
      display: block;
    }

    .empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      margin-top: 48px;
      text-align: center;
    }

    h2 {
      margin: 20px 0 0;
      font-family: var(--kt-font-display);
      font-size: 22px;
      font-weight: 700;
      line-height: 1.2;
      color: var(--kt-violet);
    }

    p {
      max-width: 300px;
      margin: 8px 0 0;
      font-size: 15px;
      line-height: 1.5;
      color: var(--kt-muted);
    }
  `,
})
export class ConnectionsComponent {}
