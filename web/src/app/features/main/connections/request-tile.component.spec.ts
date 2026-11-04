import { chipLabels } from './request-tile.component';

describe('chipLabels', () => {
  it('shows one or two as they are', () => {
    expect(chipLabels(['Friends'])).toEqual(['Friends']);
    expect(chipLabels(['Friends', 'Casual'])).toEqual(['Friends', 'Casual']);
  });

  it('replaces the rest with a count from three on', () => {
    expect(chipLabels(['Friends', 'Casual', 'Exploring'])).toEqual(['Friends', '+2 more']);
    expect(chipLabels(['A', 'B', 'C', 'D'])).toEqual(['A', '+3 more']);
  });
});
