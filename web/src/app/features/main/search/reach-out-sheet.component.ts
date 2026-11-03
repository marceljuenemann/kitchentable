import { Component, computed, inject, signal } from '@angular/core';
import { MAT_BOTTOM_SHEET_DATA, MatBottomSheetRef } from '@angular/material/bottom-sheet';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { ConnectionsStore, INTRO_LIMIT_CODE } from '../../../core/connections/connections.store';
import { Member } from '../../../core/profile.model';
import { UserStorage } from '../../../core/user-storage';
import { lookingForLabel } from '../../../core/profile-options';

/** Only checked here: `check_message_content()` allows any message 2000 characters. */
const MAX_LENGTH = 750;
const SHOW_COUNT_FROM = MAX_LENGTH - 100;

/** An introduction in progress, so a stray tap outside the sheet doesn't lose it. */
interface IntroDraft {
  lookingFor: string[];
  text: string;
}

/**
 * Writing an introduction: what to connect on, from what they're looking for, and a message.
 * Dismissed with `true` once it's sent. Opened with the profile's view container, for the main
 * app's ConnectionsStore.
 */
@Component({
  selector: 'app-reach-out-sheet',
  standalone: true,
  imports: [MatButtonModule, MatChipsModule, MatFormFieldModule, MatInputModule],
  templateUrl: './reach-out-sheet.component.html',
  styleUrl: './reach-out-sheet.component.scss',
})
export class ReachOutSheetComponent {
  private readonly ref =
    inject<MatBottomSheetRef<ReachOutSheetComponent, boolean>>(MatBottomSheetRef);
  private readonly store = inject(ConnectionsStore);
  private readonly storage = inject(UserStorage);
  readonly member = inject<Member>(MAT_BOTTOM_SHEET_DATA);

  private readonly draftKey = `intro.draft.${this.member.id}`;
  private readonly draft = this.storage.get<IntroDraft>(this.draftKey);

  readonly maxLength = MAX_LENGTH;
  readonly options = this.member.looking_for.map((value) => ({
    value,
    label: lookingForLabel(value),
  }));
  readonly picked = signal(this.initialPicks());
  readonly text = signal(this.draft?.text ?? '');
  readonly sending = signal(false);
  /** Why the last try failed: the daily limit, or anything else. */
  readonly failed = signal<'limit' | 'error' | null>(null);
  readonly showCount = computed(() => this.text().length >= SHOW_COUNT_FROM);

  /** What's still missing, so the disabled button says why. */
  readonly buttonLabel = computed(() => {
    if (this.sending()) return 'Sending…';
    if (this.picked().length === 0) return 'Select what to connect on';
    return this.text().trim() ? 'Send introduction' : 'Write your message';
  });
  /** It only opens with some left: the profile says so when there are none. */
  readonly introsLeft = computed(() => {
    const remaining = this.store.introsLeftToday();
    if (remaining === null) return '';
    return remaining === 1
      ? '1 introduction left for today'
      : `${remaining} introductions left for today`;
  });
  readonly canSend = computed(
    () => this.picked().length > 0 && this.text().trim() !== '' && !this.sending(),
  );

  setPicked(values: string[]) {
    this.picked.set(values);
    this.saveDraft();
  }

  setText(text: string) {
    this.text.set(text);
    this.saveDraft();
  }

  async send() {
    if (!this.canSend()) return;
    this.sending.set(true);
    this.failed.set(null);
    // Closing now would lose track of an introduction that's on its way.
    this.ref.disableClose = true;
    try {
      await this.store.sendIntro(this.member, this.picked(), this.text().trim());
      this.storage.remove(this.draftKey);
      this.ref.disableClose = false;
      this.ref.dismiss(true);
    } catch (error) {
      console.warn('Could not send the introduction', error);
      const limit = (error as { code?: string }).code === INTRO_LIMIT_CODE;
      this.failed.set(limit ? 'limit' : 'error');
      this.sending.set(false);
      this.ref.disableClose = false;
    }
  }

  /** At least one is needed, so a single option starts picked. */
  private initialPicks(): string[] {
    const values = this.member.looking_for;
    if (values.length === 1) return values;
    return (this.draft?.lookingFor ?? []).filter((value) => values.includes(value));
  }

  private saveDraft() {
    const draft: IntroDraft = { lookingFor: this.picked(), text: this.text() };
    this.storage.set(this.draftKey, draft);
  }
}
