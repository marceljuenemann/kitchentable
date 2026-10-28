import type { Member } from './search.store';

/**
 * MOCK: made-up members, until search reads real ones from the database. They use the real
 * option lists (onboarding-options.ts), plus a few values of people's own, which never match a
 * filter. Photos are drawn here (mockPhotoUrls) rather than loaded from anywhere.
 */
export const MOCK_MEMBERS: Member[] = [
  member({
    id: 'mock-maya',
    name: 'Maya',
    pronouns: 'she/her',
    tagline: 'Supper clubs, long tables, longer conversations',
    bio:
      'I host a monthly supper club: twelve people, one long table, no phones out. It started as ' +
      'a way to feed friends after a bad year and turned into the best part of my month.\n\n' +
      "I have a partner of six years who you'd probably meet at the table eventually. I like " +
      'people who ask a second question.',
    gender: ['Woman'],
    sexuality: ['Bisexual'],
    birth: [1991, 4],
    looking_for: ['polyamory', 'friends'],
    photos: 3,
    joined: '2026-10-23T18:00:00Z',
  }),
  member({
    id: 'mock-ife',
    name: 'Ife',
    pronouns: 'they/them',
    tagline: 'Two partners, one allotment, too many tomatoes',
    bio:
      'Two partners, one allotment, and more tomatoes than any household needs by August. I am ' +
      'usually the person who brings the surplus to the pub.\n\n' +
      'I am not looking to add a third to anything. I am looking for people whose company I ' +
      'want on a Tuesday.',
    gender: ['Non-binary'],
    sexuality: ['Queer'],
    birth: [1988, 11],
    looking_for: ['relationship-anarchy', 'friends'],
    photos: 2,
    joined: '2026-10-24T10:30:00Z',
  }),
  member({
    id: 'mock-rowan',
    name: 'Rowan',
    pronouns: 'she/they',
    tagline: 'Bookshop shifts and cold-water swims',
    bio:
      'Bookshop shifts most weekdays, Sunday swims at the lido whatever the temperature. I will ' +
      'talk about either at length.\n\n' +
      'New to organised dating, not new to non-monogamy. Ask before mentioning me to people we ' +
      'both know.',
    gender: ['Woman', 'Genderqueer'],
    sexuality: ['Pansexual'],
    birth: [1996, 2],
    looking_for: ['exploring', 'polyamory'],
    photos: 4,
    joined: '2026-10-27T12:00:00Z',
  }),
  member({
    id: 'mock-devi',
    name: 'Devi',
    pronouns: 'she/her',
    tagline: 'Slow with messages, quick to make dinner for six',
    bio:
      'Slow with messages, quick to make dinner for six. If a conversation is going well I would ' +
      'rather move it to a kitchen than keep typing.\n\n' +
      'My nesting partner and I have been together eleven years. We do not date as a couple, ' +
      'and you would never be a secret.',
    gender: ['Woman'],
    sexuality: ['Heteroflexible'],
    birth: [1983, 7],
    looking_for: ['open-relationship', 'Slow dating'],
    photos: 1,
    joined: '2026-10-23T20:15:00Z',
  }),
  member({
    id: 'mock-kel',
    name: 'Kel',
    pronouns: 'they/them',
    tagline: "Doesn't rank people. Does rank pub quiz answers.",
    bio:
      'Relationship anarchist, which mostly means I do not rank people. Also genuinely terrible ' +
      'at pub quizzes and unbothered about it.\n\n' +
      'I like walks with no destination and being told about your obsessive interest in detail. ' +
      'Bonus points for maps.',
    gender: ['Genderfluid'],
    sexuality: ['Queer', 'Demisexual'],
    birth: [1993, 9],
    looking_for: ['relationship-anarchy'],
    photos: 3,
    joined: '2026-10-25T09:00:00Z',
  }),
  member({
    id: 'mock-ana',
    name: 'Ana',
    pronouns: 'she/her',
    tagline: 'Queer netball league organiser, chaos optional',
    bio:
      'I organise a queer sports league, mostly netball, occasionally chaos. Come and be bad at ' +
      'it with us, nobody keeps score after the first quarter.\n\n' +
      'In an open relationship. My partner is on here too and we are honest about it from the ' +
      'first message.',
    gender: ['Woman'],
    sexuality: ['Lesbian'],
    birth: [1990, 5],
    looking_for: ['open-relationship', 'casual', 'friends'],
    photos: 2,
    joined: '2026-10-26T14:45:00Z',
  }),
  member({
    id: 'mock-toby',
    name: 'Toby',
    pronouns: 'he/him',
    tagline: 'Good roast, better listener',
    bio:
      'Nesting partner of twelve years, both of us new to all of this and taking it carefully. ' +
      'We have read the books and we are still learning.\n\n' +
      'I am better in person than in writing. I make a good roast and I listen well, and I will ' +
      'remember what you told me last time.',
    gender: ['Man'],
    sexuality: ['Straight'],
    birth: [1979, 12],
    looking_for: ['exploring', 'monogamy'],
    photos: 3,
    joined: '2026-10-28T08:00:00Z',
  }),
  member({
    id: 'mock-nour',
    name: 'Nour',
    pronouns: 'he/they',
    tagline: 'Film club arguments and a very loud cat',
    bio:
      'Book swaps, a film club that argues too much, and a very loud cat who will be in every ' +
      'photo eventually.\n\n' +
      'I do not label how I do relationships. I am clear about what I want as things go along, ' +
      'and I expect the same from you.',
    gender: ['Man', 'Gender questioning'],
    sexuality: ['Gay'],
    birth: [1994, 3],
    looking_for: ['polyamory', 'play-partners'],
    photos: 5,
    joined: '2026-10-24T17:20:00Z',
  }),
  member({
    id: 'mock-sam',
    name: 'Sam',
    pronouns: 'any pronouns',
    tagline: 'Climbing wall regular, terrible at falling',
    bio:
      'Climbing wall three evenings a week, still terrible at falling. Weekends are for markets ' +
      'and fixing other people’s bikes.\n\n' +
      'Solo poly and happy that way. I would love more friends who are up for an adventure and ' +
      'an honest chat afterwards.',
    gender: ['Agender'],
    sexuality: ['Asexual', 'Aromantic'],
    birth: [1999, 8],
    looking_for: ['friends', 'Solo poly'],
    photos: 2,
    joined: '2026-10-27T19:40:00Z',
  }),
  member({
    id: 'mock-jules',
    name: 'Jules',
    pronouns: 'he/him',
    tagline: 'Choir tenor, amateur baker, professional overthinker',
    bio:
      'Tenor in a community choir, which means my Tuesday evenings are spoken for and my ' +
      'Wednesday mornings are hoarse.\n\n' +
      'I bake when I overthink, so my friends eat well. Polyamorous for a few years now, with a ' +
      'partner who lives across town and a cat who lives with me.',
    gender: ['Man'],
    sexuality: ['Bisexual'],
    birth: [1986, 1],
    looking_for: ['polyamory'],
    photos: 6,
    joined: '2026-10-23T19:10:00Z',
  }),
  member({
    id: 'mock-priya',
    name: 'Priya',
    pronouns: 'she/they',
    tagline: 'Will plan the picnic, will forget the blanket',
    bio:
      'Park picnics from April to October, and stubbornly in November too. I will plan ' +
      'everything and forget the blanket.\n\n' +
      'Still figuring out what non-monogamy looks like for me, and happy to go slowly. Kind and ' +
      'curious people, please.',
    gender: ['Woman', 'Non-binary'],
    sexuality: ['Queer'],
    birth: [2001, 6],
    looking_for: ['exploring', 'casual'],
    photos: 3,
    joined: '2026-10-28T07:30:00Z',
  }),
  member({
    id: 'mock-alex',
    name: 'Alex',
    pronouns: 'they/them',
    tagline: '',
    bio:
      'Gardener by day, synth tinkerer by night. My flat is mostly plants and patch cables, and ' +
      'the neighbours have stopped asking.\n\n' +
      'I left my birthday off on purpose. Ask me anything else, I am an open book, especially ' +
      'about compost.',
    gender: ['Non-binary'],
    sexuality: [],
    birth: null,
    looking_for: ['relationship-anarchy', 'play-partners'],
    photos: 1,
    joined: '2026-10-25T21:00:00Z',
  }),
];

