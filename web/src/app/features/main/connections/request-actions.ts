import { inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { Conversation } from '../../../core/connections/connections.model';
import { ConnectionsStore } from '../../../core/connections/connections.store';

/**
 * What can be done with a connection request, on the profile so that it gets read first.
 * Accepting goes straight to the conversation, for the first reply. Hiding (`decline_intro`) is
 * private and can be undone for as long as the snackbar shows; the function can't be, so it must
 * only run after that.
 */
export function injectRequestActions() {
  const store = inject(ConnectionsStore);
  const router = inject(Router);
  const snackBar = inject(MatSnackBar);

  return {
    /** Whether it worked; if not, the store has said so. */
    async accept(conversation: Conversation, options: { replaceUrl?: boolean } = {}) {
      if (!(await store.accept(conversation))) return false;
      return router.navigate(['/app/messages', conversation.person.id], options);
    },
    hide(conversation: Conversation) {
      const { person } = conversation;
      store.setHidden(person.id, true);
      const snack = snackBar.open(`Hidden. ${person.name} won't be told`, 'Undo', {
        duration: 4000,
        panelClass: 'kt-snackbar',
      });
      snack.afterDismissed().subscribe(({ dismissedByAction }) => {
        if (dismissedByAction) store.setHidden(person.id, false);
        else void store.decline(conversation);
      });
    },
  };
}
