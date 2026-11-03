import { Location } from '@angular/common';
import {
  afterRenderEffect,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatBottomSheet } from '@angular/material/bottom-sheet';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { ActivatedRoute, Router, RouterLink, RouterOutlet } from '@angular/router';
import { map } from 'rxjs';
import { ChatMessage, firstUnread } from '../../../core/connections/connections.model';
import { ConnectionsStore } from '../../../core/connections/connections.store';
import { photoTransitionName } from '../../../shared/profile-view/profile-transition';
import { AvatarComponent } from './avatar.component';
import {
  ConversationSheetComponent,
  ConversationSheetData,
  ConversationSheetResult,
} from './conversation-sheet.component';
import { IntroCardComponent } from './intro-card.component';
import { clockTime, shortDate } from './message-time';
import { threadItems } from './thread-items';

/** `check_message_content()` allows up to this many characters. */
const MAX_LENGTH = 2000;
const SHOW_COUNT_FROM = MAX_LENGTH - 200;
/** How far below the header the "New messages" line lands on opening. */
const UNREAD_LINE_GAP_PX = 8;

/** One conversation, over the list: the intro at the top, then the messages. */
@Component({
  selector: 'app-conversation',
  standalone: true,
  imports: [
    AvatarComponent,
    IntroCardComponent,
    MatButtonModule,
    MatIconModule,
    RouterLink,
    RouterOutlet,
  ],
  templateUrl: './conversation.component.html',
  styleUrl: './conversation.component.scss',
})
export class ConversationComponent {
  private readonly store = inject(ConnectionsStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private readonly bottomSheet = inject(MatBottomSheet);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly destroyRef = inject(DestroyRef);

  private readonly scroller = viewChild<ElementRef<HTMLElement>>('scroller');
  private readonly input = viewChild<ElementRef<HTMLTextAreaElement>>('input');
  private readonly unreadLine = viewChild<ElementRef<HTMLElement>>('unreadLine');
  /** Whether a conversation was just opened, so the next render is the first to show it. */
  private opening = true;
  private readonly id = toSignal(this.route.paramMap.pipe(map((params) => params.get('id'))), {
    initialValue: this.route.snapshot.paramMap.get('id'),
  });

  readonly maxLength = MAX_LENGTH;
  readonly conversation = computed(() => this.store.conversation(this.id()));
  /** The first message that was unread on opening. Opening marks it read, so this keeps it. */
  private readonly unreadFromId = signal<string | null>(null);
  readonly items = computed(() => {
    const conversation = this.conversation();
    return conversation ? threadItems(conversation, new Date(), this.unreadFromId()) : [];
  });
  /** Changes only with something new at the end, so a retry doesn't scroll someone reading. */
  private readonly latestItem = computed(() => this.items().at(-1)?.key);
  /**
   * Set during the navigation, so the avatar gives up the morph's name before the browser
   * captures the new page: names must be unique, and the profile's photo has it then.
   */
  readonly profileOpen = signal(false);
  readonly photoTransitionName = computed(() => {
    const id = this.id();
    return id && !this.profileOpen() ? photoTransitionName(id) : null;
  });
  readonly draft = signal('');
  readonly canSend = computed(() => this.draft().trim().length > 0);
  readonly showCount = computed(() => this.draft().length >= SHOW_COUNT_FROM);

  readonly clockTime = clockTime;
  readonly shortDate = shortDate;

  constructor() {
    effect(() => {
      const id = this.id();
      untracked(() => {
        const conversation = this.store.conversation(id);
        if (!id || !conversation) return;
        this.unreadFromId.set(firstUnread(conversation)?.id ?? null);
        this.opening = true;
        this.store.markRead(id);
        this.draft.set(this.store.draft(id));
      });
    });
    afterRenderEffect(() => {
      this.latestItem();
      untracked(() => this.settle());
    });
    this.fitAboveKeyboard();
  }

  onInput(event: Event) {
    const textarea = event.target as HTMLTextAreaElement;
    const id = this.id();
    this.draft.set(textarea.value);
    if (id) this.store.saveDraft(id, textarea.value);
    this.fitToText(textarea);
  }

  /** On a keyboard Enter sends; on a phone's it's a new line, and sending is the button. */
  onEnter(event: Event) {
    const physicalKeyboard = matchMedia('(hover: hover) and (pointer: fine)').matches;
    if (!physicalKeyboard || (event as KeyboardEvent).shiftKey) return;
    event.preventDefault();
    this.send();
  }

  send() {
    const id = this.id();
    if (!id || !this.canSend()) return;
    this.store.send(id, this.draft().trim());
    this.store.saveDraft(id, '');
    this.draft.set('');
    const textarea = this.input()?.nativeElement;
    if (textarea) {
      textarea.value = '';
      this.fitToText(textarea);
      // The button took the focus, which would close the phone's keyboard.
      textarea.focus();
    }
  }

  retry(message: ChatMessage) {
    const id = this.id();
    if (id) this.store.retry(id, message.id);
  }

  textOf(message: ChatMessage): string {
    return message.content.type === 'text' ? message.content.text : '';
  }

  openActions() {
    const conversation = this.conversation();
    if (!conversation) return;
    this.bottomSheet
      .open<ConversationSheetComponent, ConversationSheetData, ConversationSheetResult>(
        ConversationSheetComponent,
        {
          data: { name: conversation.person.name, canEnd: conversation.status === 'accepted' },
          panelClass: 'kt-bottom-sheet',
          autoFocus: 'dialog',
        },
      )
      .afterDismissed()
      .subscribe((result) => {
        if (result === 'profile') {
          this.router.navigate(['profile'], { relativeTo: this.route });
        } else if (result === 'report') {
          this.router.navigate(['/app/messages', this.store.team()?.person.id]);
        } else if (result === 'end') {
          this.store.end(conversation.person.id);
        }
      });
  }

  /** Back through the history, so the phone's back gesture and this button agree. */
  back() {
    if (this.router.lastSuccessfulNavigation()?.previousNavigation) {
      this.location.back();
    } else {
      this.router.navigate(['/app/messages']);
    }
  }

  /**
   * After a render with something new at the end. On opening, that's the start of what's unread,
   * with the box already sized to a restored draft; otherwise the end.
   */
  private settle() {
    const textarea = this.input()?.nativeElement;
    if (this.opening && textarea) this.fitToText(textarea);
    const line = this.unreadLine()?.nativeElement;
    const scroller = this.scroller()?.nativeElement;
    if (this.opening && line && scroller) {
      const offset = line.getBoundingClientRect().top - scroller.getBoundingClientRect().top;
      scroller.scrollTop += offset - UNREAD_LINE_GAP_PX;
    } else {
      this.scrollToEnd();
    }
    this.opening = false;
  }

  private scrollToEnd() {
    const scroller = this.scroller()?.nativeElement;
    if (scroller) scroller.scrollTop = scroller.scrollHeight;
  }

  /** Grows the box with its text, which keeps the latest message in view above it. */
  private fitToText(textarea: HTMLTextAreaElement) {
    const before = textarea.offsetHeight;
    textarea.style.height = 'auto';
    // `scrollHeight` leaves out the border, and the box includes it.
    const border = textarea.offsetHeight - textarea.clientHeight;
    textarea.style.height = `${textarea.scrollHeight + border}px`;
    if (textarea.offsetHeight !== before) this.scrollToEnd();
  }

  /**
   * A phone's keyboard only covers fixed elements, so without this it would hide the box you're
   * typing in. The visual viewport is what stays uncovered.
   */
  private fitAboveKeyboard() {
    const viewport = window.visualViewport;
    if (!viewport) return;
    let height = viewport.height;
    const fit = () => {
      const { style } = this.host.nativeElement;
      style.top = `${viewport.offsetTop}px`;
      style.height = `${viewport.height}px`;
      if (viewport.height < height) this.scrollToEnd();
      height = viewport.height;
    };
    viewport.addEventListener('resize', fit);
    viewport.addEventListener('scroll', fit);
    this.destroyRef.onDestroy(() => {
      viewport.removeEventListener('resize', fit);
      viewport.removeEventListener('scroll', fit);
    });
  }
}
