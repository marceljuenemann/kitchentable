/** A run of a message's text: plain, or a link (`href`) shown as its text. */
export interface TextPart {
  text: string;
  href?: string;
}

/** `https://` and anything up to whitespace or a character that can't be in a URL as typed. */
const LINK = /https:\/\/[^\s<>"]+/gi;
/** What usually ends the sentence around a link rather than the link. */
const TRAILING = /[.,!?;:'"’”*_]+$/;

/**
 * Splits a message into plain text and links, for showing the links as links. Only `https://`
 * ones, written out in full: no `http://`, no bare `example.com`, so a link always goes where it
 * says, encrypted. Punctuation at the end belongs to the sentence, and so does a closing bracket
 * unless the link opened it (as in Wikipedia's).
 */
export function textParts(text: string): TextPart[] {
  const parts: TextPart[] = [];
  let from = 0;
  for (const match of text.matchAll(LINK)) {
    const link = trimmed(match[0]);
    if (!isUrl(link)) continue;
    const start = match.index;
    if (start > from) parts.push({ text: text.slice(from, start) });
    parts.push({ text: link, href: link });
    from = start + link.length;
  }
  if (from < text.length) parts.push({ text: text.slice(from) });
  return parts;
}

function trimmed(link: string): string {
  let result = link;
  for (;;) {
    const before = result;
    result = result.replace(TRAILING, '');
    for (const [open, close] of [
      ['(', ')'],
      ['[', ']'],
    ]) {
      const opened = result.split(open).length - 1;
      if (result.endsWith(close) && result.split(close).length - 1 > opened) {
        result = result.slice(0, -1);
      }
    }
    if (result === before) return result;
  }
}

function isUrl(link: string): boolean {
  try {
    const url = new URL(link);
    return url.protocol === 'https:' && url.hostname.includes('.');
  } catch {
    return false;
  }
}
