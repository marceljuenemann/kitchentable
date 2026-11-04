import { Component, inject } from '@angular/core';
import { MatBottomSheetRef } from '@angular/material/bottom-sheet';
import { MatButtonModule } from '@angular/material/button';
import { Settings } from '../../../core/profile.model';
import { MyProfileStore } from './my-profile.store';

/**
 * The account's settings, from the profile tab's Account card. Each one saves as it's switched,
 * so Done only closes the sheet. Uses the MyProfileStore of the profile route it's opened from.
 */
@Component({
  selector: 'app-settings-sheet',
  standalone: true,
  imports: [MatButtonModule],
  templateUrl: './settings-sheet.component.html',
  styleUrl: './settings-sheet.component.scss',
})
export class SettingsSheetComponent {
  private readonly ref = inject(MatBottomSheetRef);
  readonly store = inject(MyProfileStore);

  readonly emails: { setting: keyof Settings; label: string }[] = [
    { setting: 'intro_emails', label: 'Email me about new intros' },
    { setting: 'message_emails', label: 'Email me about new messages' },
  ];

  toggle(setting: keyof Settings) {
    void this.store.updateSettings({ [setting]: !this.store.settings()[setting] });
  }

  close() {
    this.ref.dismiss();
  }
}
