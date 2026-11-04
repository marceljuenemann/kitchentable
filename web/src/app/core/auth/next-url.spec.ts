import { safeNext } from './next-url';

describe('safeNext', () => {
  it('keeps the signed-in pages, with their parameters', () => {
    expect(safeNext('/app')).toBe('/app');
    expect(safeNext('/app/messages/123')).toBe('/app/messages/123');
    expect(safeNext('/app?status=Approved')).toBe('/app?status=Approved');
    expect(safeNext('/admin/vetting/123')).toBe('/admin/vetting/123');
  });

  it('goes to the app instead of anywhere else', () => {
    expect(safeNext(null)).toBe('/app');
    expect(safeNext('')).toBe('/app');
    expect(safeNext('/')).toBe('/app');
    expect(safeNext('/about/terms')).toBe('/app');
    expect(safeNext('/apple')).toBe('/app');
    expect(safeNext('//evil.example/app')).toBe('/app');
    expect(safeNext('https://evil.example/app')).toBe('/app');
    expect(safeNext('javascript:alert(1)')).toBe('/app');
  });
});
