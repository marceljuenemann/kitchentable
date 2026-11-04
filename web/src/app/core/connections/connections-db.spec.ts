import { afterCheckpoint, CHECKPOINT_LAG_MS, isRefusal, nextCheckpoint } from './connections-db';

describe('afterCheckpoint', () => {
  it('pages by the timestamp, then each key column in turn', () => {
    const checkpoint = { updated_at: '2026-11-03T10:00:00.123456+00:00', keys: ['a', 'b'] };
    const time = '"2026-11-03T10:00:00.123456+00:00"';
    expect(afterCheckpoint(checkpoint, ['initiator_id', 'recipient_id'])).toBe(
      [
        `updated_at.gt.${time}`,
        `and(updated_at.eq.${time},initiator_id.gt.a)`,
        `and(updated_at.eq.${time},initiator_id.eq.a,recipient_id.gt.b)`,
      ].join(','),
    );
  });
});

describe('nextCheckpoint', () => {
  const at = (seconds: number, id: string) => ({
    updated_at: new Date(Date.UTC(2026, 10, 3, 10, 0, seconds)).toISOString(),
    id,
  });
  const keys = ['id'];

  it('moves on to the last row of a full batch, since there is more to fetch', () => {
    const rows = [at(0, 'a'), at(1, 'b')];
    expect(nextCheckpoint(rows, keys, 2, undefined)).toEqual({
      updated_at: rows[1].updated_at,
      keys: ['b'],
    });
  });

  it('stays behind the newest rows at the end of a sync, so they are read again', () => {
    const lag = CHECKPOINT_LAG_MS / 1000;
    const rows = [at(0, 'a'), at(1, 'b'), at(1 + lag, 'c'), at(2 + lag, 'd')];
    expect(nextCheckpoint(rows, keys, 100, undefined)).toEqual({
      updated_at: rows[1].updated_at,
      keys: ['b'],
    });
  });

  it('keeps the previous checkpoint when every row is recent, or there are none', () => {
    const previous = { updated_at: '2026-11-03T09:00:00Z', keys: ['z'] };
    expect(nextCheckpoint([at(0, 'a'), at(1, 'b')], keys, 100, previous)).toBe(previous);
    expect(nextCheckpoint([], keys, 100, previous)).toBe(previous);
  });

  it('reads microsecond timestamps from the server', () => {
    const rows = [
      { updated_at: '2026-11-03T10:00:00.123456+00:00', id: 'a' },
      { updated_at: '2026-11-03T10:00:10.654321+00:00', id: 'b' },
    ];
    expect(nextCheckpoint(rows, keys, 100, undefined)?.keys).toEqual(['a']);
  });
});

describe('isRefusal', () => {
  it('is a refusal when the database raised an error', () => {
    expect(isRefusal({ code: 'P0001' })).toBeTrue();
    expect(isRefusal({ code: '54000' })).toBeTrue();
    expect(isRefusal({ code: '23505' })).toBeTrue();
  });

  it('is worth retrying when the request didn’t get there or might work later', () => {
    expect(isRefusal({ code: '' })).toBeFalse();
    expect(isRefusal({ code: 'PGRST301' })).toBeFalse();
    expect(isRefusal({ code: '08006' })).toBeFalse();
    expect(isRefusal({ code: '40001' })).toBeFalse();
    expect(isRefusal({ code: '57014' })).toBeFalse();
  });
});
