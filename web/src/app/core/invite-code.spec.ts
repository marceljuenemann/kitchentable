import { inviteCodeFor } from './invite-code';

describe('inviteCodeFor', () => {
  // Matches `left(encode(sha256(id::text::bytea), 'hex'), 8)` in Postgres.
  it('is the start of the SHA-256 of the user id', async () => {
    expect(await inviteCodeFor('11111111-2222-3333-4444-555555555555')).toBe('666ff6cc');
  });
});