/** Drawn photos for a mock member: a soft silhouette on a gradient in their own colour. */
export function mockPhotoUrls(member: Member): string[] {
  const hue = HUES[MOCK_MEMBERS.indexOf(member) % HUES.length];
  return member.photos.map((_, index) => mockPhoto(hue, index));
}

/** Around the brand colours: violet, magenta, sky, gold, plus coral and teal. */
const HUES = [300, 341, 233, 68, 20, 170];

function mockPhoto(hue: number, index: number): string {
  const shift = [0, -70, 70, -35, 35, 0][index % 6];
  const angle = (index * 60) % 360;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600">` +
    `<defs><linearGradient id="g" gradientTransform="rotate(${angle} .5 .5)">` +
    `<stop offset="0" stop-color="hsl(${hue} 60% 78%)"/>` +
    `<stop offset="1" stop-color="hsl(${hue + 40} 55% 45%)"/>` +
    `</linearGradient></defs>` +
    `<rect width="600" height="600" fill="url(#g)"/>` +
    `<circle cx="${480 - shift}" cy="120" r="70" fill="white" opacity=".25"/>` +
    `<g fill="hsl(${hue} 45% 22%)" opacity=".5" transform="translate(${shift} 0)">` +
    `<circle cx="300" cy="250" r="95"/>` +
    `<path d="M110 600C120 450 200 380 300 380S480 450 490 600Z"/>` +
    `</g></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function member(mock: {
  id: string;
  name: string;
  pronouns: string;
  tagline: string;
  bio: string;
  gender: string[];
  sexuality: string[];
  /** Year and month, or null for none. */
  birth: [number, number] | null;
  looking_for: string[];
  photos: number;
  joined: string;
}): Member {
  return {
    id: mock.id,
    status: 'active',
    name: mock.name,
    pronouns: mock.pronouns,
    tagline: mock.tagline,
    bio: mock.bio,
    location: 'London',
    gender: mock.gender,
    sexuality: mock.sexuality,
    birth_year: mock.birth?.[0] ?? null,
    birth_month: mock.birth?.[1] ?? null,
    looking_for: mock.looking_for,
    photos: Array.from({ length: mock.photos }, (_, index) => `${mock.id}-${index}`),
    age_verified_at: mock.joined,
  };
}
