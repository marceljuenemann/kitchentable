import { textParts } from './message-links';

describe('textParts', () => {
  it('leaves text without links as it is', () => {
    expect(textParts('Fancy a walk?')).toEqual([{ text: 'Fancy a walk?' }]);
    expect(textParts('')).toEqual([]);
  });

  it('finds https links among the text', () => {
    expect(textParts('Tickets: https://example.com/gig?id=4 see you there')).toEqual([
      { text: 'Tickets: ' },
      { text: 'https://example.com/gig?id=4', href: 'https://example.com/gig?id=4' },
      { text: ' see you there' },
    ]);
  });

  it('finds several, and a link on its own', () => {
    const parts = textParts('https://a.example\nhttps://b.example');
    expect(parts.map(({ href }) => href)).toEqual([
      'https://a.example',
      undefined,
      'https://b.example',
    ]);
    expect(parts[1].text).toBe('\n');
  });

  it('only links https, written out in full', () => {
    for (const text of [
      'http://example.com',
      'example.com',
      'www.example.com',
      'javascript:alert(1)',
      'ftp://example.com',
      'https://',
      'https://localhost',
    ]) {
      expect(textParts(text).some(({ href }) => href))
        .withContext(text)
        .toBeFalse();
    }
  });

  it('leaves punctuation that ends the sentence out of the link', () => {
    expect(textParts('Have you seen https://example.com/menu?')).toEqual([
      { text: 'Have you seen ' },
      { text: 'https://example.com/menu', href: 'https://example.com/menu' },
      { text: '?' },
    ]);
    expect(textParts('(https://example.com/a), then').map(({ href }) => href)).toEqual([
      undefined,
      'https://example.com/a',
      undefined,
    ]);
  });

  it('keeps a closing bracket the link opened', () => {
    const link = 'https://en.wikipedia.org/wiki/Polyamory_(disambiguation)';
    expect(textParts(`See ${link}.`).find(({ href }) => href)?.href).toBe(link);
  });

  it('keeps the text around links exactly, so it reads the same', () => {
    const text = 'One https://example.com/x, two  https://example.com/y.\n\nThree';
    expect(
      textParts(text)
        .map((part) => part.text)
        .join(''),
    ).toBe(text);
  });
});
