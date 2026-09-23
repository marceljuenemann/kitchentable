/**
 * A unique, obviously-fake email per call, so parallel tests never collide on the same
 * Mailpit inbox address.
 */
export function uniqueEmail(label = 'e2e'): string {
  return `${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
}
