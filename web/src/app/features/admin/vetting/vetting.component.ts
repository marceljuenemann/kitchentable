import { Component, computed, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { RouterOutlet } from '@angular/router';
import { HeaderComponent } from '../../../shared/header/header.component';
import {
  ProfileGridComponent,
  ProfileTile,
} from '../../../shared/profile-grid/profile-grid.component';
import { VettingStore } from './vetting.store';

/** The applications waiting for review, as a grid; one opens over it as a child route. */
@Component({
  selector: 'app-vetting',
  standalone: true,
  imports: [
    MatButtonModule,
    MatProgressSpinnerModule,
    RouterOutlet,
    HeaderComponent,
    ProfileGridComponent,
  ],
  templateUrl: './vetting.component.html',
  styleUrl: './vetting.component.scss',
})
export class VettingComponent {
  readonly store = inject(VettingStore);

  readonly tiles = computed<ProfileTile[]>(() =>
    (this.store.applications() ?? []).map(({ id, name, tagline }) => ({
      id,
      name,
      tagline,
      photoUrl: this.store.thumbs().get(id) ?? null,
    })),
  );
  readonly count = computed(() => {
    const count = this.tiles().length;
    return count === 1 ? '1 application waiting' : `${count} applications waiting`;
  });

  constructor() {
    this.store.load();
  }
}
