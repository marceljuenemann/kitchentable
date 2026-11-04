/**
 * Where to go once signed in: the page a signed-out visitor asked for (the `next` parameter), if
 * it's one of the signed-in pages, or else the app. Anything else, such as another site or
 * `//…`, is ignored, so the parameter can't send people away from Kitchen Table.
 */
export function safeNext(next: string | null | undefined): string {
  return next && /^\/(app|admin)(?=[/?#]|$)/.test(next) ? next : '/app';
}
