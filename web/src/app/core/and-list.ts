const FORMAT = new Intl.ListFormat('en-GB', { type: 'conjunction' });

/** "name", "name and pronouns", "name, pronouns and location". */
export function andList(items: string[]): string {
  return FORMAT.format(items);
}
