import { inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { Conversation } from '../messages/messages.model';
import { MessagesStore } from '../messages/messages.store';

/**
 * What can be done with a connection request, on the profile so that it gets read first.
 * Accepting goes straight to the conversation, for the first reply. Hiding (`decline_intro`) is
 * private and can be undone for as long as the snackbar shows; the function can't be, so it must
 * only run after that.
 */
export function injectRequestActions() {
  const store = inject(MessagesStore);
  const router = inject(Router);
  const snackBar = inject(MatSnackBar);

  return {
    accept({ person }: Conversation, options: { replaceUrl?: boolean } = {}) {
      store.accept(person.id);
      return router.navigate(['/app/messages', person.id], options);
    },
    hide({ person }: Conversation) {
      store.setDeclined(person.id, true);
      snackBar
        .open(`Hidden. ${person.name} won't be told`, 'Undo', {
          duration: 4000,
          panelClass: 'kt-snackbar',
        })
        .onAction()
        .subscribe(() => store.setDeclined(person.id, false));
    },
  };
}
